import { NextRequest, NextResponse } from "next/server";
import { loginDevDisponivel, urlApp } from "@/lib/env";
import { cookieBase, criarSessao, emailPermitido, SESSION_COOKIE } from "@/lib/session";

/**
 * Login sem Google para desenvolvimento local. Só existe com `next dev`
 * (NODE_ENV=development); em build de produção responde 404.
 */
export async function POST(request: NextRequest) {
  if (!loginDevDisponivel()) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  const sessao = criarSessao(emailPermitido());
  const response = NextResponse.redirect(urlApp("/", request.nextUrl.origin), 303);
  response.cookies.set(SESSION_COOKIE, sessao.valor, { ...cookieBase, maxAge: sessao.maxAge });
  return response;
}
