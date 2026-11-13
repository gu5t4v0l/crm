-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "crm";

-- CreateEnum
CREATE TYPE "EstagioLead" AS ENUM ('NOVO', 'CONTATO', 'PROPOSTA', 'GANHO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "TipoAtividade" AS ENUM ('NOTA', 'LIGACAO', 'EMAIL', 'REUNIAO', 'WHATSAPP', 'TAREFA');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "empresa" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "origem" TEXT,
    "valor" DECIMAL(12,2),
    "estagio" "EstagioLead" NOT NULL DEFAULT 'NOVO',
    "posicao" INTEGER NOT NULL DEFAULT 0,
    "responsavel" TEXT,
    "observacao" TEXT,
    "perdidoMotivo" TEXT,
    "fechadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atividade" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tipo" "TipoAtividade" NOT NULL DEFAULT 'NOTA',
    "descricao" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Atividade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_estagio_posicao_idx" ON "Lead"("estagio", "posicao");

-- CreateIndex
CREATE INDEX "Lead_origem_idx" ON "Lead"("origem");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Atividade_leadId_dataHora_idx" ON "Atividade"("leadId", "dataHora");

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
