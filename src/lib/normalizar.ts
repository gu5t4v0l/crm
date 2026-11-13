/**
 * Normalização de dados de contato — a mesma regra vale para formulário, importação CSV e extensão,
 * e é o que torna a deduplicação confiável. Funções puras (usáveis no browser).
 * Cada uma devolve o valor normalizado, null para vazio, ou lança Error com mensagem para o usuário.
 */

function vazio(valor: string) {
  return valor.trim() === "";
}

/** Telefone em E.164. Sem DDI assume Brasil (+55); exige DDD. */
export function normalizarTelefone(valor: string): string | null {
  if (vazio(valor)) return null;
  const internacional = valor.trim().startsWith("+");
  let digitos = valor.replace(/\D/g, "");

  if (!internacional) {
    if (digitos.startsWith("0")) digitos = digitos.replace(/^0+/, "");
    if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  }

  if (digitos.startsWith("55") && digitos.length !== 12 && digitos.length !== 13) {
    throw new Error("Telefone brasileiro precisa de DDD + número");
  }
  if (digitos.length < 10 || digitos.length > 15) {
    throw new Error("Telefone inválido");
  }
  return `+${digitos}`;
}

/** CNPJ só com dígitos, validando os dígitos verificadores. */
export function normalizarCnpj(valor: string): string | null {
  if (vazio(valor)) return null;
  const d = valor.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) throw new Error("CNPJ inválido");

  const digito = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...base].reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = digito(d.slice(0, 12));
  const d2 = digito(d.slice(0, 12) + d1);
  if (d1 !== Number(d[12]) || d2 !== Number(d[13])) throw new Error("CNPJ inválido");
  return d;
}

export function normalizarEmail(valor: string): string | null {
  if (vazio(valor)) return null;
  const email = valor.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido");
  return email;
}

/** @ do Instagram, minúsculo e sem arroba. Aceita o @, a URL do perfil ou só o nome. */
export function normalizarInstagram(valor: string): string | null {
  if (vazio(valor)) return null;
  const handle = valor
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) throw new Error("Instagram inválido");
  return handle;
}

/** Hosts que não identificam a empresa: link de rede social/agregador colado no campo "site". */
const HOSTS_GENERICOS = [
  "instagram.com",
  "facebook.com",
  "wa.me",
  "api.whatsapp.com",
  "linktr.ee",
  "google.com",
  "goo.gl",
  "bit.ly",
];

/** Domínio do site (sem www), ou null quando o link é de rede social/agregador. */
export function dominioDoSite(site: string): string | null {
  if (vazio(site)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(site.trim()) ? site.trim() : `https://${site.trim()}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".")) return null;
    if (HOSTS_GENERICOS.some((g) => host === g || host.endsWith(`.${g}`))) return null;
    return host;
  } catch {
    return null;
  }
}

export function ehLinkInstagram(site: string) {
  return /^(https?:\/\/)?(www\.)?instagram\.com\//i.test(site.trim());
}

export function normalizarUf(valor: string): string | null {
  if (vazio(valor)) return null;
  const uf = valor.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) throw new Error("UF inválida");
  return uf;
}

/** Comparação de nomes para deduplicação: sem acento, caixa, pontuação e espaços extras. */
export function chaveNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
