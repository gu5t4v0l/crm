"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chamar, mensagemDeErro } from "@/lib/cliente";
import { diasDesde, formatCurrency, formatDate } from "@/lib/format";
import {
  STATUS_POR_TIPO,
  corDaEtapa,
  valorPonderado,
  type Etapa,
  type Negocio,
  type Pipeline,
} from "@/lib/negocios";
import { rankEntre } from "@/lib/rank";
import MotivoPerdaModal from "./MotivoPerdaModal";
import NegocioDrawer from "./NegocioDrawer";
import NegocioFormModal from "./NegocioFormModal";
import { Erro } from "./ui";

/** Ganho/Perdido mostram só os fechados recentes; o histórico completo fica nas métricas. */
const FECHADOS_DIAS = 30;
/** A partir de quantos dias parado na etapa o card ganha destaque. */
const DIAS_ALERTA = 14;

type Alvo = { etapaId: string; indice: number };
type Movimento = { negocioId: string; etapaId: string; indice: number };

export default function NegociosBoard() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [versao, setVersao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [perdaPendente, setPerdaPendente] = useState<Movimento | null>(null);
  const colunasRef = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    chamar<Pipeline[]>("/api/pipelines")
      .then((lista) => {
        setPipelines(lista);
        setPipelineId((atual) => atual ?? lista[0]?.id ?? null);
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, []);

  useEffect(() => {
    if (!pipelineId) return;
    let cancelado = false;

    async function carregar() {
      try {
        const params = new URLSearchParams({ pipelineId: pipelineId!, fechadosDias: String(FECHADOS_DIAS) });
        if (buscaAplicada) params.set("busca", buscaAplicada);
        const dados = await chamar<Negocio[]>(`/api/negocios?${params}`);
        if (!cancelado) {
          setNegocios(dados);
          setErro(null);
        }
      } catch (e) {
        if (!cancelado) setErro(mensagemDeErro(e));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [pipelineId, buscaAplicada, versao]);

  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? null;
  const etapas = useMemo(() => pipeline?.etapas ?? [], [pipeline]);

  const colunas = useMemo(() => {
    const mapa = new Map<string, Negocio[]>(etapas.map((e) => [e.id, []]));
    for (const negocio of negocios) mapa.get(negocio.etapaId)?.push(negocio);
    for (const lista of mapa.values()) {
      lista.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.id < b.id ? -1 : 1));
    }
    return mapa;
  }, [negocios, etapas]);

  const abertos = negocios.filter((n) => n.status === "ABERTO");
  const totalAberto = abertos.reduce((acc, n) => acc + Number(n.valor), 0);
  const previsao = abertos.reduce(
    (acc, n) => acc + valorPonderado(n.valor, etapas.find((e) => e.id === n.etapaId)?.probabilidade ?? null),
    0,
  );

  /** Índice de inserção pela posição do mouse em relação ao meio de cada card. */
  function indiceNaColuna(etapaId: string, clientY: number) {
    const coluna = colunasRef.current.get(etapaId);
    if (!coluna) return 0;
    const cards = [...coluna.querySelectorAll<HTMLElement>("[data-negocio]")].filter(
      (el) => el.dataset.negocio !== arrastando,
    );
    const indice = cards.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return clientY < r.top + r.height / 2;
    });
    return indice === -1 ? cards.length : indice;
  }

  async function mover({ negocioId, etapaId, indice }: Movimento, extra: Record<string, unknown> = {}) {
    const atual = negocios.find((n) => n.id === negocioId);
    const etapa = etapas.find((e) => e.id === etapaId);
    if (!atual || !etapa) return;

    const lista = (colunas.get(etapaId) ?? []).filter((n) => n.id !== negocioId);
    const antes = lista[indice - 1] ?? null;
    const depois = lista[indice] ?? null;
    const mudouEtapa = atual.etapaId !== etapaId;
    if (!mudouEtapa && (colunas.get(etapaId) ?? []).indexOf(atual) === indice) return;

    // Atualização otimista; o servidor é a fonte da verdade e recarregamos em seguida.
    let rank = atual.rank;
    try {
      rank = rankEntre(antes?.rank ?? null, depois?.rank ?? null);
    } catch {
      // Ranks iguais/fora de ordem no cliente: deixa o servidor decidir.
    }
    const anterior = negocios;
    setNegocios((ns) =>
      ns.map((n) =>
        n.id === negocioId
          ? { ...n, etapaId, rank, status: STATUS_POR_TIPO[etapa.tipo], etapaDesde: mudouEtapa ? new Date().toISOString() : n.etapaDesde }
          : n,
      ),
    );

    try {
      await chamar(`/api/negocios/${negocioId}`, {
        method: "PATCH",
        body: { ...(mudouEtapa ? { etapaId } : {}), depoisDe: antes?.id ?? null, ...extra },
      });
      setVersao((v) => v + 1);
    } catch (e) {
      setNegocios(anterior);
      setErro(mensagemDeErro(e));
      throw e;
    }
  }

  function soltar(etapa: Etapa, clientY: number) {
    const negocioId = arrastando;
    setArrastando(null);
    setAlvo(null);
    if (!negocioId) return;
    const movimento = { negocioId, etapaId: etapa.id, indice: indiceNaColuna(etapa.id, clientY) };
    const atual = negocios.find((n) => n.id === negocioId);
    if (etapa.tipo === "PERDIDO" && atual?.etapaId !== etapa.id) {
      setPerdaPendente(movimento);
    } else {
      mover(movimento).catch(() => {});
    }
  }

  function aplicarBusca(evento: React.FormEvent) {
    evento.preventDefault();
    setCarregando(true);
    setBuscaAplicada(busca.trim());
  }

  const negocioPerdendo = perdaPendente ? negocios.find((n) => n.id === perdaPendente.negocioId) : null;

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Negócios</h1>
            {pipelines.length > 1 ? (
              <select
                className="input w-auto py-1"
                value={pipelineId ?? ""}
                onChange={(e) => {
                  setCarregando(true);
                  setPipelineId(e.target.value);
                }}
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <p className="text-sm opacity-70">
            {abertos.length} aberto{abertos.length === 1 ? "" : "s"} · {formatCurrency(totalAberto)} em aberto ·
            previsão ponderada {formatCurrency(previsao)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={aplicarBusca} className="flex items-center gap-2">
            <input
              className="input w-56"
              placeholder="Buscar negócio, empresa, contato…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <button type="submit" className="btn-ghost">
              Buscar
            </button>
          </form>
          <button type="button" className="btn-primary" onClick={() => setNovoAberto(true)} disabled={!pipeline}>
            + Novo negócio
          </button>
        </div>
      </div>

      <Erro>{erro}</Erro>

      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {etapas.map((etapa) => {
          const lista = colunas.get(etapa.id) ?? [];
          const total = lista.reduce((acc, n) => acc + Number(n.valor), 0);
          // Posição do marcador conta só os outros cards (o arrastado continua visível, esmaecido).
          const outros = lista.filter((n) => n.id !== arrastando).length;
          let posicao = 0;
          const indiceAlvo = alvo?.etapaId === etapa.id ? alvo.indice : null;
          const fechada = etapa.tipo !== "ABERTA";

          return (
            <section
              key={etapa.id}
              onDragOver={(e) => {
                e.preventDefault();
                const indice = indiceNaColuna(etapa.id, e.clientY);
                if (alvo?.etapaId !== etapa.id || alvo.indice !== indice) setAlvo({ etapaId: etapa.id, indice });
              }}
              onDrop={(e) => {
                e.preventDefault();
                soltar(etapa, e.clientY);
              }}
              className={`card flex min-h-64 w-72 shrink-0 flex-col p-3 transition ${
                indiceAlvo !== null ? "ring-2 ring-brand-teal" : ""
              }`}
            >
              <header className="mb-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: corDaEtapa(etapa) }} />
                  {etapa.nome}
                </span>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium">{lista.length}</span>
              </header>
              <p className="mb-3 text-xs opacity-60">
                {formatCurrency(total)}
                {fechada
                  ? ` · últimos ${FECHADOS_DIAS} dias`
                  : etapa.probabilidade !== null
                    ? ` · ${etapa.probabilidade}% de chance`
                    : ""}
              </p>

              <div
                ref={(el) => {
                  if (el) colunasRef.current.set(etapa.id, el);
                  else colunasRef.current.delete(etapa.id);
                }}
                className="flex flex-1 flex-col gap-2"
              >
                {lista.map((negocio) => {
                  const i = negocio.id === arrastando ? -1 : posicao++;
                  const dias = diasDesde(negocio.etapaDesde);
                  const contato = negocio.contatos?.[0]?.contato.nome;
                  return (
                    <div key={negocio.id}>
                      {indiceAlvo === i ? <Marcador /> : null}
                      <article
                        data-negocio={negocio.id}
                        draggable
                        onDragStart={(e) => {
                          setArrastando(negocio.id);
                          e.dataTransfer.setData("text/plain", negocio.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setArrastando(null);
                          setAlvo(null);
                        }}
                        onClick={() => setSelecionado(negocio.id)}
                        className={`cursor-pointer rounded-lg border border-surface-border bg-surface-muted p-3 text-left transition hover:border-brand-teal ${
                          arrastando === negocio.id ? "opacity-50" : ""
                        }`}
                      >
                        <p className="text-sm font-semibold">{negocio.titulo}</p>
                        {negocio.empresa && negocio.empresa.nome !== negocio.titulo ? (
                          <p className="text-xs opacity-70">{negocio.empresa.nome}</p>
                        ) : null}
                        {contato ? <p className="text-xs opacity-60">{contato}</p> : null}
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-brand-teal">{formatCurrency(negocio.valor)}</span>
                          {fechada ? (
                            <span className="opacity-60">{formatDate(negocio.fechadoEm)}</span>
                          ) : (
                            <span
                              className={dias >= DIAS_ALERTA ? "font-semibold text-amber-500" : "opacity-60"}
                              title="Dias nesta etapa"
                            >
                              {dias === 0 ? "hoje" : `há ${dias}d`}
                            </span>
                          )}
                        </div>
                      </article>
                    </div>
                  );
                })}
                {indiceAlvo !== null && indiceAlvo >= outros ? <Marcador /> : null}

                {!lista.length && !carregando ? <p className="p-3 text-center text-xs opacity-40">Arraste negócios para cá</p> : null}
              </div>
            </section>
          );
        })}
      </div>

      {carregando ? <p className="mt-2 text-sm opacity-60">Carregando…</p> : null}

      {novoAberto && pipeline ? (
        <NegocioFormModal
          pipeline={pipeline}
          onFechar={() => setNovoAberto(false)}
          onSalvo={() => {
            setNovoAberto(false);
            setVersao((v) => v + 1);
          }}
        />
      ) : null}

      {selecionado ? (
        <NegocioDrawer
          negocioId={selecionado}
          etapas={etapas}
          onFechar={() => setSelecionado(null)}
          onAlterado={() => setVersao((v) => v + 1)}
        />
      ) : null}

      {perdaPendente && negocioPerdendo ? (
        <MotivoPerdaModal
          titulo={negocioPerdendo.titulo}
          onFechar={() => setPerdaPendente(null)}
          onConfirmar={async (motivoPerdaId, motivoPerdaDetalhe) => {
            await mover(perdaPendente, { motivoPerdaId, motivoPerdaDetalhe });
            setPerdaPendente(null);
          }}
        />
      ) : null}
    </main>
  );
}

function Marcador() {
  return <div className="my-1 h-0.5 rounded-full bg-brand-teal" />;
}
