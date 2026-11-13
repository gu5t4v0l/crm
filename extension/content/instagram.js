/*
 * Captura de leads no Instagram (página de perfil).
 *
 * O Instagram troca as classes a cada deploy, então a leitura usa o @ da URL como
 * âncora e procura o cabeçalho a partir dele. Contato sai da bio por regex.
 */

const ORIGEM = "Instagram";
const ROTAS_RESERVADAS = new Set([
  "explore", "reels", "direct", "stories", "accounts", "p", "about",
  "developer", "legal", "privacy", "challenge", "emails",
]);

function handleDaUrl() {
  const primeiro = location.pathname.split("/").filter(Boolean)[0];
  if (!primeiro || ROTAS_RESERVADAS.has(primeiro)) return null;
  return primeiro;
}

function cabecalho() {
  return document.querySelector("header") ?? document.querySelector("main");
}

function textoDaBio(header, handle) {
  if (!header) return "";
  // A bio é a maior porção de texto do cabeçalho que não é o próprio @ nem os contadores.
  const candidatos = [...header.querySelectorAll("section span, section div, h1, h2")]
    .map(CRM.texto)
    .filter((t) => t.length > 2 && t.length < 400)
    .filter((t) => t.toLowerCase() !== handle.toLowerCase())
    .filter((t) => !/seguidores|seguindo|publica|followers|following|posts/i.test(t));

  return [...new Set(candidatos)].join(" \n ");
}

function nomeExibido(header, handle) {
  const titulo = CRM.texto(header?.querySelector("h1")) || CRM.texto(header?.querySelector("h2"));
  if (titulo && titulo.toLowerCase() !== handle.toLowerCase()) return titulo;
  return handle;
}

function capturarPerfil() {
  const handle = handleDaUrl();
  if (!handle) return [];

  const header = cabecalho();
  const bio = textoDaBio(header, handle);
  const perfil = `https://www.instagram.com/${handle}/`;

  const observacao = [`Perfil: ${perfil}`, bio ? `Bio: ${bio.replace(/\n/g, " ")}` : null]
    .filter(Boolean)
    .join(" | ");

  return [
    {
      nome: nomeExibido(header, handle),
      instagram: handle,
      email: CRM.acharEmail(bio),
      telefone: CRM.acharTelefone(bio),
      origem: ORIGEM,
      observacao: observacao.slice(0, 500),
    },
  ];
}

CRM.montarBarra([
  {
    rotulo: "Capturar perfil",
    acao: () => CRM.registrar(capturarPerfil()),
  },
]);
