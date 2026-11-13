"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chamar, mensagemDeErro } from "@/lib/cliente";
import { formatCurrency, formatNumero } from "@/lib/format";
import type { Pipeline } from "@/lib/negocios";
import type { Metricas } from "@/server/metricas";
import { Erro } from "./ui";

/** Todas as séries aqui são magnitude de uma medida só: uma cor, a da marca (segue o tema). */
const COR = "var(--brand-teal)";
const EIXO = { fontSize: 12, fill: "currentColor", opacity: 0.7 };
const TOOLTIP = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--surface-border)",
    borderRadius: 8,
    color: "var(--foreground)",
    fontSize: 12,
  },
  cursor: { fill: "var(--surface-muted)" },
};

export default function MetricasView() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    chamar<Pipeline[]>("/api/pipelines").then(setPipelines).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelado = false;
    chamar<Metricas>(`/api/metricas${pipelineId ? `?pipelineId=${pipelineId}` : ""}`)
      .then((m) => !cancelado && setMetricas(m))
      .catch((e) => !cancelado && setErro(mensagemDeErro(e)));
    return () => {
      cancelado = true;
    };
  }, [pipelineId]);

  if (erro) return <main className="p-6"><Erro>{erro}</Erro></main>;
  if (!metricas) return <p className="p-6 text-sm opacity-60">Carregando métricas…</p>;

  const funil = metricas.etapas.filter((e) => e.tipo !== "PERDIDO");
  const tempos = metricas.etapas.filter((e) => e.diasMedios !== null).map((e) => ({ ...e, dias: Number(e.diasMedios!.toFixed(1)) }));

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Métricas</h1>
        {pipelines.length > 1 ? (
          <select className="input w-auto py-1" value={pipelineId || metricas.pipeline.id} onChange={(e) => setPipelineId(e.target.value)}>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Cartao
          titulo="Em aberto"
          valor={formatCurrency(metricas.abertos.valor)}
          rodape={`${metricas.abertos.quantidade} negócio(s)${metricas.parados ? ` · ${metricas.parados} parado(s) há 14+ dias` : ""}`}
        />
        <Cartao titulo="Previsão ponderada" valor={formatCurrency(metricas.previsaoPonderada)} rodape="Valor × chance da etapa" />
        <Cartao titulo="Ganho" valor={formatCurrency(metricas.ganhos.valor)} rodape={`${metricas.ganhos.quantidade} negócio(s)`} />
        <Cartao titulo="Ticket médio" valor={formatCurrency(metricas.ticketMedio)} rodape="Dos negócios ganhos" />
        <Cartao
          titulo="Taxa de conversão"
          valor={metricas.taxaConversao === null ? "—" : `${formatNumero(metricas.taxaConversao)}%`}
          rodape={
            metricas.cicloMedioDias !== null
              ? `Ciclo médio: ${formatNumero(metricas.cicloMedioDias)} dias`
              : "Sem negócios fechados ainda"
          }
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Grafico titulo="Quantos chegaram a cada etapa" vazio={!metricas.total}>
          <BarChart data={funil}>
            <XAxis dataKey="nome" tick={EIXO} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={EIXO} tickLine={false} axisLine={false} width={32} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="alcance" name="Negócios" fill={COR} radius={[4, 4, 0, 0]} maxBarSize={56} />
          </BarChart>
        </Grafico>

        <Grafico titulo="Dias médios em cada etapa" vazio={!tempos.length}>
          <BarChart data={tempos} layout="vertical" margin={{ left: 8 }}>
            <XAxis type="number" tick={EIXO} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="nome" tick={EIXO} tickLine={false} axisLine={false} width={100} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="dias" name="Dias" fill={COR} radius={[0, 4, 4, 0]} maxBarSize={28} />
          </BarChart>
        </Grafico>

        <Grafico titulo="Motivos de perda" vazio={!metricas.motivosPerda.length} textoVazio="Nenhum negócio perdido ainda.">
          <BarChart data={metricas.motivosPerda} layout="vertical" margin={{ left: 8 }}>
            <XAxis type="number" allowDecimals={false} tick={EIXO} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="nome" tick={EIXO} tickLine={false} axisLine={false} width={140} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="quantidade" name="Negócios" fill={COR} radius={[0, 4, 4, 0]} maxBarSize={28} />
          </BarChart>
        </Grafico>

        <Grafico titulo="Origem dos negócios" vazio={!metricas.origens.length}>
          <BarChart data={metricas.origens} layout="vertical" margin={{ left: 8 }}>
            <XAxis type="number" allowDecimals={false} tick={EIXO} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="nome" tick={EIXO} tickLine={false} axisLine={false} width={110} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="quantidade" name="Negócios" fill={COR} radius={[0, 4, 4, 0]} maxBarSize={28} />
          </BarChart>
        </Grafico>
      </div>

      <section className="card mt-6 overflow-x-auto p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Por etapa</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left opacity-60">
              <th className="py-2">Etapa</th>
              <th className="py-2">Negócios agora</th>
              <th className="py-2">Valor agora</th>
              <th className="py-2">Chegaram</th>
              <th className="py-2">Dias médios</th>
            </tr>
          </thead>
          <tbody>
            {metricas.etapas.map((e) => (
              <tr key={e.id} className="border-t border-surface-border">
                <td className="py-2">{e.nome}</td>
                <td className="py-2">{e.quantidade}</td>
                <td className="py-2">{formatCurrency(e.valor)}</td>
                <td className="py-2">{e.alcance}</td>
                <td className="py-2">{e.diasMedios === null ? "—" : formatNumero(e.diasMedios)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Grafico({
  titulo,
  vazio,
  textoVazio = "Sem dados ainda.",
  children,
}: {
  titulo: string;
  vazio: boolean;
  textoVazio?: string;
  children: React.ReactElement;
}) {
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">{titulo}</h2>
      <div className="mt-4 h-64">
        {vazio ? (
          <p className="text-sm opacity-60">{textoVazio}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function Cartao({ titulo, valor, rodape }: { titulo: string; valor: string; rodape?: string }) {
  return (
    <div className="card p-4">
      <p className="label">{titulo}</p>
      <p className="text-xl font-semibold">{valor}</p>
      {rodape ? <p className="mt-1 text-xs opacity-60">{rodape}</p> : null}
    </div>
  );
}
