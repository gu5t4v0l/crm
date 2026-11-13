export const ESTAGIOS = ["NOVO", "CONTATO", "PROPOSTA", "GANHO", "PERDIDO"] as const;
export type Estagio = (typeof ESTAGIOS)[number];

export const ESTAGIO_LABEL: Record<Estagio, string> = {
  NOVO: "Novo",
  CONTATO: "Em contato",
  PROPOSTA: "Proposta",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
};

export const ESTAGIO_COR: Record<Estagio, string> = {
  NOVO: "#0abab5",
  CONTATO: "#3b82f6",
  PROPOSTA: "#f59e0b",
  GANHO: "#22c55e",
  PERDIDO: "#ef4444",
};

export const TIPOS_ATIVIDADE = [
  "NOTA",
  "LIGACAO",
  "EMAIL",
  "REUNIAO",
  "WHATSAPP",
  "TAREFA",
] as const;
export type TipoAtividade = (typeof TIPOS_ATIVIDADE)[number];

export const TIPO_ATIVIDADE_LABEL: Record<TipoAtividade, string> = {
  NOTA: "Nota",
  LIGACAO: "Ligação",
  EMAIL: "E-mail",
  REUNIAO: "Reunião",
  WHATSAPP: "WhatsApp",
  TAREFA: "Tarefa",
};

export type Atividade = {
  id: string;
  leadId: string;
  tipo: TipoAtividade;
  descricao: string;
  dataHora: string;
  concluida: boolean;
};

export type Lead = {
  id: string;
  nome: string;
  empresa: string | null;
  email: string | null;
  telefone: string | null;
  origem: string | null;
  valor: string | null;
  estagio: Estagio;
  posicao: number;
  responsavel: string | null;
  observacao: string | null;
  perdidoMotivo: string | null;
  fechadoEm: string | null;
  createdAt: string;
  updatedAt: string;
  atividades?: Atividade[];
};

export function isEstagio(value: unknown): value is Estagio {
  return typeof value === "string" && (ESTAGIOS as readonly string[]).includes(value);
}

export function isTipoAtividade(value: unknown): value is TipoAtividade {
  return typeof value === "string" && (TIPOS_ATIVIDADE as readonly string[]).includes(value);
}
