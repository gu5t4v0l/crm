import { BASE_PATH } from "@/lib/basePath";

/** Lê uma variável de ambiente obrigatória — falha alto em vez de seguir com undefined. */
export function requireEnv(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável de ambiente ${nome} não configurada`);
  }
  return valor;
}

/** Sem estas o CRM não abre (sessão). */
export const ENV_SESSAO = ["AUTH_SECRET", "ALLOWED_EMAIL"] as const;
/** Sem estas o login com Google não funciona. */
export const ENV_GOOGLE = ["APP_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY"] as const;

export function envFaltando(nomes: readonly string[]): string[] {
  return nomes.filter((nome) => !process.env[nome]);
}

/** Login sem Google, só com `next dev` — para usar o CRM local antes de configurar o OAuth. */
export function loginDevDisponivel() {
  return process.env.NODE_ENV === "development";
}

/**
 * URL pública absoluta de uma rota do app (com basePath).
 * Usa APP_URL em vez do host da request, que atrás de rewrite pode ser o interno;
 * sem APP_URL (desenvolvimento), cai na origem da própria request.
 */
export function urlApp(path: string, origemDaRequest?: string): URL {
  const base = process.env.APP_URL || origemDaRequest;
  if (!base) throw new Error("Variável de ambiente APP_URL não configurada");
  return new URL(`${BASE_PATH}${path}`, base);
}
