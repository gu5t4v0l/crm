import { erroValidacao } from "@/server/erros";

/**
 * Leitores de campo para PATCH parcial: undefined = campo ausente (não mexe),
 * null = limpar, valor = gravar. Lançam erro 400 com mensagem para o usuário.
 */

type Entrada = Record<string, unknown>;

export function texto(input: Entrada, campo: string, rotulo: string, max = 500): string | null | undefined {
  const valor = input[campo];
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  if (typeof valor !== "string") throw erroValidacao(`${rotulo}: valor inválido`);
  const limpo = valor.trim();
  if (limpo.length > max) throw erroValidacao(`${rotulo} passa de ${max} caracteres`);
  return limpo || null;
}

export function textoObrigatorio(
  input: Entrada,
  campo: string,
  rotulo: string,
  { criacao, max = 200 }: { criacao: boolean; max?: number },
): string | undefined {
  const valor = texto(input, campo, rotulo, max);
  if (valor === undefined && !criacao) return undefined;
  if (!valor) throw erroValidacao(`${rotulo} é obrigatório`);
  return valor;
}

/** Texto passado por um normalizador de src/lib/normalizar.ts. */
export function normalizado(
  input: Entrada,
  campo: string,
  rotulo: string,
  normalizar: (valor: string) => string | null,
): string | null | undefined {
  const valor = texto(input, campo, rotulo);
  if (valor === undefined || valor === null) return valor;
  try {
    return normalizar(valor);
  } catch (error) {
    throw erroValidacao(error instanceof Error ? error.message : `${rotulo}: valor inválido`);
  }
}

export function opcao<T extends string>(
  input: Entrada,
  campo: string,
  rotulo: string,
  opcoes: readonly T[],
): T | null | undefined {
  const valor = input[campo];
  if (valor === undefined || valor === null) return valor;
  if (typeof valor !== "string" || !(opcoes as readonly string[]).includes(valor)) {
    throw erroValidacao(`${rotulo}: valor inválido`);
  }
  return valor as T;
}

export function booleano(input: Entrada, campo: string, rotulo: string): boolean | undefined {
  const valor = input[campo];
  if (valor === undefined) return undefined;
  if (typeof valor !== "boolean") throw erroValidacao(`${rotulo}: valor inválido`);
  return valor;
}

/** Remove chaves undefined — o Prisma ignora, mas facilita comparar/logar o que mudou. */
export function definidos<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
