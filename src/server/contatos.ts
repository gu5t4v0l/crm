import { prisma } from "@/lib/db";
import type { Duplicado } from "@/lib/empresas";
import { chaveNome, normalizarEmail, normalizarTelefone } from "@/lib/normalizar";
import { conflito, erroValidacao, naoEncontrado, regraViolada } from "@/server/erros";
import { booleano, definidos, normalizado, texto, textoObrigatorio } from "@/server/validacao";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Regras de Contato:
 * - E-mail é único (mesma pessoa); telefone ou nome repetido na mesma empresa pede `forcar: true`.
 * - Só se vincula a empresa ativa (não arquivada).
 * - Empresa com contatos ativos tem exatamente um principal. O primeiro contato vira principal;
 *   arquivar ou mover o principal promove outro (o mais antigo).
 * - Arquivar é soft delete.
 */

type Tx = Prisma.TransactionClient;

export type DadosContato = Partial<{
  empresaId: string | null;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  principal: boolean;
  observacao: string | null;
  arquivadoEm: Date | null;
}>;

export function lerContato(input: Record<string, unknown>, { criacao }: { criacao: boolean }): DadosContato {
  const empresaId = input.empresaId;
  if (empresaId !== undefined && empresaId !== null && typeof empresaId !== "string") {
    throw erroValidacao("Empresa inválida");
  }
  const arquivado = booleano(input, "arquivado", "Arquivado");

  return definidos({
    empresaId: empresaId === "" ? null : (empresaId as string | null | undefined),
    nome: textoObrigatorio(input, "nome", "Nome", { criacao }),
    cargo: texto(input, "cargo", "Cargo", 100),
    email: normalizado(input, "email", "E-mail", normalizarEmail),
    telefone: normalizado(input, "telefone", "Telefone", normalizarTelefone),
    principal: booleano(input, "principal", "Principal"),
    observacao: texto(input, "observacao", "Observação", 5000),
    arquivadoEm: arquivado === undefined ? undefined : arquivado ? new Date() : null,
  });
}

const comEmpresa = { empresa: { select: { id: true, nome: true } } } as const;

async function exigirEmpresaAtiva(empresaId: string) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { arquivadaEm: true },
  });
  if (!empresa) throw naoEncontrado("Empresa não encontrada");
  if (empresa.arquivadaEm) throw regraViolada("Não é possível vincular contato a empresa arquivada");
}

async function barrarDuplicados(
  dados: { email?: string | null; telefone?: string | null; nome?: string; empresaId?: string | null },
  forcar: boolean,
  ignorarId?: string,
) {
  const outro = ignorarId ? { id: { not: ignorarId } } : {};

  if (dados.email) {
    const mesmoEmail = await prisma.contato.findFirst({ where: { email: dados.email, ...outro } });
    if (mesmoEmail) {
      throw conflito(`E-mail já cadastrado para "${mesmoEmail.nome}"`, [
        { id: mesmoEmail.id, nome: mesmoEmail.nome, motivo: "email", arquivado: !!mesmoEmail.arquivadoEm },
      ] satisfies Duplicado[]);
    }
  }
  if (forcar) return;

  const duplicados: Duplicado[] = [];
  if (dados.telefone) {
    const mesmos = await prisma.contato.findMany({ where: { telefone: dados.telefone, ...outro }, take: 10 });
    duplicados.push(...mesmos.map((c) => ({ id: c.id, nome: c.nome, motivo: "telefone" as const, arquivado: !!c.arquivadoEm })));
  }
  if (dados.nome && dados.empresaId) {
    const mesmos = await prisma.contato.findMany({ where: { empresaId: dados.empresaId, ...outro } });
    duplicados.push(
      ...mesmos
        .filter((c) => chaveNome(c.nome) === chaveNome(dados.nome as string) && !duplicados.some((d) => d.id === c.id))
        .map((c) => ({ id: c.id, nome: c.nome, motivo: "nome" as const, arquivado: !!c.arquivadoEm })),
    );
  }
  if (duplicados.length) throw conflito("Possível contato duplicado", duplicados);
}

/**
 * Garante exatamente um principal entre os contatos ativos da empresa, preferindo `preferidoId`
 * e evitando `evitarId` (quem acabou de ser desmarcado), salvo se for o único.
 */
