"use client";

import { useState } from "react";
import { ESTAGIOS, ESTAGIO_LABEL, type Estagio, type Lead } from "@/lib/leads";
import { api } from "@/lib/basePath";

type Props = {
  lead?: Lead;
  onFechar: () => void;
  onSalvo: (lead: Lead) => void;
};

export default function LeadFormModal({ lead, onFechar, onSalvo }: Props) {
  const [form, setForm] = useState({
    nome: lead?.nome ?? "",
    empresa: lead?.empresa ?? "",
    email: lead?.email ?? "",
    telefone: lead?.telefone ?? "",
    origem: lead?.origem ?? "",
    responsavel: lead?.responsavel ?? "",
    valor: lead?.valor ?? "",
    estagio: (lead?.estagio ?? "NOVO") as Estagio,
    observacao: lead?.observacao ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function campo(nome: keyof typeof form) {
    return {
      value: form[nome] as string,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
      ) => setForm((atual) => ({ ...atual, [nome]: e.target.value })),
    };
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!form.nome.trim()) {
      setErro("Informe o nome do lead");
      return;
    }

    setSalvando(true);
    setErro(null);

    const resposta = await fetch(api(lead ? `/api/leads/${lead.id}` : "/api/leads"), {
      method: lead ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, valor: form.valor === "" ? null : form.valor }),
    });

    setSalvando(false);

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => null);
      setErro(corpo?.error ?? "Não foi possível salvar");
      return;
    }

    onSalvo(await resposta.json());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onFechar}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={salvar}
        className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5"
      >
        <h2 className="text-lg font-semibold">{lead ? "Editar lead" : "Novo lead"}</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nome *</label>
            <input className="input" required {...campo("nome")} />
          </div>
          <div>
            <label className="label">Empresa</label>
            <input className="input" {...campo("empresa")} />
          </div>
          <div>
            <label className="label">Responsável</label>
            <input className="input" {...campo("responsavel")} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" {...campo("email")} />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input className="input" {...campo("telefone")} />
          </div>
          <div>
            <label className="label">Origem</label>
            <input className="input" placeholder="Instagram, indicação…" {...campo("origem")} />
          </div>
          <div>
            <label className="label">Valor estimado (R$)</label>
            <input className="input" type="number" min="0" step="0.01" {...campo("valor")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Estágio</label>
            <select className="input" {...campo("estagio")}>
              {ESTAGIOS.map((estagio) => (
                <option key={estagio} value={estagio}>
                  {ESTAGIO_LABEL[estagio]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Observação</label>
            <textarea className="input" rows={3} {...campo("observacao")} />
          </div>
        </div>

        {erro ? <p className="mt-3 text-sm text-red-500">{erro}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
