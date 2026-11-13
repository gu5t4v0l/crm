"use client";

import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "@/lib/cliente";
import { corDaEtapa, type Etapa, type MotivoPerda, type Pipeline } from "@/lib/negocios";
import { Erro, Modal, Secao } from "./ui";

export default function ConfiguracoesView() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [arquivados, setArquivados] = useState<Pipeline[]>([]);
  const [motivos, setMotivos] = useState<MotivoPerda[]>([]);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [novoPipeline, setNovoPipeline] = useState("");
  const [novoMotivo, setNovoMotivo] = useState("");
  const [excluindo, setExcluindo] = useState<{ etapa: Etapa; pipeline: Pipeline } | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const [ativos, arq, mot] = await Promise.all([
          chamar<Pipeline[]>("/api/pipelines"),
          chamar<Pipeline[]>("/api/pipelines?arquivados=1"),
          chamar<MotivoPerda[]>("/api/motivos-perda?inativos=1"),
        ]);
        if (cancelado) return;
        setPipelines(ativos);
        setArquivados(arq);
        setMotivos(mot);
      } catch (e) {
        if (!cancelado) setErro(mensagemDeErro(e));
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [versao]);

  /** Executa uma alteração e recarrega tudo (as regras de padrão/ordem mexem em mais de um item). */
  async function executar(acao: () => Promise<unknown>): Promise<boolean> {
    setErro(null);
    try {
      await acao();
      setVersao((v) => v + 1);
      return true;
    } catch (e) {
      setErro(mensagemDeErro(e));
      return false;
    }
  }

  function moverEtapa(pipeline: Pipeline, etapa: Etapa, delta: -1 | 1) {
    const abertas = pipeline.etapas.filter((e) => e.tipo === "ABERTA").map((e) => e.id);
    const i = abertas.indexOf(etapa.id);
    const j = i + delta;
    if (j < 0 || j >= abertas.length) return;
    [abertas[i], abertas[j]] = [abertas[j], abertas[i]];
    executar(() => chamar(`/api/pipelines/${pipeline.id}/etapas`, { method: "PUT", body: { etapaIds: abertas } }));
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <p className="text-sm opacity-70">Pipelines, etapas do funil e motivos de perda.</p>

      <Erro>{erro}</Erro>

      <Secao titulo="Pipelines">
        <div className="space-y-4">
          {pipelines.map((pipeline) => {
            const abertas = pipeline.etapas.filter((e) => e.tipo === "ABERTA");
            return (
              <div key={pipeline.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CampoTexto
                      valor={pipeline.nome}
                      className="input w-56 font-semibold"
                      onSalvar={(nome) => executar(() => chamar(`/api/pipelines/${pipeline.id}`, { method: "PATCH", body: { nome } }))}
                    />
                    {pipeline.padrao ? (
                      <span className="rounded-full bg-brand-teal-soft px-2 py-0.5 text-xs font-semibold text-brand-teal">padrão</span>
                    ) : null}
                  </div>
                  {!pipeline.padrao ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => executar(() => chamar(`/api/pipelines/${pipeline.id}`, { method: "PATCH", body: { padrao: true } }))}
                      >
                        Tornar padrão
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => executar(() => chamar(`/api/pipelines/${pipeline.id}`, { method: "PATCH", body: { arquivado: true } }))}
                      >
                        Arquivar
                      </button>
                    </div>
                  ) : null}
                </div>

                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide opacity-60">
                      <th className="w-10 py-2">Cor</th>
                      <th className="py-2">Etapa</th>
                      <th className="w-28 py-2">Chance (%)</th>
                      <th className="w-40 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline.etapas.map((etapa) => {
                      const aberta = etapa.tipo === "ABERTA";
                      const pos = abertas.indexOf(etapa);
                      const patch = (body: Record<string, unknown>) =>
                        executar(() => chamar(`/api/etapas/${etapa.id}`, { method: "PATCH", body }));
                      return (
                        <tr key={etapa.id} className="border-t border-surface-border">
                          <td className="py-2">
                            <input
                              type="color"
                              aria-label={`Cor de ${etapa.nome}`}
                              className="h-7 w-7 cursor-pointer rounded border border-surface-border bg-transparent"
                              defaultValue={corDaEtapa(etapa)}
                              onBlur={(e) => e.target.value !== corDaEtapa(etapa) && patch({ cor: e.target.value })}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <CampoTexto valor={etapa.nome} onSalvar={(nome) => patch({ nome })} />
                            {!aberta ? (
                              <p className="mt-1 text-xs opacity-60">
                                {etapa.tipo === "GANHO" ? "Fechamento como ganho" : "Fechamento como perdido (pede motivo)"}
                              </p>
                            ) : null}
                          </td>
                          <td className="py-2 pr-2">
                            <CampoTexto
                              valor={etapa.probabilidade === null ? "" : String(etapa.probabilidade)}
                              tipo="number"
                              onSalvar={(v) => patch({ probabilidade: v === "" ? null : Number(v) })}
                            />
                          </td>
                          <td className="py-2 text-right">
                            {aberta ? (
                              <span className="inline-flex gap-1">
                                <button
                                  type="button"
                                  className="btn-ghost px-2 py-1"
                                  disabled={pos === 0}
                                  aria-label="Subir"
                                  onClick={() => moverEtapa(pipeline, etapa, -1)}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost px-2 py-1"
                                  disabled={pos === abertas.length - 1}
                                  aria-label="Descer"
                                  onClick={() => moverEtapa(pipeline, etapa, 1)}
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost px-2 py-1 text-red-500"
                                  disabled={abertas.length === 1}
                                  onClick={() => setExcluindo({ etapa, pipeline })}
                                >
                                  Excluir
                                </button>
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <NovaEtapa
                  onCriar={(nome) =>
                    executar(() => chamar(`/api/pipelines/${pipeline.id}/etapas`, { body: { nome } }))
                  }
                />
              </div>
            );
          })}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!novoPipeline.trim()) return;
              executar(() => chamar("/api/pipelines", { body: { nome: novoPipeline.trim() } })).then((ok) => ok && setNovoPipeline(""));
            }}
          >
            <input
              className="input"
              placeholder="Novo pipeline (ex.: Parcerias, Projetos)…"
              value={novoPipeline}
              onChange={(e) => setNovoPipeline(e.target.value)}
            />
            <button type="submit" className="btn-primary shrink-0">
              Criar pipeline
            </button>
          </form>

          {arquivados.length ? (
            <div className="text-sm">
              <p className="label">Arquivados</p>
              <ul className="space-y-1">
                {arquivados.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="opacity-70">{p.nome}</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-teal"
                      onClick={() => executar(() => chamar(`/api/pipelines/${p.id}`, { method: "PATCH", body: { arquivado: false } }))}
                    >
                      Restaurar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Secao>

      <Secao titulo="Motivos de perda">
        <div className="card p-4">
          <ul className="space-y-2">
            {motivos.map((motivo) => (
              <li key={motivo.id} className="flex items-center gap-2">
                <CampoTexto
                  valor={motivo.nome}
                  className={`input ${motivo.ativo ? "" : "opacity-50"}`}
                  onSalvar={(nome) => executar(() => chamar(`/api/motivos-perda/${motivo.id}`, { method: "PATCH", body: { nome } }))}
                />
                <button
                  type="button"
                  className="btn-ghost shrink-0"
                  onClick={() =>
                    executar(() => chamar(`/api/motivos-perda/${motivo.id}`, { method: "PATCH", body: { ativo: !motivo.ativo } }))
                  }
                >
                  {motivo.ativo ? "Desativar" : "Reativar"}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!novoMotivo.trim()) return;
              executar(() => chamar("/api/motivos-perda", { body: { nome: novoMotivo.trim() } })).then((ok) => ok && setNovoMotivo(""));
            }}
          >
            <input
              className="input"
              placeholder="Novo motivo…"
              value={novoMotivo}
              onChange={(e) => setNovoMotivo(e.target.value)}
            />
            <button type="submit" className="btn-ghost shrink-0">
              Adicionar
            </button>
          </form>
          <p className="mt-2 text-xs opacity-60">
            Motivos não são excluídos — negócios antigos continuam apontando para eles. Desativado não aparece ao marcar perda.
          </p>
        </div>
      </Secao>

      {excluindo ? (
        <ExcluirEtapaModal
          {...excluindo}
          onFechar={() => setExcluindo(null)}
          onConfirmar={(moverPara) =>
            executar(() =>
              chamar(`/api/etapas/${excluindo.etapa.id}?moverPara=${encodeURIComponent(moverPara)}`, { method: "DELETE" }),
            ).then((ok) => ok && setExcluindo(null))
          }
        />
      ) : null}
    </main>
  );
}

/** Input que salva ao sair do campo (ou Enter), só se o valor mudou. */
function CampoTexto({
  valor,
  onSalvar,
  tipo = "text",
  className = "input",
}: {
  valor: string;
  onSalvar: (valor: string) => void;
  tipo?: "text" | "number";
  className?: string;
}) {
  return (
    <input
      key={valor}
      type={tipo}
      min={tipo === "number" ? 0 : undefined}
      max={tipo === "number" ? 100 : undefined}
      className={className}
      defaultValue={valor}
      onBlur={(e) => {
        const novo = e.target.value.trim();
        if (novo !== valor && (novo || tipo === "number")) onSalvar(novo);
        else e.target.value = valor;
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function NovaEtapa({ onCriar }: { onCriar: (nome: string) => void }) {
  const [nome, setNome] = useState("");
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nome.trim()) return;
        onCriar(nome.trim());
        setNome("");
      }}
    >
      <input className="input" placeholder="Nova etapa (entra antes de Ganho)…" value={nome} onChange={(e) => setNome(e.target.value)} />
      <button type="submit" className="btn-ghost shrink-0">
        Adicionar etapa
      </button>
    </form>
  );
}

function ExcluirEtapaModal({
  etapa,
  pipeline,
  onFechar,
  onConfirmar,
}: {
  etapa: Etapa;
  pipeline: Pipeline;
  onFechar: () => void;
  onConfirmar: (moverPara: string) => void;
}) {
  const destinos = pipeline.etapas.filter((e) => e.tipo === "ABERTA" && e.id !== etapa.id);
  const [moverPara, setMoverPara] = useState(destinos[0]?.id ?? "");
  return (
    <Modal titulo={`Excluir etapa "${etapa.nome}"`} onFechar={onFechar} largura="max-w-md">
      <p className="mt-3 text-sm opacity-80">
        Os negócios que estiverem nela serão movidos para a etapa escolhida, com registro no histórico.
      </p>
      <label className="label mt-4">Mover negócios para</label>
      <select className="input" value={moverPara} onChange={(e) => setMoverPara(e.target.value)}>
        {destinos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nome}
          </option>
        ))}
      </select>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onFechar}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" onClick={() => onConfirmar(moverPara)}>
          Excluir etapa
        </button>
      </div>
    </Modal>
  );
}
