import { api } from "@/lib/basePath";
import { ENV_GOOGLE, envFaltando, loginDevDisponivel } from "@/lib/env";

const ERROS: Record<string, string> = {
  negado: "Login cancelado no Google.",
  estado: "A sessão de login expirou. Tente de novo.",
  email: "Esta conta Google não tem acesso a este CRM.",
  falha: "Não foi possível concluir o login. Tente de novo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const mensagem = erro ? (ERROS[erro] ?? ERROS.falha) : null;
  const googleFaltando = envFaltando(ENV_GOOGLE);
  const dev = loginDevDisponivel();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          CRM <span className="text-brand-teal">Leads</span>
        </h1>
        <p className="mt-2 text-sm opacity-70">
          Entre com sua conta Google. O acesso à agenda é usado para sincronizar compromissos.
        </p>

        {mensagem && (
          <p className="mt-6 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {mensagem}
          </p>
        )}

        {googleFaltando.length ? (
          <p className="mt-6 rounded-lg bg-amber-500/10 px-3 py-2 text-left text-sm">
            Login com Google ainda não configurado. Falta no <code>.env</code>: {googleFaltando.join(", ")}.
          </p>
        ) : (
          // <a> e não <Link>: é um redirect de servidor para o Google, não uma navegação do app.
          <a
            href={api("/api/auth/google")}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand-teal px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Entrar com Google
          </a>
        )}

        {dev ? (
          <form action={api("/api/auth/dev")} method="post" className="mt-3">
            <button type="submit" className="btn-ghost w-full">
              Entrar sem Google (só em desenvolvimento)
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
