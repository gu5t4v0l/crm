"use client";

import { useEffect, useState } from "react";
import { chamar, ErroApi, mensagemDeErro } from "@/lib/cliente";
import type { Duplicado, Empresa } from "@/lib/empresas";
import Duplicados from "./Duplicados";

type Escolha = { id: string; nome: string };

/** Busca de empresa com criação rápida pelo nome (respeitando a checagem de duplicatas). */
export default function EmpresaSelect({
  valor,
  onChange,
}: {
  valor: Escolha | null;
  onChange: (empresa: Escolha | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const [opcoes, setOpcoes] = useState<Empresa[]>([]);
  const [duplicados, setDuplicados] = useState<Duplicado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (valor || !busca.trim()) return;
    let cancelado = false;
    const timer = setTimeout(() => {
      chamar<Empresa[]>(`/api/empresas?busca=${encodeURIComponent(busca.trim())}`)
        .then((lista) => !cancelado && setOpcoes(lista.slice(0, 8)))
        .catch(() => {});
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [busca, valor]);

  async function criar(forcar = false) {
    setErro(null);
    try {
      const empresa = await chamar<Empresa>("/api/empresas", { body: { nome: busca.trim(), forcar } });
      setDuplicados(null);
      onChange({ id: empresa.id, nome: empresa.nome });
    } catch (e) {
      if (e instanceof ErroApi && e.duplicados) setDuplicados(e.duplicados);
      else setErro(mensagemDeErro(e));
    }
  }

  if (valor) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm">
        <span className="font-medium">{valor.nome}</span>
        <button
          type="button"
          className="text-xs opacity-70 hover:opacity-100"
          onClick={() => {
            onChange(null);
            setBusca("");
          }}
        >
          Trocar
        </button>
      </div>
    );
  }

  const termo = busca.trim();
  return (
    <div>
      <input
        className="input"
        placeholder="Buscar ou criar empresa…"
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value);
          setDuplicados(null);
          if (!e.target.value.trim()) setOpcoes([]);
        }}
        autoFocus
      />
      {termo ? (
        <ul className="mt-1 overflow-hidden rounded-lg border border-surface-border text-sm">
          {opcoes.map((empresa) => (
            <li key={empresa.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-surface-muted"
                onClick={() => onChange({ id: empresa.id, nome: empresa.nome })}
              >
                <span className="font-medium">{empresa.nome}</span>
                {empresa.segmento ? <span className="opacity-60"> · {empresa.segmento}</span> : null}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="w-full px-3 py-2 text-left font-medium text-brand-teal hover:bg-surface-muted"
              onClick={() => criar()}
            >
              + Criar empresa “{termo}”
            </button>
          </li>
        </ul>
      ) : null}
      {duplicados ? (
        <Duplicados
          duplicados={duplicados}
          tipo="empresa"
          onUsar={(d) => onChange({ id: d.id, nome: d.nome })}
          onForcar={() => criar(true)}
        />
      ) : null}
      {erro ? <p className="mt-2 text-sm text-red-500">{erro}</p> : null}
    </div>
  );
}
