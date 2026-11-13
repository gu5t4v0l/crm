import { prisma } from "@/lib/db";
import { ORIGEM_LABEL } from "@/lib/empresas";
import { valorPonderado } from "@/lib/negocios";
import { naoEncontrado } from "@/server/erros";
import { pipelinePadrao } from "@/server/pipelines";

const DIA = 86_400_000;
/** Mesmo limite do destaque no quadro. */
const DIAS_PARADO = 14;

/**
 * Métricas de um pipeline, calculadas a partir dos negócios e do HistoricoEtapa.
 *
 * Alcance do funil: um negócio "chegou" a uma etapa se em algum momento esteve nela ou em
 * etapa posterior (funil sequencial). Isso cobre os negócios migrados, que só têm o registro
 * da etapa em que estavam. A etapa de Perdido não conta como avanço.
 */
export async function metricasDoPipeline(pipelineId?: string) {
  const pipeline = pipelineId
    ? await prisma.pipeline.findUnique({ where: { id: pipelineId }, include: { etapas: { orderBy: { ordem: "asc" } } } })
    : await pipelinePadrao();
  if (!pipeline) throw naoEncontrado("Pipeline não encontrado");

  const negocios = await prisma.negocio.findMany({
    where: { pipelineId: pipeline.id, arquivadoEm: null },
    include: { historico: { orderBy: { em: "asc" } }, motivoPerda: { select: { nome: true } } },
  });

  const etapaPorId = new Map(pipeline.etapas.map((e) => [e.id, e]));
  const abertos = negocios.filter((n) => n.status === "ABERTO");
  const ganhos = negocios.filter((n) => n.status === "GANHO");
  const perdidos = negocios.filter((n) => n.status === "PERDIDO");
  const soma = (lista: typeof negocios) => lista.reduce((acc, n) => acc + Number(n.valor), 0);

  // Alcance: maior ordem atingida por negócio (desconsiderando Perdido).
  const maiorOrdem = negocios.map((n) => {
    const ordens = [...n.historico.map((h) => h.paraEtapaId), n.etapaId]
      .map((id) => (id ? etapaPorId.get(id) : undefined))
      .filter((e) => e && e.tipo !== "PERDIDO")
      .map((e) => e!.ordem);
    return ordens.length ? Math.max(...ordens) : -1;
  });

  // Tempo em cada etapa: do registro de entrada até o próximo (ou até agora, se ainda está lá).
  const tempos = new Map<string, number[]>();
  for (const n of negocios) {
    n.historico.forEach((h, i) => {
      if (!h.paraEtapaId) return;
      const saida = n.historico[i + 1]?.em ?? (n.status === "ABERTO" ? new Date() : null);
      if (!saida) return;
      const lista = tempos.get(h.paraEtapaId) ?? [];
      lista.push((saida.getTime() - h.em.getTime()) / DIA);
      tempos.set(h.paraEtapaId, lista);
    });
  }
  const media = (xs: number[] | undefined) => (xs?.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const etapas = pipeline.etapas.map((etapa) => {
    const atuais = negocios.filter((n) => n.etapaId === etapa.id);
    return {
      id: etapa.id,
      nome: etapa.nome,
      tipo: etapa.tipo,
      quantidade: atuais.length,
      valor: soma(atuais),
      alcance: etapa.tipo === "PERDIDO" ? perdidos.length : maiorOrdem.filter((o) => o >= etapa.ordem).length,
      diasMedios: etapa.tipo === "ABERTA" ? media(tempos.get(etapa.id)) : null,
    };
  });

  const contar = <K extends string>(chaves: K[]) => {
    const mapa = new Map<K, number>();
    for (const k of chaves) mapa.set(k, (mapa.get(k) ?? 0) + 1);
    return [...mapa].map(([nome, quantidade]) => ({ nome, quantidade })).sort((a, b) => b.quantidade - a.quantidade);
  };

  const ciclos = ganhos
    .filter((n) => n.fechadoEm)
    .map((n) => Math.max(0, (n.fechadoEm!.getTime() - n.createdAt.getTime()) / DIA));

  return {
    pipeline: { id: pipeline.id, nome: pipeline.nome },
    total: negocios.length,
    abertos: { quantidade: abertos.length, valor: soma(abertos) },
    previsaoPonderada: abertos.reduce(
      (acc, n) => acc + valorPonderado(n.valor.toString(), etapaPorId.get(n.etapaId)?.probabilidade ?? null),
      0,
    ),
    parados: abertos.filter((n) => Date.now() - n.etapaDesde.getTime() >= DIAS_PARADO * DIA).length,
    ganhos: { quantidade: ganhos.length, valor: soma(ganhos) },
    perdidos: { quantidade: perdidos.length, valor: soma(perdidos) },
    ticketMedio: ganhos.length ? soma(ganhos) / ganhos.length : 0,
    taxaConversao: ganhos.length + perdidos.length ? (ganhos.length / (ganhos.length + perdidos.length)) * 100 : null,
    cicloMedioDias: media(ciclos),
    etapas,
    motivosPerda: contar(perdidos.map((n) => n.motivoPerda?.nome ?? "Sem motivo")),
    origens: contar(negocios.map((n) => (n.origem ? ORIGEM_LABEL[n.origem] : "Sem origem"))),
  };
}

export type Metricas = Awaited<ReturnType<typeof metricasDoPipeline>>;
