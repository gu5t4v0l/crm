import { prisma } from "@/lib/db";
import { ranksEspacados } from "@/lib/rank";
import { erroValidacao, naoEncontrado, regraViolada } from "@/server/erros";
import { booleano, definidos, texto, textoObrigatorio } from "@/server/validacao";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Regras de Pipeline e Etapa:
 * - Existe sempre exatamente um pipeline padrão, e ele não pode ser arquivado.
 * - Pipeline com negócio aberto não pode ser arquivado.
 * - Todo pipeline tem pelo menos uma etapa ABERTA e exatamente uma GANHO e uma PERDIDO,
 *   que ficam sempre no fim. Só etapas ABERTA são criadas, reordenadas ou excluídas.
 * - Excluir etapa com negócios exige escolher a etapa de destino; eles são movidos com histórico.
 */

type Tx = Prisma.TransactionClient;

const comEtapas = { etapas: { orderBy: { ordem: "asc" } } } as const;

/** Etapas abertas padrão de um pipeline novo. */
const ETAPAS_INICIAIS = ["Novo", "Em contato", "Proposta"];

function probabilidade(input: Record<string, unknown>): number | null | undefined {
  const valor = input.probabilidade;
  if (valor === undefined || valor === null) return valor;
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 0 || valor > 100) {
    throw erroValidacao("Probabilidade deve ser um inteiro de 0 a 100");
  }
  return valor;
}

