import { isEstagio, type Estagio } from "@/lib/leads";

export type LeadData = {
  nome?: string;
  empresa?: string | null;
  email?: string | null;
  telefone?: string | null;
  origem?: string | null;
  responsavel?: string | null;
  observacao?: string | null;
  perdidoMotivo?: string | null;
  valor?: number | null;
  estagio?: Estagio;
  posicao?: number;
  fechadoEm?: Date | null;
};

const TEXTO_OPCIONAL = [
  "empresa",
  "email",
  "telefone",
  "origem",
  "responsavel",
  "observacao",
  "perdidoMotivo",
] as const;

export function parseLeadInput(
  body: unknown,
  options: { requireNome?: boolean } = {},
): { data: LeadData } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Dados inválidos" };
  }

  const input = body as Record<string, unknown>;
  const data: LeadData = {};

  if (input.nome !== undefined) {
    if (typeof input.nome !== "string" || !input.nome.trim()) {
      return { error: "Nome é obrigatório" };
    }
    data.nome = input.nome.trim();
  } else if (options.requireNome) {
    return { error: "Nome é obrigatório" };
  }

  for (const campo of TEXTO_OPCIONAL) {
    const valor = input[campo];
    if (valor === undefined) continue;
    if (valor === null) {
      data[campo] = null;
      continue;
    }
    if (typeof valor !== "string") {
      return { error: `Campo ${campo} inválido` };
    }
    data[campo] = valor.trim() || null;
  }

  if (input.valor !== undefined) {
    if (input.valor === null || input.valor === "") {
      data.valor = null;
    } else {
      const num = Number(input.valor);
      if (!Number.isFinite(num) || num < 0) {
        return { error: "Valor inválido" };
      }
      data.valor = num;
    }
  }

  if (input.estagio !== undefined) {
    if (!isEstagio(input.estagio)) {
      return { error: "Estágio inválido" };
    }
    data.estagio = input.estagio;
  }

  if (input.posicao !== undefined) {
    const pos = Number(input.posicao);
    if (!Number.isInteger(pos) || pos < 0) {
      return { error: "Posição inválida" };
    }
    data.posicao = pos;
  }

  return { data };
}
