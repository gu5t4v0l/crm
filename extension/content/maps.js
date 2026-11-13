/*
 * Captura de leads no Google Maps.
 *
 * O Maps não expõe classes estáveis, então a leitura se apoia no que muda menos:
 * os atributos `data-item-id` do painel do local e os `aria-label` dos cards da lista.
 * Se o Google mudar a marcação, é aqui que precisa de ajuste.
 */

const ORIGEM = "Google Maps";

function painelDoLocal() {
  // O painel aberto de um local é o <div role="main"> que tem aria-label com o nome.
  const painel = document.querySelector('div[role="main"][aria-label]');
  if (!painel) return null;
  const nome = painel.getAttribute("aria-label")?.trim();
  if (!nome || nome === "Resultados") return null;
  return { painel, nome };
}

function valorPorItemId(painel, prefixo) {
  const alvo = painel.querySelector(`[data-item-id^="${prefixo}"]`);
  if (!alvo) return null;
  // O aria-label vem como "Telefone: (11) 99999-0000" — fica só o que vem depois dos dois-pontos.
  const rotulo = alvo.getAttribute("aria-label") ?? CRM.texto(alvo);
  const depois = rotulo.includes(":") ? rotulo.slice(rotulo.indexOf(":") + 1) : rotulo;
  return depois.replace(/\s+/g, " ").trim() || null;
}

function capturarLocalAberto() {
  const atual = painelDoLocal();
  if (!atual) return [];

  const { painel, nome } = atual;
  const telefone = valorPorItemId(painel, "phone:tel:");
  const endereco = valorPorItemId(painel, "address");
  const site = valorPorItemId(painel, "authority");
  const categoria = CRM.texto(painel.querySelector('button[jsaction*="category"]'));

  // Categoria, endereço e site vão em colunas próprias (o CRM normaliza e usa para deduplicar).
  const observacao = `Maps: ${location.href.split("?")[0]}`;

  return [
    {
      nome,
      empresa: nome,
      segmento: categoria,
      email: site ? null : CRM.acharEmail(CRM.texto(painel)),
      telefone,
      site,
      endereco,
      origem: ORIGEM,
      observacao,
    },
  ];
}

function capturarListaDeResultados() {
  const feed = document.querySelector('div[role="feed"]');
  if (!feed) return [];

  const leads = [];

  for (const link of feed.querySelectorAll("a[href*='/maps/place/']")) {
    const nome = link.getAttribute("aria-label")?.trim();
    if (!nome) continue;

    // O card é o ancestral que carrega o bloco inteiro do resultado (nome, nota, telefone).
    const card = link.closest("div[jsaction]") ?? link.parentElement;
    const textoCard = CRM.texto(card);

    leads.push({
      nome,
      empresa: nome,
      email: null,
      telefone: CRM.acharTelefone(textoCard),
      origem: ORIGEM,
      observacao: `Lista do Maps: ${textoCard.slice(0, 180)}`,
    });
  }

  return leads;
}

CRM.montarBarra([
  {
    rotulo: "Capturar este local",
    acao: () => CRM.registrar(capturarLocalAberto()),
  },
  {
    rotulo: "Capturar lista",
    acao: () => CRM.registrar(capturarListaDeResultados()),
  },
]);
