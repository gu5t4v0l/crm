/* Utilitários compartilhados pelos content scripts (mundo isolado da extensão). */

const CRM = {
  CHAVE: "leads",

  /** Regex tolerantes para achar contato em texto solto (bio, card, descrição). */
  regexEmail: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  regexTelefone: /(?:\+?55\s?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/,

  texto(elemento) {
    return (elemento?.textContent ?? "").replace(/\s+/g, " ").trim();
  },

  acharEmail(texto) {
    return texto.match(CRM.regexEmail)?.[0] ?? null;
  },

  acharTelefone(texto) {
    const bruto = texto.match(CRM.regexTelefone)?.[0];
    if (!bruto) return null;
    // Descarta sequências curtas demais para ser telefone brasileiro.
    return bruto.replace(/\D/g, "").length >= 10 ? bruto.trim() : null;
  },

  /** Chave de deduplicação: telefone > email > instagram > nome+empresa. */
  chaveLead(lead) {
    const digitos = (lead.telefone ?? "").replace(/\D/g, "");
    if (digitos.length >= 10) return `tel:${digitos}`;
    if (lead.email) return `mail:${lead.email.toLowerCase()}`;
    if (lead.instagram) return `ig:${lead.instagram.toLowerCase()}`;
    return `nome:${(lead.nome ?? "").toLowerCase()}|${(lead.empresa ?? "").toLowerCase()}`;
  },

  async listar() {
    const dados = await chrome.storage.local.get(CRM.CHAVE);
    return dados[CRM.CHAVE] ?? [];
  },

  /**
   * Grava os leads ignorando os que já estão na lista.
   * Retorna { salvos, duplicados }.
   */
  async salvar(novos) {
    const atuais = await CRM.listar();
    const vistos = new Set(atuais.map(CRM.chaveLead));
    const aceitos = [];

    for (const lead of novos) {
      if (!lead?.nome) continue;
      const chave = CRM.chaveLead(lead);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      aceitos.push({ ...lead, capturadoEm: new Date().toISOString() });
    }

    if (aceitos.length) {
      await chrome.storage.local.set({ [CRM.CHAVE]: [...atuais, ...aceitos] });
    }

    return { salvos: aceitos.length, duplicados: novos.length - aceitos.length };
  },

  aviso(mensagem) {
    let caixa = document.querySelector(".crm-aviso");
    if (!caixa) {
      caixa = document.createElement("div");
      caixa.className = "crm-aviso";
      document.body.appendChild(caixa);
    }
    caixa.textContent = mensagem;
    caixa.classList.add("crm-aviso--visivel");
    clearTimeout(caixa.dataset.timer);
    caixa.dataset.timer = setTimeout(() => {
      caixa.classList.remove("crm-aviso--visivel");
    }, 2600);
  },

  /** Cria (uma única vez) a barra flutuante com os botões de captura. */
  montarBarra(botoes) {
    if (document.querySelector(".crm-barra")) return;

    const barra = document.createElement("div");
    barra.className = "crm-barra";

    const titulo = document.createElement("span");
    titulo.className = "crm-barra__titulo";
    titulo.textContent = "CRM";
    barra.appendChild(titulo);

    for (const { rotulo, acao } of botoes) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "crm-barra__botao";
      botao.textContent = rotulo;
      botao.addEventListener("click", async () => {
        botao.disabled = true;
        try {
          await acao();
        } catch (erro) {
          CRM.aviso(`Erro: ${erro.message}`);
        } finally {
          botao.disabled = false;
        }
      });
      barra.appendChild(botao);
    }

    document.body.appendChild(barra);
  },

  /** Relata o resultado de uma captura de forma uniforme. */
  async registrar(leads) {
    if (!leads.length) {
      CRM.aviso("Nada encontrado nesta página.");
      return;
    }
    const { salvos, duplicados } = await CRM.salvar(leads);
    const partes = [`${salvos} lead(s) salvo(s)`];
    if (duplicados) partes.push(`${duplicados} repetido(s)`);
    CRM.aviso(partes.join(" · "));
  },
};
