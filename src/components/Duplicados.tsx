"use client";

import Link from "next/link";
import type { Duplicado } from "@/lib/empresas";

const MOTIVO: Record<Duplicado["motivo"], string> = {
  cnpj: "mesmo CNPJ",
  telefone: "mesmo telefone",
  instagram: "mesmo Instagram",
  dominio: "mesmo site",
  nome: "mesmo nome",
  email: "mesmo e-mail",
};

/**
 * Aviso de possível duplicata (409 da API). Mostra os parecidos e, se a regra permitir,
 * deixa confirmar mesmo assim (CNPJ e e-mail repetidos nunca permitem).
 */
export default function Duplicados({
  duplicados,
  tipo,
  onUsar,
  onForcar,
}: {
  duplicados: Duplicado[];
  tipo: "empresa" | "contato";
  onUsar?: (d: Duplicado) => void;
  onForcar?: () => void;
}) {
  const bloqueante = duplicados.some((d) => d.motivo === "cnpj" || d.motivo === "email");
  return (
    <div className="mt-3 rounded-lg border border-amber-400/50 bg-amber-500/10 p-3 text-sm">
      <p className="font-semibold">
        {bloqueante ? "Já existe um cadastro com esses dados:" : `Parece que ${tipo === "empresa" ? "esta empresa" : "este contato"} já existe:`}
      </p>
      <ul className="mt-2 space-y-1">
        {duplicados.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2">
            <span>
              {tipo === "empresa" ? (
                <Link href={`/empresas/${d.id}`} className="font-medium underline" target="_blank">
                  {d.nome}
                </Link>
              ) : (
                <span className="font-medium">{d.nome}</span>
              )}{" "}
              <span className="opacity-70">
                · {MOTIVO[d.motivo]}
                {d.arquivado ? " · arquivado" : ""}
              </span>
            </span>
            {onUsar && !d.arquivado ? (
              <button type="button" className="text-xs font-semibold text-brand-teal" onClick={() => onUsar(d)}>
                Usar este
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {onForcar && !bloqueante ? (
        <button type="button" className="btn-ghost mt-3 w-full" onClick={onForcar}>
          É outro cadastro — criar mesmo assim
        </button>
      ) : null}
    </div>
  );
}
