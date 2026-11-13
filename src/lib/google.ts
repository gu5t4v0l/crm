import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { criptografar, descriptografar } from "@/lib/crypto";
import { requireEnv, urlApp } from "@/lib/env";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Login + acesso à agenda num consentimento só. */
export const ESCOPOS = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
];

/** Renova o access token um pouco antes de expirar. */
const MARGEM_EXPIRACAO_MS = 60_000;

export function redirectUri(): string {
  return urlApp("/api/auth/google/callback").toString();
}

export function gerarPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function urlDeAutorizacao(state: string, challenge: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: ESCOPOS.join(" "),
    access_type: "offline",
    // Força o consentimento para o Google sempre devolver refresh_token.
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    login_hint: requireEnv("ALLOWED_EMAIL"),
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
};

async function chamarTokenEndpoint(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      ...params,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token endpoint respondeu ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export type IdentidadeGoogle = { sub: string; email: string };

/**
 * Troca o code por tokens e extrai a identidade do id_token.
 * O id_token veio direto do Google por TLS, então basta validar emissor e audiência.
 */
export async function trocarCodigo(
  code: string,
  verifier: string,
): Promise<{ identidade: IdentidadeGoogle; tokens: TokenResponse }> {
  const tokens = await chamarTokenEndpoint({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri(),
  });

  if (!tokens.id_token) throw new Error("Google não devolveu id_token");
  const claims = JSON.parse(
    Buffer.from(tokens.id_token.split(".")[1], "base64url").toString(),
  ) as { iss: string; aud: string; sub: string; email?: string; email_verified?: boolean };

  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") {
    throw new Error("id_token com emissor inválido");
  }
  if (claims.aud !== requireEnv("GOOGLE_CLIENT_ID")) {
    throw new Error("id_token com audiência inválida");
  }
  if (!claims.email || !claims.email_verified) {
    throw new Error("E-mail do Google não verificado");
  }

  return { identidade: { sub: claims.sub, email: claims.email.toLowerCase() }, tokens };
}

/** Grava (ou atualiza) a conta conectada. Sem refresh_token novo, mantém o que já existe. */
export async function salvarConta(identidade: IdentidadeGoogle, tokens: TokenResponse) {
  const existente = await prisma.contaGoogle.findUnique({ where: { googleSub: identidade.sub } });
  if (!tokens.refresh_token && !existente) {
    throw new Error("Google não devolveu refresh_token — revogue o acesso do app e entre de novo");
  }

  const dados = {
    email: identidade.email,
    accessToken: criptografar(tokens.access_token),
    expiraEm: new Date(Date.now() + tokens.expires_in * 1000),
    escopos: tokens.scope,
  };

  await prisma.contaGoogle.upsert({
    where: { googleSub: identidade.sub },
    update: {
      ...dados,
      ...(tokens.refresh_token ? { refreshToken: criptografar(tokens.refresh_token) } : {}),
    },
    create: {
      ...dados,
      googleSub: identidade.sub,
      refreshToken: criptografar(tokens.refresh_token as string),
    },
  });
}

/** Access token válido para chamar as APIs do Google, renovando se necessário. */
export async function obterAccessToken(): Promise<string> {
  const conta = await prisma.contaGoogle.findFirst();
  if (!conta) throw new Error("Nenhuma conta Google conectada");

  if (conta.expiraEm.getTime() - MARGEM_EXPIRACAO_MS > Date.now()) {
    return descriptografar(conta.accessToken);
  }

  const tokens = await chamarTokenEndpoint({
    grant_type: "refresh_token",
    refresh_token: descriptografar(conta.refreshToken),
  });

  await prisma.contaGoogle.update({
    where: { id: conta.id },
    data: {
      accessToken: criptografar(tokens.access_token),
      expiraEm: new Date(Date.now() + tokens.expires_in * 1000),
      ...(tokens.refresh_token ? { refreshToken: criptografar(tokens.refresh_token) } : {}),
    },
  });

  return tokens.access_token;
}
