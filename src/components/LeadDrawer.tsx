"use client";

import { useEffect, useState } from "react";
import {
  ESTAGIOS,
  ESTAGIO_COR,
  ESTAGIO_LABEL,
  TIPOS_ATIVIDADE,
  TIPO_ATIVIDADE_LABEL,
  type Atividade,
  type Estagio,
  type Lead,
  type TipoAtividade,
} from "@/lib/leads";
import { formatCurrency, formatDateTime, toDateTimeInputValue } from "@/lib/format";
import LeadFormModal from "./LeadFormModal";
import { api } from "@/lib/basePath";

type Props = {
  lead: Lead;
  onFechar: () => void;
  onAtualizado: (lead: Lead) => void;
  onRemovido: (id: string) => void;
};

export default function LeadDrawer({ lead, onFechar, onAtualizado, onRemovido }: Props) {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [editando, setEditando] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TipoAtividade>("NOTA");
  const [dataHora, setDataHora] = useState(() => toDateTimeInputValue(new Date()));
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregarAtividades() {
      const resposta = await fetch(api(`/api/leads/${lead.id}/atividades`));
      if (!resposta.ok) return;
      const dados = await resposta.json();
      if (!cancelado) setAtividades(dados);
    }

    carregarAtividades();
    return () => {
      cancelado = true;
    };
  }, [lead.id]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  async function mudarEstagio(estagio: Estagio) {
    const resposta = await fetch(api(`/api/leads/${lead.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estagio }),
    });
    if (resposta.ok) onAtualizado(await resposta.json());
  }

  async function adicionarAtividade(evento: React.FormEvent) {
    evento.preventDefault();
    if (!descricao.trim()) return;

    const resposta = await fetch(api(`/api/leads/${lead.id}/atividades`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao,
        tipo,
        dataHora: new Date(dataHora).toISOString(),
      }),
    });

    if (!resposta.ok) {
      setErro("Não foi possível registrar a atividade");
      return;
    }

    const criada: Atividade = await resposta.json();
    setDescricao("");
    setErro(null);
    setAtividades((atual) => [criada, ...atual]);
  }

  async function alternarConcluida(atividade: Atividade) {
    const resposta = await fetch(api(`/api/atividades/${atividade.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concluida: !atividade.concluida }),
    });
    if (resposta.ok) {
      const atualizada: Atividade = await resposta.json();
      setAtividades((atual) => atual.map((a) => (a.id === atualizada.id ? atualizada : a)));
    }
  }

  async function removerAtividade(id: string) {
    await fetch(api(`/api/atividades/${id}`), { method: "DELETE" });
    setAtividades((atual) => atual.filter((a) => a.id !== id));
  }

  async function excluirLead() {
    if (!confirm(`Excluir o lead "${lead.nome}"? Essa ação não pode ser desfeita.`)) return;
    await fetch(api(`/api/leads/${lead.id}`), { method: "DELETE" });
    onRemovido(lead.id);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onFechar}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-surface-border bg-surface p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{lead.nome}</h2>
            {lead.empresa ? <p className="text-sm opacity-70">{lead.empresa}</p> : null}
          </div>
          <button type="button" className="btn-ghost" onClick={onFechar}>
            Fechar
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {ESTAGIOS.map((estagio) => (
            <button
              key={estagio}
              type="button"
              onClick={() => mudarEstagio(estagio)}
              className="rounded-full px-3 py-1 text-xs font-medium transition"
              style={
                lead.estagio === estagio
                  ? { background: ESTAGIO_COR[estagio], color: "#04221f" }
                  : { border: "1px solid var(--surface-border)" }
              }
            >
              {ESTAGIO_LABEL[estagio]}
            </button>
          ))}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Info titulo="Valor" valor={formatCurrency(lead.valor)} />
          <Info titulo="Origem" valor={lead.origem ?? "-"} />
          <Info titulo="E-mail" valor={lead.email ?? "-"} />
          <Info titulo="Telefone" valor={lead.telefone ?? "-"} />
          <Info titulo="Responsável" valor={lead.responsavel ?? "-"} />
          <Info titulo="Criado em" valor={formatDateTime(lead.createdAt)} />
        </dl>

        {lead.observacao ? (
          <p className="mt-4 rounded-lg bg-surface-muted p-3 text-sm">{lead.observacao}</p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => setEditando(true)}>
            Editar
          </button>
          <button
            type="button"
            className="btn-ghost text-red-500"
            onClick={excluirLead}
          >
            Excluir
          </button>
        </div>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide opacity-70">
          Atividades
        </h3>

        <form onSubmit={adicionarAtividade} className="mt-3 space-y-2">
          <div className="flex gap-2">
            <select
              className="input w-32"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoAtividade)}
            >
              {TIPOS_ATIVIDADE.map((t) => (
                <option key={t} value={t}>
                  {TIPO_ATIVIDADE_LABEL[t]}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="datetime-local"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
            />
          </div>
          <textarea
            className="input"
            rows={2}
            placeholder="O que aconteceu ou o que fazer…"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <button type="submit" className="btn-primary w-full">
            Registrar
          </button>
        </form>

        {erro ? <p className="mt-2 text-sm text-red-500">{erro}</p> : null}

        <ul className="mt-4 space-y-2 pb-6">
          {atividades.map((atividade) => (
            <li
              key={atividade.id}
              className="rounded-lg border border-surface-border p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2 text-xs opacity-70">
                <span className="font-semibold uppercase tracking-wide">
                  {TIPO_ATIVIDADE_LABEL[atividade.tipo]}
                </span>
                <span>{formatDateTime(atividade.dataHora)}</span>
              </div>
              <p className={`mt-1 ${atividade.concluida ? "line-through opacity-50" : ""}`}>
                {atividade.descricao}
              </p>
              <div className="mt-2 flex gap-3 text-xs">
                <button
                  type="button"
                  className="text-brand-teal"
                  onClick={() => alternarConcluida(atividade)}
                >
                  {atividade.concluida ? "Reabrir" : "Concluir"}
                </button>
                <button
                  type="button"
                  className="text-red-500"
                  onClick={() => removerAtividade(atividade.id)}
                >
                  Remover
                </button>
              </div>
            </li>
          ))}

          {!atividades.length ? (
            <li className="rounded-lg border border-dashed border-surface-border p-3 text-center text-xs opacity-50">
              Nenhuma atividade registrada
            </li>
          ) : null}
        </ul>

        {editando ? (
          <LeadFormModal
            lead={lead}
            onFechar={() => setEditando(false)}
            onSalvo={(atualizado) => {
              onAtualizado(atualizado);
              setEditando(false);
            }}
          />
        ) : null}
      </aside>
    </div>
  );
}

function Info({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="label">{titulo}</dt>
      <dd className="break-words">{valor}</dd>
    </div>
  );
}
