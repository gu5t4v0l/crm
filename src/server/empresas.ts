import { prisma } from "@/lib/db";
import { ORIGENS, STATUS_EMPRESA, type Duplicado, type StatusEmpresa } from "@/lib/empresas";
import {
  chaveNome,
  dominioDoSite,
  ehLinkInstagram,
  normalizarCnpj,
  normalizarEmail,
  normalizarInstagram,
  normalizarTelefone,
  normalizarUf,
} from "@/lib/normalizar";
import { conflito, erroValidacao, naoEncontrado, regraViolada } from "@/server/erros";
import { booleano, definidos, normalizado, opcao, texto, textoObrigatorio } from "@/server/validacao";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Regras de Empresa:
 * - CNPJ é único (conflito sem exceção).
 * - Telefone, Instagram, domínio do site ou nome iguais indicam possível duplicata: 409 com a lista,
 *   e o cliente reenvia com `forcar: true` se for mesmo outra empresa. Arquivadas também contam,
 *   para não recadastrar algo que já foi descartado.
 * - Arquivar é soft delete (arquivadaEm) e é bloqueado com negócio aberto.
 *   Não existe exclusão física pela API.
 */

export type DadosEmpresa = Partial<{
  nome: string;
  segmento: string | null;
  status: StatusEmpresa;
  origem: (typeof ORIGENS)[number] | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  dominio: string | null;
  instagram: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  observacao: string | null;
  arquivadaEm: Date | null;
}>;

export function lerEmpresa(input: Record<string, unknown>, { criacao }: { criacao: boolean }): DadosEmpresa {
  const site = texto(input, "site", "Site");
  let instagram = normalizado(input, "instagram", "Instagram", normalizarInstagram);
  // Link do Instagram colado no campo site (comum no Maps) vira o @ da empresa.
  if (site && ehLinkInstagram(site) && !instagram) {
    instagram = normalizado({ instagram: site }, "instagram", "Instagram", normalizarInstagram);
  }

  const arquivada = booleano(input, "arquivada", "Arquivada");
  const status = opcao(input, "status", "Status", STATUS_EMPRESA);
  if (status === null) throw erroValidacao("Status é obrigatório");

  return definidos({
    nome: textoObrigatorio(input, "nome", "Nome", { criacao }),
    segmento: texto(input, "segmento", "Segmento", 100),
    status,
    origem: opcao(input, "origem", "Origem", ORIGENS),
    cnpj: normalizado(input, "cnpj", "CNPJ", normalizarCnpj),
    telefone: normalizado(input, "telefone", "Telefone", normalizarTelefone),
    email: normalizado(input, "email", "E-mail", normalizarEmail),
    site,
    dominio: site === undefined ? undefined : site === null ? null : dominioDoSite(site),
    instagram,
    endereco: texto(input, "endereco", "Endereço"),
    cidade: texto(input, "cidade", "Cidade", 100),
    uf: normalizado(input, "uf", "UF", normalizarUf),
    observacao: texto(input, "observacao", "Observação", 5000),
    arquivadaEm: arquivada === undefined ? undefined : arquivada ? new Date() : null,
  });
}

