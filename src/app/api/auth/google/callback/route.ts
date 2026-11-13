import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { urlApp } from "@/lib/env";
import { salvarConta, trocarCodigo } from "@/lib/google";
import { cookieBase, criarSessao, emailPermitido, OAUTH_COOKIE, SESSION_COOKIE } from "@/lib/session";

function falha(request: NextRequest, erro: string) {
  const url = urlApp("/login", request.nextUrl.origin);
  url.searchParams.set("erro", erro);
  const response = NextResponse.redirect(url);
  response.cookies.delete({ name: OAUTH_COOKIE, path: cookieBase.path });
  return response;
}

function mesmoValor(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return falha(request, "negado");

  const code = params.get("code");
  const state = params.get("state");
  const [stateEsperado, verifier] = request.cookies.get(OAUTH_COOKIE)?.value.split(".") ?? [];
  if (!code || !state || !stateEsperado || !verifier || !mesmoValor(state, stateEsperado)) {
    return falha(request, "estado");
  }

  try {
    const { identidade, tokens } = await trocarCodigo(code, verifier);
    if (identidade.email !== emailPermitido()) return falha(request, "email");

    await salvarConta(identidade, tokens);

    const sessao = criarSessao(identidade.email);
    const response = NextResponse.redirect(urlApp("/", request.nextUrl.origin));
    response.cookies.delete({ name: OAUTH_COOKIE, path: cookieBase.path });
    response.cookies.set(SESSION_COOKIE, sessao.valor, { ...cookieBase, maxAge: sessao.maxAge });
    return response;
  } catch (error) {
    console.error("[auth] falha no callback do Google", error);
    return falha(request, "falha");
  }
}
