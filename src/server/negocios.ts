import { prisma } from "@/lib/db";
import { ORIGENS } from "@/lib/empresas";
import { PAPEIS_CONTATO, STATUS_POR_TIPO, type PapelContato, type StatusNegocio } from "@/lib/negocios";
import { RANK_TAMANHO_MAX, rankEntre, ranksEspacados } from "@/lib/rank";
import { erroValidacao, naoEncontrado, regraViolada } from "@/server/erros";
import { pipelinePadrao } from "@/server/pipelines";
import { booleano, opcao, texto, textoObrigatorio } from "@/server/validacao";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Regras de Negócio (oportunidade):
 * - Pertence a uma empresa ativa; não troca de empresa (crie outro negócio).
 * - A etapa define o pipeline e o status (ABERTA→ABERTO, GANHO, PERDIDO). A FK composta
 *   no banco impede etapa de outro pipeline.
 * - Mudar de etapa grava HistoricoEtapa e reinicia `etapaDesde`, na mesma transação.
 * - Entrar em GANHO/PERDIDO preenche `fechadoEm`; PERDIDO exige motivo ativo. Voltar para
 *   etapa aberta (reabrir) limpa fechamento e motivo.
 * - Ganhar um negócio torna a empresa CLIENTE (não regride ao reabrir).
 * - Contatos do negócio são da própria empresa ou contatos sem empresa (ex.: parceiro).
 *   Sem contatos informados, o principal da empresa entra como participante.
 * - Arquivar é soft delete.
 */

type Tx = Prisma.TransactionClient;
type Entrada = Record<string, unknown>;

export type DadosNegocio = {
  titulo?: string;
  empresaId?: string;
  etapaId?: string;
  valor?: string;
  previsaoFechamento?: Date | null;
  origem?: (typeof ORIGENS)[number] | null;
  observacao?: string | null;
  arquivado?: boolean;
  motivoPerdaId?: string | null;
  motivoPerdaDetalhe?: string | null;
  /** Posição no kanban: id do card que fica logo acima; null = topo; ausente = mantém/fim. */
  depoisDe?: string | null;
  contatos?: { contatoId: string; papel: PapelContato | null }[];
};

function lerValor(input: Entrada): string | undefined {
  const v = input.valor;
  if (v === undefined) return undefined;
  if (v === null || v === "") return "0";
  const num = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(num) || num < 0 || num >= 1e10) throw erroValidacao("Valor inválido");
  return num.toFixed(2);
}

function lerData(input: Entrada, campo: string, rotulo: string): Date | null | undefined {
  const v = input[campo];
  if (v === undefined || v === null || v === "") return v === undefined ? undefined : null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw erroValidacao(`${rotulo}: use AAAA-MM-DD`);
  const data = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) throw erroValidacao(`${rotulo}: data inválida`);
  return data;
}

function lerId(input: Entrada, campo: string, rotulo: string): string | null | undefined {
  const v = input[campo];
  if (v === undefined || v === null) return v;
  if (typeof v !== "string" || !v) throw erroValidacao(`${rotulo}: valor inválido`);
  return v;
}

function lerContatos(input: Entrada): DadosNegocio["contatos"] {
  const v = input.contatos;
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) throw erroValidacao("Contatos: envie uma lista");
  const lista = v.map((item) => {
    if (!item || typeof item !== "object" || typeof item.contatoId !== "string") {
      throw erroValidacao("Contatos: cada item precisa de contatoId");
    }
    return { contatoId: item.contatoId as string, papel: opcao(item, "papel", "Papel", PAPEIS_CONTATO) ?? null };
  });
  if (new Set(lista.map((c) => c.contatoId)).size !== lista.length) {
    throw erroValidacao("Contatos: há contato repetido");
  }
  return lista;
}

