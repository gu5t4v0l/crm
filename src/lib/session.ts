import { createHmac, timingSafeEqual } from "node:crypto";
import { BASE_PATH } from "@/lib/basePath";
import { requireEnv } from "@/lib/env";

/**
 * Sessão sem estado: cookie com payload assinado (HMAC-SHA256).
 * Não importa Prisma — é usado pelo proxy.
 */

export const SESSION_COOKIE = "crm_session";
/** state + PKCE verifier durante o vai-e-volta do OAuth. */
export const OAUTH_COOKIE = "crm_oauth";
const DURACAO_SEGUNDOS = 60 * 60 * 24 * 30;

export type Sessao = { email: string; exp: number };

function assinar(payload: string): string {
  return createHmac("sha256", requireEnv("AUTH_SECRET")).update(payload).digest("base64url");
}

export function criarSessao(email: string): { valor: string; maxAge: number } {
  const sessao: Sessao = { email, exp: Math.floor(Date.now() / 1000) + DURACAO_SEGUNDOS };
  const payload = Buffer.from(JSON.stringify(sessao)).toString("base64url");
  return { valor: `${payload}.${assinar(payload)}`, maxAge: DURACAO_SEGUNDOS };
}

export function lerSessao(valor: string | undefined): Sessao | null {
  if (!valor) return null;
  const [payload, assinatura] = valor.split(".");
  if (!payload || !assinatura) return null;

  const esperada = Buffer.from(assinar(payload));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) {
    return null;
  }

  try {
    const sessao = JSON.parse(Buffer.from(payload, "base64url").toString()) as Sessao;
    if (typeof sessao.email !== "string" || typeof sessao.exp !== "number") return null;
    if (sessao.exp * 1000 < Date.now()) return null;
    // Trocar ALLOWED_EMAIL invalida sessões antigas.
    if (sessao.email !== emailPermitido()) return null;
    return sessao;
  } catch {
    return null;
  }
}

/** Único e-mail autorizado a entrar no CRM. */
export function emailPermitido(): string {
  return requireEnv("ALLOWED_EMAIL").trim().toLowerCase();
}

export const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: BASE_PATH,
};
