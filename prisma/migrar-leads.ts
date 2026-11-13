/**
 * Migra os leads do funil antigo para Empresa + Contato + Negócio.
 *
 *   npm run db:migrar-leads            → só mostra o plano (não grava nada)
 *   npm run db:migrar-leads -- --aplicar → grava tudo numa transação
 *
 * Regras do mapeamento (vieram da análise dos dados reais):
 * - `nome` é o nome da empresa. Se `empresa` começa com o nome e é mais completo
 *   ("Orbi" / "Orbi Produtora"), vira o nome; se é diferente ("Perfumes"), vira o segmento.
 * - `responsavel` é a pessoa no cliente; "Gabriel/Eunice" vira dois contatos.
 * - Telefone fica na empresa; origem em texto vira a lista fixa.
 * - Cria negócio se o lead saiu de NOVO ou tem valor. A observação vai para o negócio, se houver.
 * - A tabela Lead não é apagada: continua servindo o funil antigo até as telas novas.
 */
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { nomeESegmento, origemDeTexto, separarPessoas } from "../src/lib/empresas";
import { normalizarTelefone } from "../src/lib/normalizar";
import { rankEntre } from "../src/lib/rank";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "crm" }) });

const APLICAR = process.argv.includes("--aplicar");

/** Ids fixos criados pela migration 20261005020000_pipelines_negocios. */
const ETAPA_POR_ESTAGIO = {
  NOVO: { id: "etapa_novo", tipo: "ABERTA", status: "ABERTO" },
  CONTATO: { id: "etapa_contato", tipo: "ABERTA", status: "ABERTO" },
  PROPOSTA: { id: "etapa_proposta", tipo: "ABERTA", status: "ABERTO" },
  GANHO: { id: "etapa_ganho", tipo: "GANHO", status: "GANHO" },
  PERDIDO: { id: "etapa_perdido", tipo: "PERDIDO", status: "PERDIDO" },
} as const;
const PIPELINE_ID = "pipeline_vendas";
const MOTIVO_OUTRO = "motivo_outro";

async function main() {
  const [empresas, negocios, pipeline] = await Promise.all([
    prisma.empresa.count(),
    prisma.negocio.count(),
    prisma.pipeline.findUnique({ where: { id: PIPELINE_ID } }),
  ]);
  if (!pipeline) throw new Error("Pipeline padrão não existe — rode `npm run db:migrate` antes.");
  if (empresas || negocios) {
    throw new Error(`Já existem ${empresas} empresa(s) e ${negocios} negócio(s). A migração é feita uma vez só, em tabelas vazias.`);
  }

  const leads = await prisma.lead.findMany({
    orderBy: [{ estagio: "asc" }, { posicao: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { atividades: true } } },
  });
  const comAtividades = leads.filter((l) => l._count.atividades > 0);
  if (comAtividades.length) {
    throw new Error(`${comAtividades.length} lead(s) têm atividades — migre depois do módulo de Atividades.`);
  }

  const ultimoRank = new Map<string, string | null>();
  const plano = leads.map((lead) => {
    const { nome, segmento } = nomeESegmento(lead.nome, lead.empresa);
    let telefone: string | null = null;
    const avisos: string[] = [];
    try {
      telefone = lead.telefone ? normalizarTelefone(lead.telefone) : null;
    } catch {
      avisos.push(`telefone "${lead.telefone}" inválido, guardado na observação`);
    }

    const etapa = ETAPA_POR_ESTAGIO[lead.estagio];
    const criaNegocio = lead.estagio !== "NOVO" || lead.valor !== null;
    let rank: string | null = null;
    if (criaNegocio) {
      rank = rankEntre(ultimoRank.get(etapa.id) ?? null, null);
      ultimoRank.set(etapa.id, rank);
    }

    const observacao = [lead.observacao, avisos.length ? `Telefone original: ${lead.telefone}` : null]
      .filter(Boolean)
      .join("\n") || null;

    return { lead, nome, segmento, telefone, etapa, criaNegocio, rank, observacao, avisos, pessoas: separarPessoas(lead.responsavel) };
  });

  console.table(
    plano.map((p) => ({
      lead: p.lead.nome,
      empresa: p.nome,
      segmento: p.segmento ?? "",
      origem: origemDeTexto(p.lead.origem) ?? "",
      contatos: p.pessoas.join(", "),
      negocio: p.criaNegocio ? `R$ ${p.lead.valor ?? 0} · ${p.lead.estagio}` : "—",
      obs: p.observacao ? `${p.observacao.length} car. → ${p.criaNegocio ? "negócio" : "empresa"}` : "",
    })),
  );
  for (const p of plano) for (const aviso of p.avisos) console.warn(`⚠ ${p.lead.nome}: ${aviso}`);

  if (!APLICAR) {
    console.log("\nNada foi gravado. Para aplicar: npm run db:migrar-leads -- --aplicar");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const p of plano) {
      const { lead } = p;
      const empresa = await tx.empresa.create({
        data: {
          nome: p.nome,
          segmento: p.segmento,
          origem: origemDeTexto(lead.origem),
          telefone: p.telefone,
          status: lead.estagio === "GANHO" ? "CLIENTE" : "PROSPECT",
          observacao: p.criaNegocio ? null : p.observacao,
          createdAt: lead.createdAt,
        },
      });

      const contatos = [];
      for (const [i, pessoa] of p.pessoas.entries()) {
        contatos.push(
          await tx.contato.create({
            data: { nome: pessoa, empresaId: empresa.id, principal: i === 0, createdAt: lead.createdAt },
          }),
        );
      }

      if (!p.criaNegocio) continue;
      const fechado = p.etapa.tipo !== "ABERTA";
      const valor = lead.valor ?? 0;
      await tx.negocio.create({
        data: {
          titulo: p.nome,
          empresaId: empresa.id,
          pipelineId: PIPELINE_ID,
          etapaId: p.etapa.id,
          status: p.etapa.status,
          valor,
          origem: origemDeTexto(lead.origem),
          rank: p.rank as string,
          etapaDesde: fechado ? (lead.fechadoEm ?? lead.updatedAt) : lead.updatedAt,
          fechadoEm: fechado ? (lead.fechadoEm ?? lead.updatedAt) : null,
          motivoPerdaId: p.etapa.tipo === "PERDIDO" ? MOTIVO_OUTRO : null,
          motivoPerdaDetalhe: p.etapa.tipo === "PERDIDO" ? lead.perdidoMotivo : null,
          observacao: p.observacao,
          createdAt: lead.createdAt,
          contatos: { create: contatos.map((c) => ({ contatoId: c.id })) },
          // Sem histórico real no funil antigo: um registro da entrada na etapa atual.
          historico: { create: { paraEtapaId: p.etapa.id, paraTipo: p.etapa.tipo, valor, em: lead.updatedAt } },
        },
      });
    }
  });

  const [e, c, n] = await Promise.all([prisma.empresa.count(), prisma.contato.count(), prisma.negocio.count()]);
  console.log(`\nMigrados ${leads.length} lead(s): ${e} empresa(s), ${c} contato(s), ${n} negócio(s).`);
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
