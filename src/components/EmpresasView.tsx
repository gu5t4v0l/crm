"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "@/lib/cliente";
import {
  COR_STATUS,
  ORIGEM_LABEL,
  STATUS_EMPRESA,
  STATUS_EMPRESA_LABEL,
  type Empresa,
  type StatusEmpresa,
} from "@/lib/empresas";
import EmpresaFormModal from "./EmpresaFormModal";
import { Erro, Pilula } from "./ui";

type Filtro = StatusEmpresa | "TODAS" | "ARQUIVADAS";

export default function EmpresasView() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      const params = new URLSearchParams();
      if (buscaAplicada) params.set("busca", buscaAplicada);
      if (filtro === "ARQUIVADAS") params.set("arquivadas", "1");
      else if (filtro !== "TODAS") params.set("status", filtro);
      try {
        const dados = await chamar<Empresa[]>(`/api/empresas?${params}`);
        if (!cancelado) {
          setEmpresas(dados);
          setErro(null);
        }
      } catch (e) {
        if (!cancelado) setErro(mensagemDeErro(e));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [filtro, buscaAplicada]);

  const filtros: Filtro[] = ["TODAS", ...STATUS_EMPRESA, "ARQUIVADAS"];

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Empresas</h1>
          <p className="text-sm opacity-70">
            {empresas.length} empresa{empresas.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setCarregando(true);
              setBuscaAplicada(busca.trim());
            }}
            className="flex items-center gap-2"
          >
            <input
              className="input w-64"
              placeholder="Nome, segmento, cidade, telefone, contato…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <button type="submit" className="btn-ghost">
              Buscar
            </button>
          </form>
          <button type="button" className="btn-primary" onClick={() => setNovaAberta(true)}>
            + Nova empresa
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {filtros.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setCarregando(true);
              setFiltro(f);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filtro === f ? "bg-brand-teal-soft text-brand-teal" : "border border-surface-border opacity-80 hover:opacity-100"
            }`}
          >
            {f === "TODAS" ? "Todas ativas" : f === "ARQUIVADAS" ? "Arquivadas" : STATUS_EMPRESA_LABEL[f]}
          </button>
        ))}
      </div>

      <Erro>{erro}</Erro>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide opacity-60">
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Contato principal</th>
              <th className="px-4 py-3">Cidade</th>
              <th className="px-4 py-3">Origem</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((empresa) => {
              const principal = empresa.contatos?.[0];
              const outros = (empresa._count?.contatos ?? 0) - (principal ? 1 : 0);
              return (
                <tr
                  key={empresa.id}
                  onClick={() => router.push(`/empresas/${empresa.id}`)}
                  className="cursor-pointer border-t border-surface-border hover:bg-surface-muted"
                >
                  <td className="px-4 py-3">
                    <Link href={`/empresas/${empresa.id}`} className="font-medium" onClick={(e) => e.stopPropagation()}>
                      {empresa.nome}
                    </Link>
                    {empresa.segmento ? <p className="text-xs opacity-60">{empresa.segmento}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Pilula cor={COR_STATUS[empresa.status]}>{STATUS_EMPRESA_LABEL[empresa.status]}</Pilula>
                  </td>
                  <td className="px-4 py-3">
                    {principal ? principal.nome : <span className="opacity-40">—</span>}
                    {outros > 0 ? <span className="text-xs opacity-60"> +{outros}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    {[empresa.cidade, empresa.uf].filter(Boolean).join("/") || <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {empresa.origem ? ORIGEM_LABEL[empresa.origem] : <span className="opacity-40">—</span>}
                  </td>
                </tr>
              );
            })}
            {!empresas.length && !carregando ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm opacity-50">
                  Nenhuma empresa encontrada
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {carregando ? <p className="mt-2 text-sm opacity-60">Carregando…</p> : null}

      {novaAberta ? (
        <EmpresaFormModal
          onFechar={() => setNovaAberta(false)}
          onSalvo={(empresa) => router.push(`/empresas/${empresa.id}`)}
        />
      ) : null}
    </main>
  );
}
