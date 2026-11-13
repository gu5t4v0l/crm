export function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function toDateTimeInputValue(value: string | Date | null | undefined) {
  const date = value ? (typeof value === "string" ? new Date(value) : value) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Dias inteiros desde a data (0 = hoje). */
export function diasDesde(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

/** Exibe telefone E.164 brasileiro como (11) 98765-4321; outros países ficam como estão. */
export function formatTelefone(value: string | null | undefined) {
  if (!value) return "-";
  const br = value.match(/^\+55(\d{2})(\d{4,5})(\d{4})$/);
  return br ? `(${br[1]}) ${br[2]}-${br[3]}` : value;
}

/** Data "AAAA-MM-DD" (campo @db.Date) sem deslocar o dia pelo fuso. */
export function formatDia(value: string | null | undefined) {
  if (!value) return "-";
  const [ano, mes, dia] = value.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Número com casas decimais no padrão pt-BR (vírgula). */
export function formatNumero(value: number, casas = 1) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
