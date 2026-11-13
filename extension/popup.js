/* Lista os leads capturados, deixa qualificar (valor/estágio) e exporta o CSV do CRM. */

const CHAVE = "leads";
const COLUNAS = [
  "nome",
  "empresa",
  "segmento",
  "email",
  "telefone",
  "site",
  "instagram",
  "endereco",
  "origem",
  "valor",
  "estagio",
  "observacao",
];
const ESTAGIOS = [
  ["NOVO", "Novo"],
  ["CONTATO", "Em contato"],
  ["PROPOSTA", "Proposta"],
  ["GANHO", "Ganho"],
  ["PERDIDO", "Descartado"],
];

const lista = document.getElementById("lista");
const vazio = document.getElementById("vazio");
const contador = document.getElementById("contador");
const status = document.getElementById("status");
const botaoCopiar = document.getElementById("copiar");
const botaoBaixar = document.getElementById("baixar");
const botaoLimpar = document.getElementById("limpar");

let leads = [];

async function carregar() {
  const dados = await chrome.storage.local.get(CHAVE);
  leads = dados[CHAVE] ?? [];
  desenhar();
}

async function persistir() {
  await chrome.storage.local.set({ [CHAVE]: leads });
  desenhar();
}

function avisar(mensagem) {
  status.textContent = mensagem;
  clearTimeout(avisar.timer);
  avisar.timer = setTimeout(() => {
    status.textContent = "";
  }, 2500);
}

function desenhar() {
  lista.replaceChildren();
  contador.textContent = String(leads.length);
  vazio.hidden = leads.length > 0;

  const semLeads = leads.length === 0;
  botaoCopiar.disabled = semLeads;
  botaoBaixar.disabled = semLeads;
  botaoLimpar.disabled = semLeads;

  leads.forEach((lead, indice) => {
    const estagio = lead.estagio ?? "NOVO";

    const item = document.createElement("li");
    item.className = estagio === "PERDIDO" ? "item item--descartado" : "item";

    const topo = document.createElement("div");
    topo.className = "item__topo";

    const nome = document.createElement("span");
    nome.className = "item__nome";
    nome.textContent = lead.nome;

    const origem = document.createElement("span");
    origem.className = "item__origem";
    origem.textContent = lead.origem ?? "";

    topo.append(nome, origem);

    const detalhe = document.createElement("div");
    detalhe.className = "item__detalhe";
    detalhe.textContent =
      [lead.telefone, lead.email, lead.instagram ? `@${lead.instagram}` : lead.empresa].filter(Boolean).join(" · ") ||
      "sem contato";
    detalhe.title = lead.observacao ?? "";

    const controles = document.createElement("div");
    controles.className = "item__controles";

    const valor = document.createElement("input");
    valor.className = "campo";
    valor.type = "number";
    valor.min = "0";
    valor.step = "50";
    valor.placeholder = "R$ valor";
    valor.value = lead.valor ?? "";
    valor.addEventListener("change", () => {
      leads[indice].valor = valor.value === "" ? null : Number(valor.value);
      persistir();
    });

    const selecao = document.createElement("select");
    selecao.className = "selecao";
    for (const [chave, rotulo] of ESTAGIOS) {
      const opcao = document.createElement("option");
      opcao.value = chave;
      opcao.textContent = rotulo;
      opcao.selected = chave === estagio;
      selecao.appendChild(opcao);
    }
    selecao.addEventListener("change", () => {
      leads[indice].estagio = selecao.value;
      persistir();
    });

    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "remover";
    remover.textContent = "✕";
    remover.title = "Remover da lista";
    remover.addEventListener("click", () => {
      leads.splice(indice, 1);
      persistir();
    });

    controles.append(valor, selecao, remover);
    item.append(topo, detalhe, controles);
    lista.appendChild(item);
  });
}

/** Escapa um campo para CSV com separador ";" (o importador do CRM detecta sozinho). */
function celula(valor) {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function montarCsv() {
  const linhas = [COLUNAS.join(";")];
  for (const lead of leads) {
    linhas.push(
      COLUNAS.map((coluna) => celula(coluna === "estagio" ? lead.estagio ?? "NOVO" : lead[coluna])).join(";"),
    );
  }
  return linhas.join("\n");
}

botaoCopiar.addEventListener("click", async () => {
  await navigator.clipboard.writeText(montarCsv());
  avisar("CSV copiado — cole na página Importar do CRM.");
});

botaoBaixar.addEventListener("click", () => {
  // BOM na frente para o Excel abrir os acentos corretamente.
  const blob = new Blob(["\uFEFF", montarCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

botaoLimpar.addEventListener("click", async () => {
  if (!confirm(`Remover os ${leads.length} lead(s) capturados?`)) return;
  leads = [];
  await persistir();
  avisar("Lista limpa.");
});

chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === "local" && mudancas[CHAVE]) {
    leads = mudancas[CHAVE].newValue ?? [];
    desenhar();
  }
});

carregar();
