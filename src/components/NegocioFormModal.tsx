"use client";

import { useState } from "react";
import { chamar, mensagemDeErro } from "@/lib/cliente";
import { ORIGENS, ORIGEM_LABEL, type Origem } from "@/lib/empresas";
import type { Negocio, Pipeline } from "@/lib/negocios";
import EmpresaSelect from "./EmpresaSelect";
import { Erro, Modal } from "./ui";

type Props = {
  /** Edição: os campos de etapa/empresa ficam de fora (mover é no quadro/painel). */
  negocio?: Negocio;
  /** Criação: pipeline em que o negócio entra (etapas abertas viram opções). */
  pipeline?: Pipeline;
  /** Criação a partir da ficha da empresa. */
  empresaFixa?: { id: string; nome: string };
  onFechar: () => void;
  onSalvo: (negocio: Negocio) => void;
};

export default function NegocioFormModal({ negocio, pipeline, empresaFixa, onFechar, onSalvo }: Props) {
  const abertas = pipeline?.etapas.filter((e) => e.tipo === "ABERTA") ?? [];
  const [empresa, setEmpresa] = useState(empresaFixa ?? null);
  const [form, setForm] = useState({
    titulo: negocio?.titulo ?? "",
    valor: negocio ? String(Number(negocio.valor) || "") : "",
    previsaoFechamento: negocio?.previsaoFechamento?.slice(0, 10) ?? "",
    origem: (negocio?.origem ?? "") as Origem | "",
    observacao: negocio?.observacao ?? "",
    etapaId: abertas[0]?.id ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function campo(nome: keyof typeof form) {
    return {
      value: form[nome],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((atual) => ({ ...atual, [nome]: e.target.value })),
    };
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!negocio && !empresa) {
      setErro("Escolha a empresa");
      return;
    }
    setSalvando(true);
    setErro(null);
    const corpo = {
      titulo: form.titulo.trim() || (negocio ? negocio.titulo : undefined),
      valor: form.valor === "" ? 0 : form.valor,
      previsaoFechamento: form.previsaoFechamento || null,
      observacao: form.observacao,
      // Na criação, sem origem escolhida o servidor herda a da empresa.
      ...(form.origem || negocio ? { origem: form.origem || null } : {}),
      ...(negocio ? {} : { empresaId: empresa!.id, etapaId: form.etapaId || undefined }),
    };
    try {
      const salvo = await chamar<Negocio>(negocio ? `/api/negocios/${negocio.id}` : "/api/negocios", {
        method: negocio ? "PATCH" : "POST",
        body: corpo,
      });
      onSalvo(salvo);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={negocio ? "Editar negócio" : "Novo negócio"} onFechar={onFechar}>
      <form onSubmit={salvar} className="mt-4 grid gap-3 sm:grid-cols-2">
        {!negocio ? (
          <div className="sm:col-span-2">
            <label className="label">Empresa *</label>
            {empresaFixa ? (
              <p className="rounded-lg border border-surface-border px-3 py-2 text-sm font-medium">{empresaFixa.nome}</p>
            ) : (
              <EmpresaSelect valor={empresa} onChange={setEmpresa} />
            )}
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <label className="label">Título</label>
          <input
            className="input"
            placeholder={empresa ? `Padrão: ${empresa.nome}` : "Ex.: Site institucional"}
            {...campo("titulo")}
          />
        </div>
        <div>
          <label className="label">Valor (R$)</label>
          <input className="input" type="number" min="0" step="0.01" {...campo("valor")} />
        </div>
        <div>
          <label className="label">Previsão de fechamento</label>
          <input className="input" type="date" {...campo("previsaoFechamento")} />
        </div>
        {!negocio && abertas.length ? (
          <div>
            <label className="label">Etapa</label>
            <select className="input" {...campo("etapaId")}>
              {abertas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label className="label">Origem</label>
          <select className="input" {...campo("origem")}>
            <option value="">{negocio ? "—" : "Mesma da empresa"}</option>
            {ORIGENS.map((o) => (
              <option key={o} value={o}>
                {ORIGEM_LABEL[o]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Observação</label>
          <textarea className="input" rows={3} {...campo("observacao")} />
        </div>
        <div className="sm:col-span-2">
          <Erro>{erro}</Erro>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onFechar}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
