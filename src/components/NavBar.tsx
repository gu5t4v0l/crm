"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/basePath";

const LINKS = [
  { href: "/", label: "Negócios" },
  { href: "/empresas", label: "Empresas" },
  { href: "/metricas", label: "Métricas" },
  { href: "/importar", label: "Importar" },
  { href: "/configuracoes", label: "Configurações" },
];

export default function NavBar() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <header className="border-b border-surface-border bg-surface">
      <nav className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight">
          CRM <span className="text-brand-teal">Leads</span>
        </Link>
        <ul className="flex items-center gap-1">
          {LINKS.map((link) => {
            const ativo = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    ativo
                      ? "bg-brand-teal-soft font-semibold text-brand-teal"
                      : "opacity-70 hover:opacity-100"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <form action={api("/api/auth/logout")} method="post" className="ml-auto">
          <button type="submit" className="rounded-lg px-3 py-1.5 text-sm opacity-70 hover:opacity-100">
            Sair
          </button>
        </form>
      </nav>
    </header>
  );
}
