/**
 * Na edição, só os campos que mudaram — assim a checagem de duplicata não reclama de dado
 * antigo já aceito. Sem `inicial` (criação), devolve tudo.
 */
export function alterados<T extends Record<string, string>>(form: T, inicial: T | null): Partial<T> {
  if (!inicial) return form;
  return Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== inicial[k])) as Partial<T>;
}
