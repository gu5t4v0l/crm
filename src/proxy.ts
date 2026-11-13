import { NextRequest, NextResponse } from "next/server";
import { BASE_PATH } from "@/lib/basePath";
import { ENV_SESSAO, envFaltando, urlApp } from "@/lib/env";
import { lerSessao, SESSION_COOKIE } from "@/lib/session";

/** Rotas acessíveis sem sessão. */
const PUBLICAS = ["/login", "/api/auth/"];

function semBasePath(pathname: string) {
  return pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;
}

export function proxy(request: NextRequest) {
  const faltando = envFaltando(ENV_SESSAO);
  if (faltando.length) return paginaDeConfiguracao(faltando);

  const path = semBasePath(request.nextUrl.pathname);
  if (PUBLICAS.some((p) => path === p || path.startsWith(p))) {
    return NextResponse.next();
  }

  if (lerSessao(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  return NextResponse.redirect(urlApp("/login", request.nextUrl.origin));
}

/** Em vez de quebrar com erro genérico, diz exatamente o que falta no .env. */
function paginaDeConfiguracao(faltando: string[]) {
  const itens = faltando.map((nome) => `<li><code>${nome}</code></li>`).join("");
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>CRM — configuração pendente</title>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1>Configuração pendente</h1><p>Faltam variáveis de ambiente no <code>.env</code>:</p><ul>${itens}</ul>
<p>Veja o <code>.env.example</code> — ele explica cada uma e como gerar os segredos. Depois reinicie o <code>npm run dev</code>.</p></body></html>`;
  return new NextResponse(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export const config = {
  // "/" explícito: com basePath, o padrão abaixo vira /crm/... e não cobre a raiz /crm.
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
