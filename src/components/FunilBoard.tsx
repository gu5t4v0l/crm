"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ESTAGIOS,
  ESTAGIO_COR,
  ESTAGIO_LABEL,
  type Estagio,
  type Lead,
} from "@/lib/leads";
import { formatCurrency } from "@/lib/format";
import LeadDrawer from "./LeadDrawer";
import LeadFormModal from "./LeadFormModal";
import { api } from "@/lib/basePath";

export default function FunilBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<Estagio | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const query = buscaAplicada ? `?busca=${encodeURIComponent(buscaAplicada)}` : "";
        const resposta = await fetch(api(`/api/leads${query}`));
        if (!resposta.ok) throw new Error("Falha ao carregar leads");
        const dados = await resposta.json();
        if (!cancelado) {
          setLeads(dados);
          setErro(null);
        }
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Erro inesperado");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [buscaAplicada]);

  const colunas = useMemo(() => {
    const mapa = new Map<Estagio, Lead[]>(ESTAGIOS.map((e) => [e, [] as Lead[]]));
    for (const lead of leads) {
      mapa.get(lead.estagio)?.push(lead);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.posicao - b.posicao);
    }
    return mapa;
  }, [leads]);

  async function moverLead(id: string, estagio: Estagio) {
    const anterior = leads;
    setLeads((atual) =>
      atual.map((lead) => (lead.id === id ? { ...lead, estagio } : lead)),
    );

    const resposta = await fetch(api(`/api/leads/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estagio }),
    });

    if (!resposta.ok) {
      setLeads(anterior);
      setErro("Não foi possível mover o lead");
      return;
    }

    const atualizado: Lead = await resposta.json();
    setLeads((atual) => atual.map((lead) => (lead.id === id ? atualizado : lead)));
  }

  function aplicarBusca(evento: React.FormEvent) {
    evento.preventDefault();
    setCarregando(true);
    setBuscaAplicada(busca.trim());
  }

  const leadSelecionado = leads.find((lead) => lead.id === selecionado) ?? null;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Funil de vendas</h1>
          <p className="text-sm opacity-70">
            {leads.length} lead{leads.length === 1 ? "" : "s"} no quadro
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={aplicarBusca} className="flex items-center gap-2">
            <input
              className="input w-56"
              placeholder="Buscar nome, empresa, e-mail…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <button type="submit" className="btn-ghost">
              Buscar
            </button>
          </form>
          <button type="button" className="btn-primary" onClick={() => setNovoAberto(true)}>
            + Novo lead
          </button>
        </div>
      </div>

      {erro ? (
        <p className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {erro}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {ESTAGIOS.map((estagio) => {
          const lista = colunas.get(estagio) ?? [];
          const total = lista.reduce((acc, lead) => acc + Number(lead.valor ?? 0), 0);

          return (
            <section
              key={estagio}
              onDragOver={(e) => {
                e.preventDefault();
                setColunaAlvo(estagio);
              }}
              onDragLeave={() => setColunaAlvo((atual) => (atual === estagio ? null : atual))}
              onDrop={(e) => {
                e.preventDefault();
                setColunaAlvo(null);
                const id = arrastando ?? e.dataTransfer.getData("text/plain");
                setArrastando(null);
                const lead = leads.find((l) => l.id === id);
                if (lead && lead.estagio !== estagio) moverLead(id, estagio);
              }}
              className={`card flex min-h-64 flex-col p-3 transition ${
                colunaAlvo === estagio ? "ring-2 ring-brand-teal" : ""
              }`}
            >
              <header className="mb-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: ESTAGIO_COR[estagio] }}
                  />
                  {ESTAGIO_LABEL[estagio]}
                </span>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium">
                  {lista.length}
                </span>
              </header>

              <p className="mb-3 text-xs opacity-60">{formatCurrency(total)}</p>

              <div className="flex flex-1 flex-col gap-2">
                {lista.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      setArrastando(lead.id);
                      e.dataTransfer.setData("text/plain", lead.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setArrastando(null)}
                    onClick={() => setSelecionado(lead.id)}
                    className={`cursor-pointer rounded-lg border border-surface-border bg-surface-muted p-3 text-left transition hover:border-brand-teal ${
                      arrastando === lead.id ? "opacity-50" : ""
                    }`}
                  >
                    <p className="text-sm font-semibold">{lead.nome}</p>
                    {lead.empresa ? (
                      <p className="text-xs opacity-70">{lead.empresa}</p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-brand-teal">
                        {formatCurrency(lead.valor)}
                      </span>
                      {lead.origem ? <span className="opacity-60">{lead.origem}</span> : null}
                    </div>
                  </article>
                ))}

                {!lista.length && !carregando ? (
                  <p className="rounded-lg border border-dashed border-surface-border p-3 text-center text-xs opacity-50">
                    Arraste leads para cá
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {carregando ? <p className="mt-4 text-sm opacity-60">Carregando…</p> : null}

      {novoAberto ? (
        <LeadFormModal
          onFechar={() => setNovoAberto(false)}
          onSalvo={(lead) => {
            setLeads((atual) => [...atual, lead]);
            setNovoAberto(false);
          }}
        />
      ) : null}

      {leadSelecionado ? (
        <LeadDrawer
          lead={leadSelecionado}
          onFechar={() => setSelecionado(null)}
          onAtualizado={(lead) =>
            setLeads((atual) => atual.map((l) => (l.id === lead.id ? lead : l)))
          }
          onRemovido={(id) => {
            setLeads((atual) => atual.filter((l) => l.id !== id));
            setSelecionado(null);
          }}
        />
      ) : null}
    </main>
  );
}