export async function encontrarDuplicadas(dados: DadosEmpresa, ignorarId?: string): Promise<Duplicado[]> {
  const criterios: [Duplicado["motivo"], Prisma.EmpresaWhereInput | null][] = [
    ["cnpj", dados.cnpj ? { cnpj: dados.cnpj } : null],
    ["telefone", dados.telefone ? { telefone: dados.telefone } : null],
    ["instagram", dados.instagram ? { instagram: dados.instagram } : null],
    ["dominio", dados.dominio ? { dominio: dados.dominio } : null],
    // Pré-filtro no banco pela primeira palavra; a comparação exata é pela chave sem acento/pontuação.
    ["nome", dados.nome ? { nome: { contains: dados.nome.split(/\s+/)[0], mode: "insensitive" } } : null],
  ];

  const encontrados = new Map<string, Duplicado>();
  for (const [motivo, where] of criterios) {
    if (!where) continue;
    const empresas = await prisma.empresa.findMany({
      where: { ...where, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
      select: { id: true, nome: true, arquivadaEm: true },
      take: 20,
    });
    for (const e of empresas) {
      if (motivo === "nome" && chaveNome(e.nome) !== chaveNome(dados.nome as string)) continue;
      if (!encontrados.has(e.id)) {
        encontrados.set(e.id, { id: e.id, nome: e.nome, motivo, arquivado: e.arquivadaEm !== null });
      }
    }
  }
  return [...encontrados.values()];
}

async function barrarDuplicadas(dados: DadosEmpresa, forcar: boolean, ignorarId?: string) {
  const duplicadas = await encontrarDuplicadas(dados, ignorarId);
  const porCnpj = duplicadas.find((d) => d.motivo === "cnpj");
  if (porCnpj) {
    throw conflito(`CNPJ já cadastrado em "${porCnpj.nome}"`, [porCnpj]);
  }
  if (duplicadas.length && !forcar) {
    throw conflito("Possível empresa duplicada", duplicadas);
  }
}

export type FiltroEmpresas = { busca?: string; status?: StatusEmpresa; arquivadas?: boolean };

export async function listarEmpresas({ busca, status, arquivadas = false }: FiltroEmpresas) {
  const digitos = busca?.replace(/\D/g, "");
  return prisma.empresa.findMany({
    where: {
      arquivadaEm: arquivadas ? { not: null } : null,
      ...(status ? { status } : {}),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" } },
              { segmento: { contains: busca, mode: "insensitive" } },
              { cidade: { contains: busca, mode: "insensitive" } },
              { instagram: { contains: busca.replace(/^@/, ""), mode: "insensitive" } },
              ...(digitos && digitos.length >= 4
                ? [{ telefone: { contains: digitos } }, { cnpj: { contains: digitos } }]
                : []),
              {
                contatos: {
                  some: {
                    OR: [
                      { nome: { contains: busca, mode: "insensitive" } },
                      { email: { contains: busca, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      _count: { select: { contatos: { where: { arquivadoEm: null } } } },
      contatos: { where: { arquivadoEm: null, principal: true }, take: 1 },
    },
  });
}

export async function obterEmpresa(id: string) {
  const empresa = await prisma.empresa.findUnique({
    where: { id },
    include: {
      contatos: {
        where: { arquivadoEm: null },
        orderBy: [{ principal: "desc" }, { nome: "asc" }],
      },
    },
  });
  if (!empresa) throw naoEncontrado("Empresa não encontrada");
  return empresa;
}

export async function criarEmpresa(dados: DadosEmpresa, { forcar = false } = {}) {
  await barrarDuplicadas(dados, forcar);
  return prisma.empresa.create({ data: { ...dados, nome: dados.nome as string } });
}

export async function atualizarEmpresa(id: string, dados: DadosEmpresa, { forcar = false } = {}) {
  const atual = await prisma.empresa.findUnique({ where: { id }, select: { id: true } });
  if (!atual) throw naoEncontrado("Empresa não encontrada");

  // Só checa duplicata dos campos que estão mudando.
  const { cnpj, telefone, instagram, dominio, nome } = dados;
  if ([cnpj, telefone, instagram, dominio, nome].some((v) => v)) {
    await barrarDuplicadas({ cnpj, telefone, instagram, dominio, nome }, forcar, id);
  }

  if (dados.arquivadaEm) {
    const abertos = await prisma.negocio.count({ where: { empresaId: id, status: "ABERTO", arquivadoEm: null } });
    if (abertos) throw regraViolada(`Empresa tem ${abertos} negócio(s) aberto(s) — feche ou arquive antes`);
  }

  await prisma.empresa.update({ where: { id }, data: dados });
  return obterEmpresa(id);
}
