"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { chamar, ErroApi, mensagemDeErro } from "@/lib/cliente";
import {
  ORIGENS,
  ORIGEM_LABEL,
  STATUS_EMPRESA,
  STATUS_EMPRESA_LABEL,
  type Duplicado,
  type Empresa,
} from "@/lib/empresas";
import { formatTelefone } from "@/lib/format";
import Duplicados from "./Duplicados";
import { alterados } from "./formulario";
import { Erro, Modal } from "./ui";

type Props = { empresa?: Empresa; onFechar: () => void; onSalvo: (empresa: Empresa) => void };

export default function EmpresaFormModal({ empresa, onFechar, onSalvo }: Props) {
  const router = useRouter();
  const [inicial] = useState(() => ({
    nome: empresa?.nome ?? "",
    segmento: empresa?.segmento ?? "",
    status: empresa?.status ?? "PROSPECT",
    origem: empresa?.origem ?? "",
    cnpj: empresa?.cnpj ?? "",
    telefone: empresa?.telefone ? formatTelefone(empresa.telefone) : "",
    email: empresa?.email ?? "",
    site: empresa?.site ?? "",
    instagram: empresa?.instagram ? `@${empresa.instagram}` : "",
    endereco: empresa?.endereco ?? "",
    cidade: empresa?.cidade ?? "",
    uf: empresa?.uf ?? "",
    observacao: empresa?.observacao ?? "",
  }));
  const [form, setForm] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [duplicados, setDuplicados] = useState<Duplicado[] | null>(null);

  function campo(nome: keyof typeof form) {
    return {
      value: form[nome],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((atual) => ({ ...atual, [nome]: e.target.value }));
        setDuplicados(null);
      },
    };
  }

  async function salvar(forcar = false) {
    setSalvando(true);
    setErro(null);
    try {
      const salva = await chamar<Empresa>(empresa ? `/api/empresas/${empresa.id}` : "/api/empresas", {
        method: empresa ? "PATCH" : "POST",
        body: {
          ...alterados(form, empresa ? inicial : null),
          // Origem é enum: vazio vira null em vez de string vazia.
          ...(!empresa || form.origem !== inicial.origem ? { origem: form.origem || null } : {}),
          forcar,
        },
      });
      onSalvo(salva);
    } catch (e) {
      if (e instanceof ErroApi && e.duplicados) setDuplicados(e.duplicados);
      else setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={empresa ? "Editar empresa" : "Nova empresa"} onFechar={onFechar} largura="max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <label className="label">Nome *</label>
          <input className="input" required autoFocus {...campo("nome")} />
        </div>
        <div>
          <label className="label">Segmento</label>
          <input className="input" placeholder="Pizzaria, escola, e-commerce…" {...campo("segmento")} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" {...campo("status")}>
            {STATUS_EMPRESA.map((s) => (
              <option key={s} value={s}>
                {STATUS_EMPRESA_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Origem</label>
          <select className="input" {...campo("origem")}>
            <option value="">—</option>
            {ORIGENS.map((o) => (
              <option key={o} value={o}>
                {ORIGEM_LABEL[o]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">CNPJ</label>
          <input className="input" placeholder="00.000.000/0000-00" {...campo("cnpj")} />
        </div>
        <div>
          <label className="label">Telefone</label>
          <input className="input" placeholder="(11) 98765-4321" {...campo("telefone")} />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input className="input" type="email" {...campo("email")} />
        </div>
        <div>
          <label className="label">Site</label>
          <input className="input" placeholder="empresa.com.br" {...campo("site")} />
        </div>
        <div>
          <label className="label">Instagram</label>
          <input className="input" placeholder="@empresa" {...campo("instagram")} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Endereço</label>
          <input className="input" {...campo("endereco")} />
        </div>
        <div>
          <label className="label">Cidade</label>
          <input className="input" {...campo("cidade")} />
        </div>
        <div>
          <label className="label">UF</label>
          <input className="input" maxLength={2} {...campo("uf")} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Observação</label>
          <textarea className="input" rows={3} {...campo("observacao")} />
        </div>

        <div className="sm:col-span-2">
          {duplicados ? (
            <Duplicados
              duplicados={duplicados}
              tipo="empresa"
              onUsar={empresa ? undefined : (d) => router.push(`/empresas/${d.id}`)}
              onForcar={() => salvar(true)}
            />
          ) : null}
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