async function reconciliarPrincipal(
  tx: Tx,
  empresaId: string,
  { preferidoId, evitarId }: { preferidoId?: string; evitarId?: string } = {},
) {
  const ativos = await tx.contato.findMany({
    where: { empresaId, arquivadoEm: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, principal: true },
  });
  if (!ativos.length) return;

  const escolhido =
    ativos.find((c) => c.id === preferidoId) ??
    ativos.find((c) => c.principal) ??
    ativos.find((c) => c.id !== evitarId) ??
    ativos[0];

  await tx.contato.updateMany({
    where: { empresaId, principal: true, id: { not: escolhido.id } },
    data: { principal: false },
  });
  if (!escolhido.principal) {
    await tx.contato.update({ where: { id: escolhido.id }, data: { principal: true } });
  }
}

export type FiltroContatos = { busca?: string; empresaId?: string; arquivados?: boolean };

export async function listarContatos({ busca, empresaId, arquivados = false }: FiltroContatos) {
  const digitos = busca?.replace(/\D/g, "");
  return prisma.contato.findMany({
    where: {
      ...(arquivados
        ? { arquivadoEm: { not: null } }
        : { arquivadoEm: null, OR: [{ empresaId: null }, { empresa: { arquivadaEm: null } }] }),
      ...(empresaId ? { empresaId } : {}),
      ...(busca
        ? {
            AND: {
              OR: [
                { nome: { contains: busca, mode: "insensitive" } },
                { email: { contains: busca, mode: "insensitive" } },
                { cargo: { contains: busca, mode: "insensitive" } },
                { empresa: { nome: { contains: busca, mode: "insensitive" } } },
                ...(digitos && digitos.length >= 4 ? [{ telefone: { contains: digitos } }] : []),
              ],
            },
          }
        : {}),
    },
    orderBy: [{ nome: "asc" }],
    include: comEmpresa,
  });
}

export async function obterContato(id: string) {
  const contato = await prisma.contato.findUnique({ where: { id }, include: comEmpresa });
  if (!contato) throw naoEncontrado("Contato não encontrado");
  return contato;
}

export async function criarContato(dados: DadosContato, { forcar = false } = {}) {
  if (dados.empresaId) await exigirEmpresaAtiva(dados.empresaId);
  await barrarDuplicados(dados, forcar);

  const id = await prisma.$transaction(async (tx) => {
    const contato = await tx.contato.create({
      data: { ...dados, nome: dados.nome as string, principal: false },
    });
    if (contato.empresaId) {
      await reconciliarPrincipal(tx, contato.empresaId, { preferidoId: dados.principal ? contato.id : undefined });
    }
    return contato.id;
  });
  return obterContato(id);
}

export async function atualizarContato(id: string, dados: DadosContato, { forcar = false } = {}) {
  const atual = await prisma.contato.findUnique({ where: { id } });
  if (!atual) throw naoEncontrado("Contato não encontrado");

  const empresaId = dados.empresaId === undefined ? atual.empresaId : dados.empresaId;
  if (dados.empresaId && dados.empresaId !== atual.empresaId) await exigirEmpresaAtiva(dados.empresaId);

  if (dados.email || dados.telefone || dados.nome || dados.empresaId !== undefined) {
    await barrarDuplicados(
      { email: dados.email, telefone: dados.telefone, nome: dados.nome ?? atual.nome, empresaId },
      forcar,
      id,
    );
  }

  const { principal, ...resto } = dados;
  const arquivado = dados.arquivadoEm === undefined ? atual.arquivadoEm !== null : dados.arquivadoEm !== null;

  await prisma.$transaction(async (tx) => {
    // `principal` só é gravado pela reconciliação, para manter a regra de um por empresa.
    await tx.contato.update({
      where: { id },
      data: { ...resto, ...(arquivado || !empresaId || principal === false ? { principal: false } : {}) },
    });
    if (atual.empresaId && atual.empresaId !== empresaId) {
      await reconciliarPrincipal(tx, atual.empresaId);
    }
    if (empresaId) {
      await reconciliarPrincipal(tx, empresaId, {
        preferidoId: principal && !arquivado ? id : undefined,
        evitarId: principal === false ? id : undefined,
      });
    }
  });
  return obterContato(id);
}
