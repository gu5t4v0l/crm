"use client";

import { useEffect, useState } from "react";
import { chamar, mensagemDeErro } from "@/lib/cliente";
import type { MotivoPerda } from "@/lib/negocios";
import { Erro, Modal } from "./ui";

/** Pede o motivo ao mover um negócio para Perdido (regra: perdido sem motivo não existe). */
export default function MotivoPerdaModal({
  titulo,
  onFechar,
  onConfirmar,
}: {
  titulo: string;
  onFechar: () => void;
  onConfirmar: (motivoPerdaId: string, motivoPerdaDetalhe: string | null) => Promise<void>;
}) {
  const [motivos, setMotivos] = useState<MotivoPerda[]>([]);
  const [motivoId, setMotivoId] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    chamar<MotivoPerda[]>("/api/motivos-perda")
      .then(setMotivos)
      .catch((e) => setErro(mensagemDeErro(e)));
  }, []);

  async function confirmar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!motivoId) {
      setErro("Escolha o motivo");
      return;
    }
    setSalvando(true);
    try {
      await onConfirmar(motivoId, detalhe.trim() || null);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={`Perdido: ${titulo}`} onFechar={onFechar} largura="max-w-md">
      <form onSubmit={confirmar} className="mt-4 space-y-3">
        <div>
          <label className="label">Motivo *</label>
          <div className="flex flex-wrap gap-1.5">
            {motivos.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMotivoId(m.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  motivoId === m.id
                    ? "border-red-500 bg-red-500/10 text-red-500"
                    : "border-surface-border hover:bg-surface-muted"
                }`}
              >
                {m.nome}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Detalhe</label>
          <textarea
            className="input"
            rows={2}
            placeholder="O que aconteceu? (opcional)"
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
          />
        </div>
        <Erro>{erro}</Erro>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={salvando}>
            {salvando ? "Salvando…" : "Marcar como perdido"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
