"use client";

import { useEffect } from "react";

function useEsc(onFechar: () => void) {
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);
}

/** Modal centralizado. Clicar fora ou Esc fecha. */
export function Modal({
  titulo,
  onFechar,
  children,
  largura = "max-w-lg",
}: {
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: string;
}) {
  useEsc(onFechar);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <div
        role="dialog"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={`card max-h-[90vh] w-full ${largura} overflow-y-auto p-5`}
      >
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

/** Painel lateral à direita. */
export function Drawer({ onFechar, children }: { onFechar: () => void; children: React.ReactNode }) {
  useEsc(onFechar);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onFechar}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-surface-border bg-surface p-5"
      >
        {children}
      </aside>
    </div>
  );
}

export function Erro({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
      {children}
    </p>
  );
}

export function Info({ titulo, valor }: { titulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{titulo}</dt>
      <dd className="break-words">{valor}</dd>
    </div>
  );
}

export function Secao({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70">{titulo}</h3>
        {acao}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-surface-border p-3 text-center text-xs opacity-50">
      {children}
    </p>
  );
}

/** Pílula de status/etapa com a cor da etapa (ou neutra). */
export function Pilula({ cor, children }: { cor?: string | null; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-surface-border px-2 py-0.5 text-xs font-medium"
    >
      {cor ? <span className="inline-block h-2 w-2 rounded-full" style={{ background: cor }} /> : null}
      {children}
    </span>
  );
}
