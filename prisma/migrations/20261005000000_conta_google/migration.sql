-- CreateTable
CREATE TABLE "ContaGoogle" (
    "id" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "escopos" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaGoogle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContaGoogle_googleSub_key" ON "ContaGoogle"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "ContaGoogle_email_key" ON "ContaGoogle"("email");
