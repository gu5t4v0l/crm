"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "@/lib/cliente";
import {
  COR_STATUS,
  ORIGEM_LABEL,
  STATUS_EMPRESA,
  STATUS_EMPRESA_LABEL,
  type Contato,
  type Empresa,
  type StatusEmpresa,
} from "@/lib/empresas";
import { formatCurrency, formatDate, formatTelefone } from "@/lib/format";
import { STATUS_NEGOCIO_LABEL, corDaEtapa, type Negocio, type Pipeline } from "@/lib/negocios";
import ContatoFormModal from "./ContatoFormModal";
import EmpresaFormModal from "./EmpresaFormModal";
import NegocioDrawer from "./NegocioDrawer";
import NegocioFormModal from "./NegocioFormModal";
import { Erro, Info, Pilula, Secao, Vazio } from "./ui";

export default function EmpresaDetalhe({ id }: { id: string }) {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [contatoEditado, setContatoEditado] = useState<Contato | "novo" | null>(null);
  const [novoNegocio, setNovoNegocio] = useState(false);
  const [negocioAberto, setNegocioAberto] = useState<Negocio | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const [e, n, p] = await Promise.all([
          chamar<Empresa>(`/api/empresas/${id}`),
          chamar<Negocio[]>(`/api/negocios?empresaId=${id}`),
          chamar<Pipeline[]>("/api/pipelines"),
        ]);
        if (cancelado) return;
        setEmpresa(e);
        setNegocios(n);
        setPipelines(p);
        setErro(null);
      } catch (e) {
        if (!cancelado) setErro(mensagemDeErro(e));
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [id, versao]);

  const recarregar = () => setVersao((v) => v + 1);

  async function atualizarEmpresa(corpo: Record<string, unknown>) {
    setErro(null);
    try {
      setEmpresa(await chamar<Empresa>(`/api/empresas/${id}`, { method: "PATCH", body: corpo }));
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function atualizarContato(contato: Contato, corpo: Record<string, unknown>) {
    setErro(null);
    try {
      await chamar(`/api/contatos/${contato.id}`, { method: "PATCH", body: corpo });
      recarregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  if (!empresa) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
        {erro ? <Erro>{erro}</Erro> : <p className="text-sm opacity-60">Carregando…</p>}
      </main>
    );
  }

  const etapas = pipelines.flatMap((p) => p.etapas);
  const padrao = pipelines[0];
  const arquivada = Boolean(empresa.arquivadaEm);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
      <Link href="/empresas" className="text-sm opacity-70 hover:opacity-100">
        ← Empresas
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{empresa.nome}</h1>
          <p className="text-sm opacity-70">
            {[empresa.segmento, [empresa.cidade, empresa.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ") ||
              "Sem segmento"}
          </p>
          {arquivada ? <p className="mt-1 text-sm font-medium text-amber-500">Arquivada em {formatDate(empresa.arquivadaEm)}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={empresa.status}
            onChange={(e) => atualizarEmpresa({ status: e.target.value as StatusEmpresa })}
            aria-label="Status"
          >
            {STATUS_EMPRESA.map((s) => (
              <option key={s} value={s}>
                {STATUS_EMPRESA_LABEL[s]}
              </option>
            ))}
          </select>
          <button type="button" className="btn-ghost" onClick={() => setEditando(true)}>
            Editar
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (arquivada || confirm(`Arquivar "${empresa.nome}"? Ela some das listas, mas nada é apagado.`)) {
                atualizarEmpresa({ arquivada: !arquivada });
              }
            }}
          >
            {arquivada ? "Restaurar" : "Arquivar"}
          </button>
        </div>
      </div>

      <Erro>{erro}</Erro>

      <div className="card mt-5 p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <Info titulo="Status" valor={<Pilula cor={COR_STATUS[empresa.status]}>{STATUS_EMPRESA_LABEL[empresa.status]}</Pilula>} />
          <Info titulo="Telefone" valor={formatTelefone(empresa.telefone)} />
          <Info titulo="E-mail" valor={empresa.email ?? "-"} />
          <Info
            titulo="Site"
            valor={
              empresa.site ? (
                <a
                  href={/^https?:\/\//.test(empresa.site) ? empresa.site : `https://${empresa.site}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-teal hover:underline"
                >
                  {empresa.dominio ?? empresa.site}
                </a>
              ) : (
                "-"
              )
            }
          />
          <Info
            titulo="Instagram"
            valor={
              empresa.instagram ? (
                <a
                  href={`https://instagram.com/${empresa.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-teal hover:underline"
                >
                  @{empresa.instagram}
                </a>
              ) : (
                "-"
              )
            }
          />
          <Info titulo="CNPJ" valor={empresa.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") ?? "-"} />
          <Info titulo="Origem" valor={empresa.origem ? ORIGEM_LABEL[empresa.origem] : "-"} />
          <Info titulo="Endereço" valor={empresa.endereco ?? "-"} />
          <Info titulo="Cadastrada em" valor={formatDate(empresa.createdAt)} />
        </dl>
        {empresa.observacao ? (
          <p className="mt-4 whitespace-pre-line rounded-lg bg-surface-muted p-3 text-sm">{empresa.observacao}</p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao
          titulo={`Negócios (${negocios.length})`}
          acao={
            !arquivada && padrao ? (
              <button type="button" className="text-sm font-semibold text-brand-teal" onClick={() => setNovoNegocio(true)}>
                + Novo negócio
              </button>
            ) : null
          }
        >
          <ul className="space-y-2">
            {negocios.map((negocio) => {
              const etapa = etapas.find((e) => e.id === negocio.etapaId);
              return (
                <li key={negocio.id}>
                  <button
                    type="button"
                    onClick={() => setNegocioAberto(negocio)}
                    className="card w-full p-3 text-left text-sm hover:border-brand-teal"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{negocio.titulo}</span>
                      <span className="font-medium text-brand-teal">{formatCurrency(negocio.valor)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs opacity-80">
                      {etapa ? (
                        <Pilula cor={corDaEtapa(etapa)}>{etapa.nome}</Pilula>
                      ) : (
                        <span>{STATUS_NEGOCIO_LABEL[negocio.status]}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
            {!negocios.length ? <Vazio>Nenhum negócio com esta empresa</Vazio> : null}
          </ul>
        </Secao>

        <Secao
          titulo={`Contatos (${empresa.contatos?.length ?? 0})`}
          acao={
            !arquivada ? (
              <button type="button" className="text-sm font-semibold text-brand-teal" onClick={() => setContatoEditado("novo")}>
                + Novo contato
              </button>
            ) : null
          }
        >
          <ul className="space-y-2">
            {empresa.contatos?.map((contato) => (
              <li key={contato.id} className="card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {contato.nome}
                    {contato.principal ? (
                      <span className="ml-2 rounded-full bg-brand-teal-soft px-2 py-0.5 text-xs font-semibold text-brand-teal">
                        principal
                      </span>
                    ) : null}
                  </span>
                  <span className="flex gap-3 text-xs">
                    {!contato.principal ? (
                      <button type="button" className="text-brand-teal" onClick={() => atualizarContato(contato, { principal: true })}>
                        Tornar principal
                      </button>
                    ) : null}
                    <button type="button" className="opacity-70 hover:opacity-100" onClick={() => setContatoEditado(contato)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-red-500"
                      onClick={() => confirm(`Arquivar o contato ${contato.nome}?`) && atualizarContato(contato, { arquivado: true })}
                    >
                      Arquivar
                    </button>
                  </span>
                </div>
                <p className="mt-1 text-xs opacity-70">
                  {[contato.cargo, contato.email, contato.telefone ? formatTelefone(contato.telefone) : null]
                    .filter(Boolean)
                    .join(" · ") || "Sem dados de contato"}
                </p>
              </li>
            ))}
            {!empresa.contatos?.length ? <Vazio>Nenhum contato cadastrado</Vazio> : null}
          </ul>
        </Secao>
      </div>

      {editando ? (
        <EmpresaFormModal
          empresa={empresa}
          onFechar={() => setEditando(false)}
          onSalvo={(salva) => {
            setEditando(false);
            setEmpresa(salva);
          }}
        />
      ) : null}

      {contatoEditado ? (
        <ContatoFormModal
          contato={contatoEditado === "novo" ? undefined : contatoEditado}
          empresaId={empresa.id}
          onFechar={() => setContatoEditado(null)}
          onSalvo={() => {
            setContatoEditado(null);
            recarregar();
          }}
        />
      ) : null}

      {novoNegocio && padrao ? (
        <NegocioFormModal
          pipeline={padrao}
          empresaFixa={{ id: empresa.id, nome: empresa.nome }}
          onFechar={() => setNovoNegocio(false)}
          onSalvo={() => {
            setNovoNegocio(false);
            recarregar();
          }}
        />
      ) : null}

      {negocioAberto ? (
        <NegocioDrawer
          negocioId={negocioAberto.id}
          etapas={pipelines.find((p) => p.id === negocioAberto.pipelineId)?.etapas ?? []}
          onFechar={() => setNegocioAberto(null)}
          onAlterado={recarregar}
        />
      ) : null}
    </main>
  );
}