function cor(input: Record<string, unknown>): string | null | undefined {
  const valor = texto(input, "cor", "Cor", 7);
  if (valor && !/^#[0-9a-f]{6}$/i.test(valor)) throw erroValidacao("Cor deve ser hexadecimal (#rrggbb)");
  return valor;
}

export async function listarPipelines({ arquivados = false } = {}) {
  return prisma.pipeline.findMany({
    where: { arquivadoEm: arquivados ? { not: null } : null },
    orderBy: [{ padrao: "desc" }, { ordem: "asc" }, { createdAt: "asc" }],
    include: comEtapas,
  });
}

export async function obterPipeline(id: string) {
  const pipeline = await prisma.pipeline.findUnique({ where: { id }, include: comEtapas });
  if (!pipeline) throw naoEncontrado("Pipeline não encontrado");
  return pipeline;
}

export async function pipelinePadrao(tx: Tx = prisma) {
  const pipeline = await tx.pipeline.findFirst({ where: { padrao: true }, include: comEtapas });
  if (!pipeline) throw new Error("Nenhum pipeline padrão — a migration de pipelines não foi aplicada?");
  return pipeline;
}

export async function criarPipeline(input: Record<string, unknown>) {
  const nome = textoObrigatorio(input, "nome", "Nome", { criacao: true, max: 100 }) as string;
  let abertas = ETAPAS_INICIAIS;
  if (input.etapas !== undefined) {
    if (!Array.isArray(input.etapas) || !input.etapas.length || input.etapas.some((e) => typeof e !== "string" || !e.trim())) {
      throw erroValidacao("Etapas: informe ao menos um nome de etapa");
    }
    abertas = (input.etapas as string[]).map((e) => e.trim());
  }

  const existe = await prisma.pipeline.count({ where: { arquivadoEm: null } });
  const ultimo = await prisma.pipeline.aggregate({ _max: { ordem: true } });

  const pipeline = await prisma.pipeline.create({
    data: {
      nome,
      padrao: existe === 0,
      ordem: (ultimo._max.ordem ?? -1) + 1,
      etapas: {
        create: [
          ...abertas.map((nome, ordem) => ({ nome, ordem, tipo: "ABERTA" as const })),
          { nome: "Ganho", ordem: abertas.length, tipo: "GANHO" as const, probabilidade: 100 },
          { nome: "Perdido", ordem: abertas.length + 1, tipo: "PERDIDO" as const, probabilidade: 0 },
        ],
      },
    },
  });
  return obterPipeline(pipeline.id);
}

export async function atualizarPipeline(id: string, input: Record<string, unknown>) {
  const atual = await obterPipeline(id);
  const nome = textoObrigatorio(input, "nome", "Nome", { criacao: false, max: 100 });
  const padrao = booleano(input, "padrao", "Padrão");
  const arquivado = booleano(input, "arquivado", "Arquivado");

  if (padrao === false && atual.padrao) {
    throw regraViolada("Para trocar o padrão, marque outro pipeline como padrão");
  }
  if (padrao && arquivado) throw regraViolada("Pipeline arquivado não pode ser o padrão");
  if (padrao && atual.arquivadoEm && arquivado !== false) {
    throw regraViolada("Restaure o pipeline antes de torná-lo padrão");
  }
  if (arquivado) {
    if (atual.padrao) throw regraViolada("O pipeline padrão não pode ser arquivado");
    const abertos = await prisma.negocio.count({
      where: { pipelineId: id, status: "ABERTO", arquivadoEm: null },
    });
    if (abertos) throw regraViolada(`Pipeline tem ${abertos} negócio(s) aberto(s) — mova ou feche antes`);
  }

  await prisma.$transaction(async (tx) => {
    if (padrao) await tx.pipeline.updateMany({ where: { padrao: true }, data: { padrao: false } });
    await tx.pipeline.update({
      where: { id },
      data: definidos({
        nome,
        padrao: padrao || undefined,
        arquivadoEm: arquivado === undefined ? undefined : arquivado ? new Date() : null,
      }),
    });
  });
  return obterPipeline(id);
}

/** Regrava `ordem`: abertas na ordem dada, depois GANHO e PERDIDO. */
async function renumerar(tx: Tx, pipelineId: string, abertasEmOrdem: string[]) {
  const fechadas = await tx.etapa.findMany({
    where: { pipelineId, tipo: { not: "ABERTA" } },
    orderBy: { tipo: "asc" }, // enum: GANHO antes de PERDIDO
    select: { id: true },
  });
  const ids = [...abertasEmOrdem, ...fechadas.map((e) => e.id)];
  for (const [ordem, id] of ids.entries()) {
    await tx.etapa.update({ where: { id }, data: { ordem } });
  }
}

async function abertasDoPipeline(tx: Tx, pipelineId: string) {
  const etapas = await tx.etapa.findMany({
    where: { pipelineId, tipo: "ABERTA" },
    orderBy: { ordem: "asc" },
    select: { id: true },
  });
  return etapas.map((e) => e.id);
}

export async function criarEtapa(pipelineId: string, input: Record<string, unknown>) {
  await obterPipeline(pipelineId);
  const nome = textoObrigatorio(input, "nome", "Nome", { criacao: true, max: 60 }) as string;
  const posicao = input.posicao;
  if (posicao !== undefined && (typeof posicao !== "number" || !Number.isInteger(posicao) || posicao < 0)) {
    throw erroValidacao("Posição inválida");
  }

  await prisma.$transaction(async (tx) => {
    const abertas = await abertasDoPipeline(tx, pipelineId);
    const etapa = await tx.etapa.create({
      data: { pipelineId, nome, tipo: "ABERTA", ordem: 0, probabilidade: probabilidade(input), cor: cor(input) },
    });
    abertas.splice(Math.min((posicao as number | undefined) ?? abertas.length, abertas.length), 0, etapa.id);
    await renumerar(tx, pipelineId, abertas);
  });
  return obterPipeline(pipelineId);
}

export async function atualizarEtapa(id: string, input: Record<string, unknown>) {
  const etapa = await prisma.etapa.findUnique({ where: { id } });
  if (!etapa) throw naoEncontrado("Etapa não encontrada");
  await prisma.etapa.update({
    where: { id },
    data: definidos({
      nome: textoObrigatorio(input, "nome", "Nome", { criacao: false, max: 60 }),
      probabilidade: probabilidade(input),
      cor: cor(input),
    }),
  });
  return obterPipeline(etapa.pipelineId);
}

export async function reordenarEtapas(pipelineId: string, input: Record<string, unknown>) {
  await obterPipeline(pipelineId);
  const ids = input.etapaIds;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    throw erroValidacao("etapaIds deve ser a lista de ids das etapas abertas");
  }
  await prisma.$transaction(async (tx) => {
    const abertas = await abertasDoPipeline(tx, pipelineId);
    if (ids.length !== abertas.length || !abertas.every((id) => ids.includes(id))) {
      throw erroValidacao("etapaIds deve conter exatamente as etapas abertas do pipeline");
    }
    await renumerar(tx, pipelineId, ids as string[]);
  });
  return obterPipeline(pipelineId);
}

