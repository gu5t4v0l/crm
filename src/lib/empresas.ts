import { chaveNome } from "@/lib/normalizar";

export const STATUS_EMPRESA = ["PROSPECT", "CLIENTE", "EX_CLIENTE", "DESCARTADA"] as const;
export type StatusEmpresa = (typeof STATUS_EMPRESA)[number];

export const STATUS_EMPRESA_LABEL: Record<StatusEmpresa, string> = {
  PROSPECT: "Prospect",
  CLIENTE: "Cliente",
  EX_CLIENTE: "Ex-cliente",
  DESCARTADA: "Descartada",
};

export const COR_STATUS: Record<StatusEmpresa, string> = {
  PROSPECT: "#3b82f6",
  CLIENTE: "#22c55e",
  EX_CLIENTE: "#a855f7",
  DESCARTADA: "#94a3b8",
};

export const ORIGENS = [
  "MAPS",
  "INSTAGRAM",
  "WHATSAPP",
  "INDICACAO",
  "PARCERIA",
  "SITE",
  "EVENTO",
  "OUTRO",
] as const;
export type Origem = (typeof ORIGENS)[number];

export const ORIGEM_LABEL: Record<Origem, string> = {
  MAPS: "Google Maps",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  INDICACAO: "Indicação",
  PARCERIA: "Parceria",
  SITE: "Site",
  EVENTO: "Evento",
  OUTRO: "Outro",
};

/** Converte origem em texto livre (CSV, leads antigos, extensão) para a lista fixa. */
export function origemDeTexto(texto: string | null | undefined): Origem | null {
  if (!texto?.trim()) return null;
  const chave = chaveNome(texto).replace(/ /g, "");
  const mapa: [RegExp, Origem][] = [
    [/maps|google/, "MAPS"],
    [/insta|intagram|^ig$/, "INSTAGRAM"],
    [/whats|zap|wpp/, "WHATSAPP"],
    [/indica/, "INDICACAO"],
    [/parc/, "PARCERIA"],
    [/site|web/, "SITE"],
    [/evento|feira/, "EVENTO"],
  ];
  return mapa.find(([re]) => re.test(chave))?.[1] ?? "OUTRO";
}

export type Contato = {
  id: string;
  empresaId: string | null;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  principal: boolean;
  observacao: string | null;
  arquivadoEm: string | null;
  createdAt: string;
  updatedAt: string;
  empresa?: { id: string; nome: string } | null;
};

export type Empresa = {
  id: string;
  nome: string;
  segmento: string | null;
  status: StatusEmpresa;
  origem: Origem | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  dominio: string | null;
  instagram: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  observacao: string | null;
  arquivadaEm: string | null;
  createdAt: string;
  updatedAt: string;
  contatos?: Contato[];
  _count?: { contatos: number };
};

/** Corpo do 409 quando o cadastro parece repetido. Reenviar com `forcar: true` cria mesmo assim. */
export type Duplicado = {
  id: string;
  nome: string;
  motivo: "cnpj" | "telefone" | "instagram" | "dominio" | "nome" | "email";
  arquivado: boolean;
};

/**
 * Nome e segmento a partir do par nome/empresa de leads e CSVs antigos: se `empresa` é o
 * nome mais completo ("Orbi" / "Orbi Produtora") vira o nome; se é outra coisa ("Perfumes"),
 * vira o segmento.
 */
export function nomeESegmento(nome: string, empresa: string | null | undefined) {
  const n = nome.trim();
  const e = empresa?.trim();
  if (!e || chaveNome(e) === chaveNome(n)) return { nome: n, segmento: null };
  if (chaveNome(e).startsWith(chaveNome(n))) return { nome: e, segmento: null };
  return { nome: n, segmento: e };
}

/** "Gabriel/Eunice", "Ana e Bia", "A, B" → uma pessoa por item. */
export function separarPessoas(texto: string | null | undefined): string[] {
  if (!texto?.trim()) return [];
  return texto
    .split(/\s*(?:\/|,|;|\be\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
}
