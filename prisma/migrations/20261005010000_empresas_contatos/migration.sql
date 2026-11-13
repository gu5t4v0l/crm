-- CreateEnum
CREATE TYPE "StatusEmpresa" AS ENUM ('PROSPECT', 'CLIENTE', 'EX_CLIENTE', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "Origem" AS ENUM ('MAPS', 'INSTAGRAM', 'WHATSAPP', 'INDICACAO', 'PARCERIA', 'SITE', 'EVENTO', 'OUTRO');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "segmento" TEXT,
    "status" "StatusEmpresa" NOT NULL DEFAULT 'PROSPECT',
    "origem" "Origem",
    "cnpj" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "site" TEXT,
    "dominio" TEXT,
    "instagram" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "uf" CHAR(2),
    "observacao" TEXT,
    "arquivadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contato" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "arquivadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_cnpj_key" ON "Empresa"("cnpj");

-- CreateIndex
CREATE INDEX "Empresa_arquivadaEm_status_idx" ON "Empresa"("arquivadaEm", "status");

-- CreateIndex
CREATE INDEX "Empresa_nome_idx" ON "Empresa"("nome");

-- CreateIndex
CREATE INDEX "Empresa_telefone_idx" ON "Empresa"("telefone");

-- CreateIndex
CREATE INDEX "Empresa_dominio_idx" ON "Empresa"("dominio");

-- CreateIndex
CREATE INDEX "Empresa_instagram_idx" ON "Empresa"("instagram");

-- CreateIndex
CREATE UNIQUE INDEX "Contato_email_key" ON "Contato"("email");

-- CreateIndex
CREATE INDEX "Contato_empresaId_arquivadoEm_idx" ON "Contato"("empresaId", "arquivadoEm");

-- CreateIndex
CREATE INDEX "Contato_nome_idx" ON "Contato"("nome");

-- CreateIndex
CREATE INDEX "Contato_telefone_idx" ON "Contato"("telefone");

-- AddForeignKey
ALTER TABLE "Contato" ADD CONSTRAINT "Contato_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