export function lerNegocio(input: Entrada, { criacao }: { criacao: boolean }): DadosNegocio {
  if (!criacao && input.empresaId !== undefined) {
    throw regraViolada("Negócio não troca de empresa — crie um novo negócio");
  }
  const dados: DadosNegocio = {
    titulo: textoObrigatorio(input, "titulo", "Título", { criacao: false, max: 150 }),
    empresaId: lerId(input, "empresaId", "Empresa") ?? undefined,
    etapaId: lerId(input, "etapaId", "Etapa") ?? undefined,
    valor: lerValor(input),
    previsaoFechamento: lerData(input, "previsaoFechamento", "Previsão de fechamento"),
    origem: opcao(input, "origem", "Origem", ORIGENS),
    observacao: texto(input, "observacao", "Observação", 5000),
    arquivado: booleano(input, "arquivado", "Arquivado"),
    motivoPerdaId: lerId(input, "motivoPerdaId", "Motivo de perda"),
    motivoPerdaDetalhe: texto(input, "motivoPerdaDetalhe", "Detalhe do motivo", 1000),
    depoisDe: lerId(input, "depoisDe", "Posição"),
    contatos: lerContatos(input),
  };
  if (criacao && !dados.empresaId) throw erroValidacao("Empresa é obrigatória");
  return dados;
}

const detalhe = {
  empresa: { select: { id: true, nome: true, status: true } },
  etapa: true,
  pipeline: { select: { id: true, nome: true } },
  motivoPerda: true,
  contatos: { include: { contato: { select: { id: true, nome: true, cargo: true, email: true, telefone: true } } } },
  historico: {
    orderBy: { em: "desc" },
    include: { deEtapa: { select: { nome: true } }, paraEtapa: { select: { nome: true } } },
  },
} as const;

export async function obterNegocio(id: string) {
  const negocio = await prisma.negocio.findUnique({ where: { id }, include: detalhe });
  if (!negocio) throw naoEncontrado("Negócio não encontrado");
  return negocio;
}

export type FiltroNegocios = {
  pipelineId?: string;
  empresaId?: string;
  status?: StatusNegocio;
  busca?: string;
  arquivados?: boolean;
  /** Kanban: abertos + os fechados nos últimos N dias (colunas Ganho/Perdido não crescem para sempre). */
  fechadosDias?: number;
};

