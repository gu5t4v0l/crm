/** Zera o funil: remove todos os leads e atividades do schema "crm". */
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "crm" }) });

async function main() {
  // Atividades saem junto por cascade, mas o delete explícito deixa a contagem clara.
  const atividades = await prisma.atividade.deleteMany();
  const leads = await prisma.lead.deleteMany();
  console.log(`Removidos: ${leads.count} lead(s), ${atividades.count} atividade(s).`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