export async function excluirEtapa(id: string, moverParaId: string | null) {
  const etapa = await prisma.etapa.findUnique({ where: { id } });
  if (!etapa) throw naoEncontrado("Etapa não encontrada");
  if (etapa.tipo !== "ABERTA") throw regraViolada("As etapas Ganho e Perdido não podem ser excluídas");

  await prisma.$transaction(async (tx) => {
    const abertas = await abertasDoPipeline(tx, etapa.pipelineId);
    if (abertas.length === 1) throw regraViolada("O pipeline precisa de pelo menos uma etapa aberta");

    const negocios = await tx.negocio.findMany({
      where: { etapaId: id },
      orderBy: [{ rank: "asc" }, { id: "asc" }],
      select: { id: true, valor: true },
    });

    if (negocios.length) {
      if (!moverParaId) {
        throw regraViolada(`A etapa tem ${negocios.length} negócio(s) — escolha para qual etapa movê-los`);
      }
      if (moverParaId === id || !abertas.includes(moverParaId)) {
        throw erroValidacao("Etapa de destino deve ser outra etapa aberta do mesmo pipeline");
      }
      // Os movidos vão para o fim do destino; a coluna é renumerada de uma vez (chaves curtas).
      const destino = await tx.negocio.findMany({
        where: { etapaId: moverParaId },
        orderBy: [{ rank: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      const ordem = [...destino.map((n) => n.id), ...negocios.map((n) => n.id)];
      const ranks = ranksEspacados(ordem.length);
      const movidos = new Set(negocios.map((n) => n.id));
      const agora = new Date();
      for (const [i, negocioId] of ordem.entries()) {
        await tx.negocio.update({
          where: { id: negocioId },
          data: movidos.has(negocioId)
            ? { etapaId: moverParaId, rank: ranks[i], etapaDesde: agora }
            : { rank: ranks[i] },
        });
      }
      await tx.historicoEtapa.createMany({
        data: negocios.map((n) => ({
          negocioId: n.id,
          deEtapaId: id,
          paraEtapaId: moverParaId,
          paraTipo: "ABERTA" as const,
          valor: n.valor,
          em: agora,
        })),
      });
    }

    await tx.etapa.delete({ where: { id } });
    await renumerar(tx, etapa.pipelineId, abertas.filter((a) => a !== id));
  });
  return obterPipeline(etapa.pipelineId);
}

// ─── Motivos de perda ────────────────────────────────────────────────────────

export async function listarMotivos({ inativos = false } = {}) {
  return prisma.motivoPerda.findMany({
    where: inativos ? {} : { ativo: true },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });
}

export async function criarMotivo(input: Record<string, unknown>) {
  const nome = textoObrigatorio(input, "nome", "Nome", { criacao: true, max: 60 }) as string;
  if (await prisma.motivoPerda.findUnique({ where: { nome } })) {
    throw regraViolada("Já existe um motivo com esse nome");
  }
  const ultimo = await prisma.motivoPerda.aggregate({ _max: { ordem: true } });
  return prisma.motivoPerda.create({ data: { nome, ordem: (ultimo._max.ordem ?? -1) + 1 } });
}

/** Motivos não são excluídos (negócios antigos apontam para eles), só desativados. */
export async function atualizarMotivo(id: string, input: Record<string, unknown>) {
  if (!(await prisma.motivoPerda.findUnique({ where: { id } }))) throw naoEncontrado("Motivo não encontrado");
  const nome = textoObrigatorio(input, "nome", "Nome", { criacao: false, max: 60 });
  if (nome && (await prisma.motivoPerda.findFirst({ where: { nome, id: { not: id } } }))) {
    throw regraViolada("Já existe um motivo com esse nome");
  }
  return prisma.motivoPerda.update({
    where: { id },
    data: definidos({ nome, ativo: booleano(input, "ativo", "Ativo") }),
  });
}
