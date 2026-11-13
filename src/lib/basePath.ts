export const BASE_PATH = "/crm";

/** Prefixa uma rota de API com o basePath — fetch do browser não faz isso sozinho. */
export function api(path: string) {
  return `${BASE_PATH}${path}`;
}
