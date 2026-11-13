"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "@/lib/cliente";
import type { Contato } from "@/lib/empresas";
import { ORIGEM_LABEL } from "@/lib/empresas";
import { diasDesde, formatCurrency, formatDateTime, formatDia, formatTelefone } from "@/lib/format";
import {
  PAPEIS_CONTATO,
  PAPEL_CONTATO_LABEL,
  STATUS_NEGOCIO_LABEL,
  corDaEtapa,
  type Etapa,
  type Negocio,
  type NegocioDetalhe,
  type PapelContato,
} from "@/lib/negocios";
import MotivoPerdaModal from "./MotivoPerdaModal";
import NegocioFormModal from "./NegocioFormModal";
import { Drawer, Erro, Info, Secao, Vazio } from "./ui";

type Props = {
  negocioId: string;
  /** Etapas do pipeline do negócio, na ordem (para os botões de mover). */
  etapas: Etapa[];
  onFechar: () => void;
  /** Chamado depois de qualquer mudança, para a tela de origem recarregar. */
  onAlterado: (negocio: Negocio | null) => void;
};

export default function NegocioDrawer({ negocioId, etapas, onFechar, onAlterado }: Props) {
  const [negocio, setNegocio] = useState<NegocioDetalhe | null>(null);
  const [contatosEmpresa, setContatosEmpresa] = useState<Contato[]>([]);
  const [editando, setEditando] = useState(false);
  const [perdendo, setPerdendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const dados = await chamar<NegocioDetalhe>(`/api/negocios/${negocioId}`);
        const contatos = await chamar<Contato[]>(`/api/contatos?empresaId=${dados.empresaId}`);
        if (cancelado) return;
        setNegocio(dados);
        setContatosEmpresa(contatos);
      } catch (e) {
        if (!cancelado) setErro(mensagemDeErro(e));
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [negocioId]);

  async function atualizar(corpo: Record<string, unknown>) {
    setErro(null);
    try {
      const atualizado = await chamar<NegocioDetalhe>(`/api/negocios/${negocioId}`, { method: "PATCH", body: corpo });
      setNegocio(atualizado);
      onAlterado(atualizado as unknown as Negocio);
    } catch (e) {
      setErro(mensagemDeErro(e));
      throw e;
    }
  }

  function mover(etapa: Etapa) {
    if (!negocio || etapa.id === negocio.etapaId) return;
    if (etapa.tipo === "PERDIDO") setPerdendo(true);
    else atualizar({ etapaId: etapa.id }).catch(() => {});
  }

  function salvarContatos(lista: { contatoId: string; papel: PapelContato | null }[]) {
    atualizar({ contatos: lista }).catch(() => {});
  }

  async function arquivar() {
    if (!negocio || !confirm(`Arquivar o negócio "${negocio.titulo}"? Ele sai do quadro, mas o histórico fica.`)) return;
    await atualizar({ arquivado: true }).catch(() => {});
    onAlterado(null);
    onFechar();
  }

  if (!negocio) {
    return (
      <Drawer onFechar={onFechar}>
        {erro ? <Erro>{erro}</Erro> : <p className="text-sm opacity-60">Carregando…</p>}
      </Drawer>
    );
  }

  const participantes = negocio.contatos.map((c) => ({ contatoId: c.contato.id, papel: c.papel }));
  const disponiveis = contatosEmpresa.filter((c) => !participantes.some((p) => p.contatoId === c.id));

  return (
    <Drawer onFechar={onFechar}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{negocio.titulo}</h2>
          <Link href={`/empresas/${negocio.empresa.id}`} className="text-sm text-brand-teal hover:underline">
            {negocio.empresa.nome}
          </Link>
        </div>
        <button type="button" className="btn-ghost" onClick={onFechar}>
          Fechar
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {etapas.map((etapa) => {
          const atual = etapa.id === negocio.etapaId;
          return (
            <button
              key={etapa.id}
              type="button"
              onClick={() => mover(etapa)}
              className="rounded-full px-3 py-1 text-xs font-medium transition"
              style={
                atual
                  ? { background: corDaEtapa(etapa), color: "#04221f" }
                  : { border: "1px solid var(--surface-border)" }
              }
            >
              {etapa.nome}
            </button>
          );
        })}
      </div>

      <Erro>{erro}</Erro>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Info titulo="Valor" valor={formatCurrency(negocio.valor)} />
        <Info titulo="Status" valor={STATUS_NEGOCIO_LABEL[negocio.status]} />
        <Info titulo="Previsão" valor={formatDia(negocio.previsaoFechamento)} />
        <Info titulo="Origem" valor={negocio.origem ? ORIGEM_LABEL[negocio.origem] : "-"} />
        {negocio.status === "ABERTO" ? (
          <Info titulo="Na etapa há" valor={`${diasDesde(negocio.etapaDesde)} dia(s)`} />
        ) : (
          <Info titulo="Fechado em" valor={formatDateTime(negocio.fechadoEm)} />
        )}
        <Info titulo="Criado em" valor={formatDateTime(negocio.createdAt)} />
        {negocio.motivoPerda ? (
          <div className="col-span-2">
            <Info
              titulo="Motivo da perda"
              valor={`${negocio.motivoPerda.nome}${negocio.motivoPerdaDetalhe ? ` — ${negocio.motivoPerdaDetalhe}` : ""}`}
            />
          </div>
        ) : null}
      </dl>

      {negocio.observacao ? (
        <p className="mt-4 whitespace-pre-line rounded-lg bg-surface-muted p-3 text-sm">{negocio.observacao}</p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-ghost" onClick={() => setEditando(true)}>
          Editar
        </button>
        <button type="button" className="btn-ghost" onClick={arquivar}>
          Arquivar
        </button>
      </div>

      <Secao titulo="Contatos">
        <ul className="space-y-2">
          {negocio.contatos.map(({ contato, papel }) => (
            <li key={contato.id} className="rounded-lg border border-surface-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{contato.nome}</span>
                <button
                  type="button"
                  className="text-xs text-red-500"
                  onClick={() => salvarContatos(participantes.filter((p) => p.contatoId !== contato.id))}
                >
                  Remover
                </button>
              </div>
              <p className="text-xs opacity-70">
                {[contato.cargo, contato.email, contato.telefone ? formatTelefone(contato.telefone) : null]
                  .filter(Boolean)
                  .join(" · ") || "Sem dados de contato"}
              </p>
              <select
                className="input mt-2 py-1 text-xs"
                value={papel ?? ""}
                onChange={(e) =>
                  salvarContatos(
                    participantes.map((p) =>
                      p.contatoId === contato.id ? { ...p, papel: (e.target.value || null) as PapelContato | null } : p,
                    ),
                  )
                }
              >
                <option value="">Papel no negócio…</option>
                {PAPEIS_CONTATO.map((p) => (
                  <option key={p} value={p}>
                    {PAPEL_CONTATO_LABEL[p]}
                  </option>
                ))}
              </select>
            </li>
          ))}
          {!negocio.contatos.length ? <Vazio>Nenhum contato neste negócio</Vazio> : null}
        </ul>
        {disponiveis.length ? (
          <select
            className="input mt-2"
            value=""
            onChange={(e) => e.target.value && salvarContatos([...participantes, { contatoId: e.target.value, papel: null }])}
          >
            <option value="">+ Adicionar contato da empresa…</option>
            {disponiveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.cargo ? ` (${c.cargo})` : ""}
              </option>
            ))}
          </select>
        ) : null}
      </Secao>

      <Secao titulo="Histórico de etapas">
        <ol className="space-y-2 border-l border-surface-border pb-6 pl-4 text-sm">
          {negocio.historico.map((h) => (
            <li key={h.id}>
              <p>
                {h.deEtapa ? (
                  <>
                    {h.deEtapa.nome} → <strong>{h.paraEtapa?.nome ?? "etapa excluída"}</strong>
                  </>
                ) : (
                  <>
                    Entrou em <strong>{h.paraEtapa?.nome ?? "etapa excluída"}</strong>
                  </>
                )}
              </p>
              <p className="text-xs opacity-60">
                {formatDateTime(h.em)} · {formatCurrency(h.valor)}
              </p>
            </li>
          ))}
        </ol>
      </Secao>

      {editando ? (
        <NegocioFormModal
          negocio={negocio as unknown as Negocio}
          onFechar={() => setEditando(false)}
          onSalvo={(salvo) => {
            setEditando(false);
            setNegocio(salvo as unknown as NegocioDetalhe);
            onAlterado(salvo);
          }}
        />
      ) : null}

      {perdendo ? (
        <MotivoPerdaModal
          titulo={negocio.titulo}
          onFechar={() => setPerdendo(false)}
          onConfirmar={async (motivoPerdaId, motivoPerdaDetalhe) => {
            const perdido = etapas.find((e) => e.tipo === "PERDIDO")!;
            await atualizar({ etapaId: perdido.id, motivoPerdaId, motivoPerdaDetalhe });
            setPerdendo(false);
          }}
        />
      ) : null}
    </Drawer>
  );
}
