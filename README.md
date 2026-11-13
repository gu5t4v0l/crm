# CRM de Leads

Funil de vendas (kanban), atividades por lead, importação CSV e dashboard de métricas.
Next.js 16 (App Router) + Prisma 7 + PostgreSQL + Tailwind 4 — mesma stack do `dashboard-financeiro`.

## Rodando localmente

```bash
npm install
npm run db:migrate   # cria o schema "crm" e as tabelas
npm run seed         # opcional: 5 leads de exemplo
npm run dev           # abre em http://localhost:3000/crm
```

O app roda sob o basePath `/crm` (`src/lib/basePath.ts`), igual ao `/financeiro`. Em
produção, o site `web` faz rewrite de `/crm/*` para o deploy do CRM (`web/vercel.json`) —
ajuste o host de destino lá depois do primeiro deploy.

## Banco

Usa o **mesmo Postgres (Neon) do `dashboard-financeiro`**, em um schema isolado `crm` —
as tabelas do financeiro continuam no `public`, sem interferência. As duas URLs ficam no
`.env` (veja `.env.example`):

- `DATABASE_URL` — endpoint *pooled*, usado pelo app em runtime.
- `DATABASE_URL_UNPOOLED` — conexão direta, usada pelas migrations do Prisma.

O schema é aplicado em dois pontos: pelo adapter (`PrismaPg(pool, { schema: "crm" })` em
`src/lib/db.ts`) e pelo parâmetro `?schema=crm` nas URLs.

> Não inclua `channel_binding=require` nessas URLs: o engine de migrations do Prisma falha
> com `P1001` nesse modo. `sslmode=require` é suficiente.

## Estrutura

| Caminho | O quê |
| --- | --- |
| `src/app/page.tsx` | Funil kanban com drag-and-drop entre estágios |
| `src/app/metricas/page.tsx` | Dashboard de conversão, valores e origens |
| `src/app/importar/page.tsx` | Importação de leads por CSV |
| `src/app/api/leads` | CRUD de leads (`GET`/`POST`, `[id]` com `GET`/`PATCH`/`DELETE`) |
| `src/app/api/leads/[id]/atividades` | Atividades de um lead |
| `src/app/api/atividades/[id]` | Editar/concluir/remover atividade |
| `src/app/api/leads/importar` | `POST { csv }` → importação em massa |
| `src/app/api/metricas` | Agregados do funil |
| `src/lib/leads.ts` | Estágios, tipos de atividade e labels (fonte única) |
| `src/lib/csv.ts` | Parser de CSV e de valores em formato pt-BR |

## Modelo de dados

- **Lead** — nome, empresa, contatos, origem, valor, `estagio` (NOVO, CONTATO, PROPOSTA,
  GANHO, PERDIDO), `posicao` (ordem na coluna), responsável, observação, `fechadoEm`.
- **Atividade** — vinculada ao lead (cascade delete), com tipo (nota, ligação, e-mail,
  reunião, WhatsApp, tarefa), descrição, data/hora e flag de concluída.

Mover um lead para GANHO ou PERDIDO preenche `fechadoEm`, que alimenta o ciclo médio de
vendas nas métricas.

## Importação CSV

Separador `;`, `,` ou tab, detectado automaticamente. Só `nome` é obrigatório; as demais
colunas (empresa, email, telefone, origem, valor, estagio, responsavel, observacao) são
opcionais e aceitam apelidos comuns (status, vendedor, whatsapp, fonte, ticket…). Valores
em formato brasileiro (`R$ 1.234,56`) são convertidos e estágios aceitam sinônimos
("Negociação" → Proposta, "Fechado" → Ganho). Linhas sem nome são ignoradas e reportadas
na resposta.

## Pendências conhecidas

- Sem autenticação — a v1 assume uso interno. O `dashboard-financeiro` tem um esquema de
  sessão em `src/lib/auth.ts` que pode ser reaproveitado.
- A ordenação dentro de uma coluna é persistida (`posicao`), mas o drag-and-drop só
  reordena entre colunas; soltar em uma posição específica ainda não é suportado.
