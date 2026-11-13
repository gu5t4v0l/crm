"use client";

import { useState } from "react";
import { chamar, ErroApi, mensagemDeErro } from "@/lib/cliente";
import type { Contato, Duplicado } from "@/lib/empresas";
import { formatTelefone } from "@/lib/format";
import Duplicados from "./Duplicados";
import { alterados } from "./formulario";
import { Erro, Modal } from "./ui";

type Props = {
  contato?: Contato;
  empresaId: string | null;
  onFechar: () => void;
  onSalvo: (contato: Contato) => void;
};

export default function ContatoFormModal({ contato, empresaId, onFechar, onSalvo }: Props) {
  const [inicial] = useState(() => ({
    nome: contato?.nome ?? "",
    cargo: contato?.cargo ?? "",
    email: contato?.email ?? "",
    telefone: contato?.telefone ? formatTelefone(contato.telefone) : "",
    observacao: contato?.observacao ?? "",
  }));
  const [form, setForm] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [duplicados, setDuplicados] = useState<Duplicado[] | null>(null);

  function campo(nome: keyof typeof form) {
    return {
      value: form[nome],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm((atual) => ({ ...atual, [nome]: e.target.value }));
        setDuplicados(null);
      },
    };
  }

  async function salvar(forcar = false) {
    setSalvando(true);
    setErro(null);
    try {
      const salvo = await chamar<Contato>(contato ? `/api/contatos/${contato.id}` : "/api/contatos", {
        method: contato ? "PATCH" : "POST",
        body: { ...alterados(form, contato ? inicial : null), ...(contato ? {} : { empresaId }), forcar },
      });
      onSalvo(salvo);
    } catch (e) {
      if (e instanceof ErroApi && e.duplicados) setDuplicados(e.duplicados);
      else setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={contato ? "Editar contato" : "Novo contato"} onFechar={onFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        <div>
          <label className="label">Nome *</label>
          <input className="input" required autoFocus {...campo("nome")} />
        </div>
        <div>
          <label className="label">Cargo</label>
          <input className="input" placeholder="Sócio, gerente…" {...campo("cargo")} />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input className="input" type="email" {...campo("email")} />
        </div>
        <div>
          <label className="label">Telefone / WhatsApp</label>
          <input className="input" placeholder="(11) 98765-4321" {...campo("telefone")} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Observação</label>
          <textarea className="input" rows={2} {...campo("observacao")} />
        </div>
        <div className="sm:col-span-2">
          {duplicados ? <Duplicados duplicados={duplicados} tipo="contato" onForcar={() => salvar(true)} /> : null}
          <Erro>{erro}</Erro>
          <div className="mt-3 flex justify-end gap-2">
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
