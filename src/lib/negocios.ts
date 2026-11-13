import type { Origem } from "@/lib/empresas";

export const TIPOS_ETAPA = ["ABERTA", "GANHO", "PERDIDO"] as const;
export type TipoEtapa = (typeof TIPOS_ETAPA)[number];

export const STATUS_NEGOCIO = ["ABERTO", "GANHO", "PERDIDO"] as const;
export type StatusNegocio = (typeof STATUS_NEGOCIO)[number];

export const STATUS_NEGOCIO_LABEL: Record<StatusNegocio, string> = {
  ABERTO: "Aberto",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
};

/** Status do negócio é sempre o espelho do tipo da etapa em que ele está. */
export const STATUS_POR_TIPO: Record<TipoEtapa, StatusNegocio> = {
  ABERTA: "ABERTO",
  GANHO: "GANHO",
  PERDIDO: "PERDIDO",
};

export const PAPEIS_CONTATO = ["DECISOR", "INFLUENCIADOR", "USUARIO", "FINANCEIRO", "OUTRO"] as const;
export type PapelContato = (typeof PAPEIS_CONTATO)[number];

export const PAPEL_CONTATO_LABEL: Record<PapelContato, string> = {
  DECISOR: "Decisor",
  INFLUENCIADOR: "Influenciador",
  USUARIO: "Usuário",
  FINANCEIRO: "Financeiro",
  OUTRO: "Outro",
};

export type Etapa = {
  id: string;
  pipelineId: string;
  nome: string;
  tipo: TipoEtapa;
  ordem: number;
  probabilidade: number | null;
  cor: string | null;
};

export type Pipeline = {
  id: string;
  nome: string;
  padrao: boolean;
  ordem: number;
  arquivadoEm: string | null;
  etapas: Etapa[];
};

export type MotivoPerda = { id: string; nome: string; ativo: boolean; ordem: number };

export type Negocio = {
  id: string;
  titulo: string;
  empresaId: string;
  pipelineId: string;
  etapaId: string;
  status: StatusNegocio;
  /** Decimal serializado como string. */
  valor: string;
  previsaoFechamento: string | null;
  origem: Origem | null;
  rank: string;
  etapaDesde: string;
  fechadoEm: string | null;
  motivoPerdaId: string | null;
  motivoPerdaDetalhe: string | null;
  observacao: string | null;
  arquivadoEm: string | null;
  createdAt: string;
  updatedAt: string;
  empresa?: { id: string; nome: string };
  contatos?: { papel: PapelContato | null; contato: { id: string; nome: string } }[];
};

/** GET /api/negocios/:id */
export type NegocioDetalhe = Omit<Negocio, "empresa" | "contatos"> & {
  empresa: { id: string; nome: string; status: string };
  etapa: Etapa;
  pipeline: { id: string; nome: string };
  motivoPerda: MotivoPerda | null;
  contatos: {
    papel: PapelContato | null;
    contato: { id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null };
  }[];
  historico: {
    id: string;
    em: string;
    valor: string;
    paraTipo: TipoEtapa;
    deEtapa: { nome: string } | null;
    paraEtapa: { nome: string } | null;
  }[];
};

/** Total ponderado pela probabilidade da etapa (previsão de receita). */
export function valorPonderado(valor: string | number, probabilidade: number | null) {
  return (Number(valor) * (probabilidade ?? 0)) / 100;
}

/** Cor da etapa, com padrão por tipo quando não configurada. */
export function corDaEtapa(etapa: Pick<Etapa, "cor" | "tipo">) {
  return etapa.cor ?? (etapa.tipo === "GANHO" ? "#22c55e" : etapa.tipo === "PERDIDO" ? "#ef4444" : "#0abab5");
}
