-- CreateEnum
CREATE TYPE "TipoEtapa" AS ENUM ('ABERTA', 'GANHO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "StatusNegocio" AS ENUM ('ABERTO', 'GANHO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "PapelContato" AS ENUM ('DECISOR', 'INFLUENCIADOR', 'USUARIO', 'FINANCEIRO', 'OUTRO');

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "arquivadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Etapa" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoEtapa" NOT NULL DEFAULT 'ABERTA',
    "ordem" INTEGER NOT NULL,
    "probabilidade" INTEGER,
    "cor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotivoPerda" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotivoPerda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Negocio" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "status" "StatusNegocio" NOT NULL DEFAULT 'ABERTO',
    "valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previsaoFechamento" DATE,
    "origem" "Origem",
    "rank" TEXT NOT NULL,
    "etapaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" TIMESTAMP(3),
    "motivoPerdaId" TEXT,
    "motivoPerdaDetalhe" TEXT,
    "observacao" TEXT,
    "arquivadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegocioContato" (
    "negocioId" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "papel" "PapelContato",

    CONSTRAINT "NegocioContato_pkey" PRIMARY KEY ("negocioId","contatoId")
);

-- CreateTable
CREATE TABLE "HistoricoEtapa" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "deEtapaId" TEXT,
    "paraEtapaId" TEXT,
    "paraTipo" "TipoEtapa" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoEtapa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Etapa_pipelineId_ordem_idx" ON "Etapa"("pipelineId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "Etapa_pipelineId_id_key" ON "Etapa"("pipelineId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MotivoPerda_nome_key" ON "MotivoPerda"("nome");

-- CreateIndex
CREATE INDEX "Negocio_pipelineId_etapaId_rank_idx" ON "Negocio"("pipelineId", "etapaId", "rank");

-- CreateIndex
CREATE INDEX "Negocio_empresaId_idx" ON "Negocio"("empresaId");

-- CreateIndex
CREATE INDEX "Negocio_status_arquivadoEm_idx" ON "Negocio"("status", "arquivadoEm");

-- CreateIndex
CREATE INDEX "NegocioContato_contatoId_idx" ON "NegocioContato"("contatoId");

-- CreateIndex
CREATE INDEX "HistoricoEtapa_negocioId_em_idx" ON "HistoricoEtapa"("negocioId", "em");

-- CreateIndex
CREATE INDEX "HistoricoEtapa_paraEtapaId_em_idx" ON "HistoricoEtapa"("paraEtapaId", "em");

-- AddForeignKey
ALTER TABLE "Etapa" ADD CONSTRAINT "Etapa_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_pipelineId_etapaId_fkey" FOREIGN KEY ("pipelineId", "etapaId") REFERENCES "Etapa"("pipelineId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_motivoPerdaId_fkey" FOREIGN KEY ("motivoPerdaId") REFERENCES "MotivoPerda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegocioContato" ADD CONSTRAINT "NegocioContato_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegocioContato" ADD CONSTRAINT "NegocioContato_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "Contato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoEtapa" ADD CONSTRAINT "HistoricoEtapa_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoEtapa" ADD CONSTRAINT "HistoricoEtapa_deEtapaId_fkey" FOREIGN KEY ("deEtapaId") REFERENCES "Etapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoEtapa" ADD CONSTRAINT "HistoricoEtapa_paraEtapaId_fkey" FOREIGN KEY ("paraEtapaId") REFERENCES "Etapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Regras que o Prisma não expressa no schema
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_valor_check" CHECK ("valor" >= 0);
ALTER TABLE "Etapa" ADD CONSTRAINT "Etapa_probabilidade_check" CHECK ("probabilidade" BETWEEN 0 AND 100);
ALTER TABLE "HistoricoEtapa" ADD CONSTRAINT "HistoricoEtapa_valor_check" CHECK ("valor" >= 0);

-- Dados iniciais: pipeline padrão com as mesmas etapas do funil antigo
INSERT INTO "Pipeline" ("id", "nome", "padrao", "ordem", "updatedAt")
VALUES ('pipeline_vendas', 'Vendas', true, 0, CURRENT_TIMESTAMP);

INSERT INTO "Etapa" ("id", "pipelineId", "nome", "tipo", "ordem", "probabilidade", "cor", "updatedAt") VALUES
  ('etapa_novo',     'pipeline_vendas', 'Novo',       'ABERTA',  0, 10,  '#0abab5', CURRENT_TIMESTAMP),
  ('etapa_contato',  'pipeline_vendas', 'Em contato', 'ABERTA',  1, 25,  '#3b82f6', CURRENT_TIMESTAMP),
  ('etapa_proposta', 'pipeline_vendas', 'Proposta',   'ABERTA',  2, 50,  '#f59e0b', CURRENT_TIMESTAMP),
  ('etapa_ganho',    'pipeline_vendas', 'Ganho',      'GANHO',   3, 100, '#22c55e', CURRENT_TIMESTAMP),
  ('etapa_perdido',  'pipeline_vendas', 'Perdido',    'PERDIDO', 4, 0,   '#ef4444', CURRENT_TIMESTAMP);

INSERT INTO "MotivoPerda" ("id", "nome", "ordem") VALUES
  ('motivo_preco',       'Preço',                0),
  ('motivo_orcamento',   'Sem orçamento',        1),
  ('motivo_concorrente', 'Escolheu concorrente', 2),
  ('motivo_sem_resposta','Sem resposta',         3),
  ('motivo_sem_fit',     'Sem fit',              4),
  ('motivo_timing',      'Momento errado',       5),
  ('motivo_outro',       'Outro',                6);
