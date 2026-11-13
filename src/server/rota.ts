import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { lerSessao, SESSION_COOKIE } from "@/lib/session";
import { ErroApp } from "@/server/erros";

/**
 * Envolve um route handler: confere a sessão (o proxy é a primeira barreira, esta é a segunda)
 * e converte ErroApp em resposta JSON. Erros inesperados viram 500 sem vazar detalhes.
 */
export function rota<Ctx>(handler: (request: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (request: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      const cookieStore = await cookies();
      if (!lerSessao(cookieStore.get(SESSION_COOKIE)?.value)) {
        throw new ErroApp(401, "Não autenticado");
      }
      return await handler(request, ctx);
    } catch (error) {
      if (error instanceof ErroApp) {
        return NextResponse.json(
          { error: error.message, ...(error.detalhes !== undefined ? { detalhes: error.detalhes } : {}) },
          { status: error.status },
        );
      }
      console.error(`[api] ${request.method} ${request.nextUrl.pathname}`, error);
      return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
  };
}

export async function lerJson(request: NextRequest): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ErroApp(400, "Dados inválidos");
  }
  return body as Record<string, unknown>;
}

export type ComId = { params: Promise<{ id: string }> };
