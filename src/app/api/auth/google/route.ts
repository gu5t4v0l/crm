import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { gerarPkce, urlDeAutorizacao } from "@/lib/google";
import { cookieBase, OAUTH_COOKIE } from "@/lib/session";

/** Inicia o login: guarda state + PKCE num cookie curto e manda para o consentimento do Google. */
export async function GET() {
  const state = randomBytes(16).toString("base64url");
  const { verifier, challenge } = gerarPkce();

  const response = NextResponse.redirect(urlDeAutorizacao(state, challenge));
  response.cookies.set(OAUTH_COOKIE, `${state}.${verifier}`, { ...cookieBase, maxAge: 600 });
  return response;
}