export async function listarNegocios({
  pipelineId,
  empresaId,
  status,
  busca,
  arquivados = false,
  fechadosDias,
}: FiltroNegocios) {
  return prisma.negocio.findMany({
    where: {
      arquivadoEm: arquivados ? { not: null } : null,
      ...(pipelineId ? { pipelineId } : {}),
      ...(empresaId ? { empresaId } : {}),
      ...(status ? { status } : {}),
      AND: [
        fechadosDias !== undefined
          ? {
              OR: [
                { status: "ABERTO" },
                { fechadoEm: { gte: new Date(Date.now() - fechadosDias * 86_400_000) } },
              ],
            }
          : {},
        busca
          ? {
              OR: [
                { titulo: { contains: busca, mode: "insensitive" } },
                { empresa: { nome: { contains: busca, mode: "insensitive" } } },
                { contatos: { some: { contato: { nome: { contains: busca, mode: "insensitive" } } } } },
              ],
            }
          : {},
      ],
    },
    orderBy: [{ rank: "asc" }, { id: "asc" }],
    include: {
      empresa: { select: { id: true, nome: true } },
      contatos: { include: { contato: { select: { id: true, nome: true } } } },
    },
  });
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

async function exigirEtapa(tx: Tx, etapaId: string) {
  const etapa = await tx.etapa.findUnique({ where: { id: etapaId }, include: { pipeline: true } });
  if (!etapa) throw naoEncontrado("Etapa não encontrada");
  if (etapa.pipeline.arquivadoEm) throw regraViolada("O pipeline desta etapa está arquivado");
  return etapa;
}

async function exigirMotivoAtivo(tx: Tx, motivoId: string) {
  const motivo = await tx.motivoPerda.findUnique({ where: { id: motivoId } });
  if (!motivo) throw naoEncontrado("Motivo de perda não encontrado");
  if (!motivo.ativo) throw regraViolada("Motivo de perda desativado");
}

/** Rank para colocar o card logo abaixo de `depoisDe` (null = topo) ou no fim da etapa. */
async function calcularRank(
  tx: Tx,
  etapaId: string,
  depoisDe: string | null | undefined,
  ignorarId?: string,
): Promise<string> {
  const rank = await rankNaPosicao(tx, etapaId, depoisDe, ignorarId);
  if (rank.length <= RANK_TAMANHO_MAX) return rank;

  const coluna = await tx.negocio.findMany({
    where: { etapaId, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
    orderBy: [{ rank: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const novos = ranksEspacados(coluna.length);
  for (const [i, { id }] of coluna.entries()) {
    await tx.negocio.update({ where: { id }, data: { rank: novos[i] } });
  }
  return rankNaPosicao(tx, etapaId, depoisDe, ignorarId);
}

async function rankNaPosicao(tx: Tx, etapaId: string, depoisDe: string | null | undefined, ignorarId?: string) {
  const outros = ignorarId ? { id: { not: ignorarId } } : {};

  if (depoisDe === undefined) {
    const ultimo = await tx.negocio.findFirst({
      where: { etapaId, ...outros },
      orderBy: [{ rank: "desc" }, { id: "desc" }],
      select: { rank: true },
    });
    return rankEntre(ultimo?.rank ?? null, null);
  }

  let antes: string | null = null;
  if (depoisDe !== null) {
    const ref = await tx.negocio.findUnique({ where: { id: depoisDe }, select: { rank: true, etapaId: true } });
    if (!ref || ref.etapaId !== etapaId || depoisDe === ignorarId) {
      throw erroValidacao("Posição: o card de referência não está nesta etapa");
    }
    antes = ref.rank;
  }
  const seguinte = await tx.negocio.findFirst({
    where: { etapaId, ...outros, ...(antes !== null ? { rank: { gt: antes } } : {}) },
    orderBy: [{ rank: "asc" }, { id: "asc" }],
    select: { rank: true },
  });
  return rankEntre(antes, seguinte?.rank ?? null);
}

async function validarContatos(tx: Tx, empresaId: string, contatos: NonNullable<DadosNegocio["contatos"]>) {
  if (!contatos.length) return;
  const encontrados = await tx.contato.findMany({
    where: { id: { in: contatos.map((c) => c.contatoId) } },
    select: { id: true, empresaId: true, nome: true },
  });
  if (encontrados.length !== contatos.length) throw naoEncontrado("Contato não encontrado");
  const deOutra = encontrados.find((c) => c.empresaId && c.empresaId !== empresaId);
  if (deOutra) throw regraViolada(`"${deOutra.nome}" é contato de outra empresa`);
}

/** Campos de fechamento conforme o tipo da etapa de destino. */
async function camposDeFechamento(
  tx: Tx,
  tipo: "ABERTA" | "GANHO" | "PERDIDO",
  dados: DadosNegocio,
  motivoAtual: string | null,
) {
  if (tipo === "ABERTA") {
    if (dados.motivoPerdaId) throw regraViolada("Motivo de perda só vale para negócio perdido");
    return { fechadoEm: null, motivoPerdaId: null, motivoPerdaDetalhe: null };
  }
  if (tipo === "GANHO") {
    if (dados.motivoPerdaId) throw regraViolada("Motivo de perda só vale para negócio perdido");
    return { fechadoEm: new Date(), motivoPerdaId: null, motivoPerdaDetalhe: null };
  }
  const motivoPerdaId = dados.motivoPerdaId ?? motivoAtual;
  if (!motivoPerdaId) throw regraViolada("Informe o motivo da perda");
  await exigirMotivoAtivo(tx, motivoPerdaId);
  return { fechadoEm: new Date(), motivoPerdaId, motivoPerdaDetalhe: dados.motivoPerdaDetalhe ?? null };
}

async function promoverACliente(tx: Tx, empresaId: string) {
  await tx.empresa.updateMany({
    where: { id: empresaId, status: { not: "CLIENTE" } },
    data: { status: "CLIENTE" },
  });
}

export async function criarNegocio(dados: DadosNegocio) {
  const id = await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.findUnique({
      where: { id: dados.empresaId as string },
      include: { contatos: { where: { principal: true, arquivadoEm: null }, select: { id: true } } },
    });
    if (!empresa) throw naoEncontrado("Empresa não encontrada");
    if (empresa.arquivadaEm) throw regraViolada("Não é possível criar negócio para empresa arquivada");

    const etapa = dados.etapaId
      ? await exigirEtapa(tx, dados.etapaId)
      : (await pipelinePadrao(tx)).etapas.find((e) => e.tipo === "ABERTA")!;

    const contatos = dados.contatos ?? empresa.contatos.map((c) => ({ contatoId: c.id, papel: null }));
    await validarContatos(tx, empresa.id, contatos);

    const fechamento = await camposDeFechamento(tx, etapa.tipo, dados, null);
    const valor = dados.valor ?? "0";
    const agora = new Date();

    const negocio = await tx.negocio.create({
      data: {
        titulo: dados.titulo ?? empresa.nome,
        empresaId: empresa.id,
        pipelineId: etapa.pipelineId,
        etapaId: etapa.id,
        status: STATUS_POR_TIPO[etapa.tipo],
        valor,
        previsaoFechamento: dados.previsaoFechamento ?? null,
        origem: dados.origem === undefined ? empresa.origem : dados.origem,
        observacao: dados.observacao ?? null,
        rank: await calcularRank(tx, etapa.id, dados.depoisDe),
        etapaDesde: agora,
        ...fechamento,
        contatos: { create: contatos },
        historico: { create: { paraEtapaId: etapa.id, paraTipo: etapa.tipo, valor, em: agora } },
      },
    });
    if (etapa.tipo === "GANHO") await promoverACliente(tx, empresa.id);
    return negocio.id;
  });
  return obterNegocio(id);
}

export async function atualizarNegocio(id: string, dados: DadosNegocio) {
  await prisma.$transaction(async (tx) => {
    const atual = await tx.negocio.findUnique({ where: { id }, include: { etapa: true } });
    if (!atual) throw naoEncontrado("Negócio não encontrado");

    const destino = dados.etapaId && dados.etapaId !== atual.etapaId ? await exigirEtapa(tx, dados.etapaId) : null;
    const tipo = destino?.tipo ?? atual.etapa.tipo;
    const data: Prisma.NegocioUncheckedUpdateInput = {
      titulo: dados.titulo,
      valor: dados.valor,
      previsaoFechamento: dados.previsaoFechamento,
      origem: dados.origem,
      observacao: dados.observacao,
      arquivadoEm: dados.arquivado === undefined ? undefined : dados.arquivado ? new Date() : null,
    };

    if (destino) {
      const agora = new Date();
      Object.assign(data, {
        etapaId: destino.id,
        pipelineId: destino.pipelineId,
        status: STATUS_POR_TIPO[destino.tipo],
        etapaDesde: agora,
        rank: await calcularRank(tx, destino.id, dados.depoisDe, id),
        ...(await camposDeFechamento(tx, destino.tipo, dados, null)),
      });
      await tx.historicoEtapa.create({
        data: {
          negocioId: id,
          deEtapaId: atual.etapaId,
          paraEtapaId: destino.id,
          paraTipo: destino.tipo,
          valor: dados.valor ?? atual.valor,
          em: agora,
        },
      });
      if (destino.tipo === "GANHO") await promoverACliente(tx, atual.empresaId);
    } else {
      if (dados.depoisDe !== undefined) data.rank = await calcularRank(tx, atual.etapaId, dados.depoisDe, id);
      // Editar o motivo de um negócio que já está perdido.
      if (dados.motivoPerdaId !== undefined || dados.motivoPerdaDetalhe !== undefined) {
        if (tipo !== "PERDIDO") throw regraViolada("Motivo de perda só vale para negócio perdido");
        if (dados.motivoPerdaId === null) throw regraViolada("Negócio perdido precisa de motivo");
        if (dados.motivoPerdaId) await exigirMotivoAtivo(tx, dados.motivoPerdaId);
        data.motivoPerdaId = dados.motivoPerdaId;
        data.motivoPerdaDetalhe = dados.motivoPerdaDetalhe;
      }
    }

    if (dados.contatos) {
      await validarContatos(tx, atual.empresaId, dados.contatos);
      await tx.negocioContato.deleteMany({ where: { negocioId: id } });
      await tx.negocioContato.createMany({ data: dados.contatos.map((c) => ({ ...c, negocioId: id })) });
    }

    await tx.negocio.update({ where: { id }, data });
  });
  return obterNegocio(id);
}
