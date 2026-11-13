# Extensão de captura de leads

Extensão Chrome (Manifest V3) que captura leads no **Google Maps** e no **Instagram**,
acumula numa lista local e exporta um CSV no formato que a página `/importar` do CRM entende.

## Instalar

1. Chrome → `chrome://extensions`
2. Ligue o **Modo do desenvolvedor**
3. **Carregar sem compactação** → selecione esta pasta (`extension/`)

## Usar

Em qualquer página do Maps ou do Instagram aparece a barra **CRM** no canto inferior direito:

| Site | Botão | O que captura |
| --- | --- | --- |
| Google Maps | `Capturar este local` | nome, telefone, endereço, site e categoria do local aberto |
| Google Maps | `Capturar lista` | todos os resultados da busca lateral de uma vez |
| Instagram | `Capturar perfil` | nome, @, bio e o e-mail/telefone que aparecerem na bio |

Leads repetidos são ignorados (compara telefone, depois e-mail, depois nome + empresa).

Clicando no ícone da extensão você vê a lista capturada e pode, por lead:

- preencher o **valor** estimado,
- marcar o **estágio** (inclusive `Descartado`, que entra no CRM como Perdido),
- remover da lista.

Depois: **Copiar CSV** (e colar na caixa de texto de `/importar`) ou **Baixar .csv**
(e subir o arquivo na mesma página).

## Limitação conhecida

Maps e Instagram não têm marcação estável — não existe API pública para isso. A leitura usa
o que menos muda (`data-item-id` no Maps, o @ da URL no Instagram), mas se o Google ou a Meta
mudarem o HTML, os seletores em `content/maps.js` e `content/instagram.js` precisam de ajuste.
Confira sempre os dados no popup antes de importar.
