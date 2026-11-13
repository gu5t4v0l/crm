/**
 * Fractional indexing para ordenar cards: entre quaisquer duas chaves sempre cabe outra,
 * então mover um card grava só ele (o funil antigo reindexava a coluna inteira).
 *
 * Alfabeto base 36 só com dígitos e minúsculas: a ordem lexicográfica é a mesma no collation
 * "C" e no en_US do Postgres, então ORDER BY rank funciona sem COLLATE.
 * Chaves nunca terminam em "0" — senão não haveria espaço logo antes delas.
 */

const DIGITOS = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE = DIGITOS.length;

function meio(a: string, b: string | null): string {
  if (b !== null) {
    // Prefixo comum: o resultado começa igual e o problema reduz para o resto.
    let n = 0;
    while ((a[n] ?? "0") === b[n]) n++;
    if (n > 0) return b.slice(0, n) + meio(a.slice(n), b.slice(n));
  }

  const da = a ? DIGITOS.indexOf(a[0]) : 0;
  const db = b !== null ? DIGITOS.indexOf(b[0]) : BASE;

  if (db - da > 1) return DIGITOS[Math.round((da + db) / 2)];
  // Dígitos vizinhos: se b tem mais casas, o primeiro dígito dele sozinho já fica no meio.
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITOS[da] + meio(a.slice(1), null);
}

/** Chave estritamente entre `antes` e `depois` (null = ponta da lista). */
export function rankEntre(antes: string | null, depois: string | null): string {
  if (antes !== null && depois !== null && antes >= depois) {
    throw new Error(`rank inválido: ${antes} >= ${depois}`);
  }
  for (const chave of [antes, depois]) {
    if (chave !== null && (!/^[0-9a-z]+$/.test(chave) || chave.endsWith("0"))) {
      throw new Error(`rank inválido: ${chave}`);
    }
  }
  return meio(antes ?? "", depois);
}

/** Acima disso a coluna é rebalanceada (inserir sempre na mesma ponta cresce ~1 caractere a cada 5). */
export const RANK_TAMANHO_MAX = 12;

/** `n` chaves curtas e igualmente espaçadas, em ordem — usado para rebalancear uma coluna. */
export function ranksEspacados(n: number): string[] {
  const casas = Math.ceil(Math.log(n + 1) / Math.log(BASE)) + 1;
  const passo = BASE ** casas / (n + 1);
  // Tirar zeros à direita preserva a ordem e a unicidade, já que todas têm o mesmo tamanho.
  return Array.from({ length: n }, (_, i) =>
    Math.round(passo * (i + 1)).toString(BASE).padStart(casas, "0").replace(/0+$/, ""),
  );
}
