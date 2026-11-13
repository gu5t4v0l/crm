import { api } from "@/lib/basePath";
import type { Duplicado } from "@/lib/empresas";

/** Erro devolvido pela API (ver src/server/rota.ts). `detalhes` traz as duplicatas num 409. */
export class ErroApi extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detalhes?: unknown,
  ) {
    super(message);
  }

  get duplicados(): Duplicado[] | null {
    return this.status === 409 && Array.isArray(this.detalhes) ? (this.detalhes as Duplicado[]) : null;
  }
}

/** fetch na API do CRM: prefixa o basePath, manda/recebe JSON e lança ErroApi em status de erro. */
export async function chamar<T>(caminho: string, opcoes: { method?: string; body?: unknown } = {}): Promise<T> {
  const resposta = await fetch(api(caminho), {
    method: opcoes.method ?? (opcoes.body === undefined ? "GET" : "POST"),
    headers: opcoes.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
  });
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new ErroApi(resposta.status, corpo?.error ?? "Não foi possível concluir", corpo?.detalhes);
  }
  return corpo as T;
}

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Erro inesperado";
}
