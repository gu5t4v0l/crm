import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "crm" }) });

const LEADS = [
  {
    nome: "Ana Souza",
    empresa: "Acme Ltda",
    email: "ana@acme.com",
    telefone: "(11) 99999-0000",
    origem: "Instagram",
    valor: 2500,
    estagio: "NOVO" as const,
    responsavel: "Carlos",
  },
  {
    nome: "João Lima",
    empresa: "Beta S/A",
    email: "joao@beta.com",
    telefone: "(21) 98888-1111",
    origem: "Indicação",
    valor: 8000,
    estagio: "PROPOSTA" as const,
    responsavel: "Marina",
  },
  {
    nome: "Paula Ribeiro",
    empresa: "Gamma Comércio",
    email: "paula@gamma.com",
    origem: "Google Ads",
    valor: 4200,
    estagio: "CONTATO" as const,
    responsavel: "Carlos",
  },
  {
    nome: "Rafael Torres",
    empresa: "Delta Serviços",
    email: "rafael@delta.com",
    origem: "Indicação",
    valor: 15000,
    estagio: "GANHO" as const,
    responsavel: "Marina",
  },
  {
    nome: "Carla Mendes",
    empresa: "Epsilon Tech",
    origem: "Instagram",
    valor: 3000,
    estagio: "PERDIDO" as const,
    responsavel: "Carlos",
  },
];

async function main() {
  await prisma.atividade.deleteMany();
  await prisma.lead.deleteMany();

  const posicoes = new Map<string, number>();

  for (const lead of LEADS) {
    const posicao = posicoes.get(lead.estagio) ?? 0;
    posicoes.set(lead.estagio, posicao + 1);

    const criado = await prisma.lead.create({
      data: {
        ...lead,
        posicao,
        fechadoEm:
          lead.estagio === "GANHO" || lead.estagio === "PERDIDO" ? new Date() : null,
      },
    });

    await prisma.atividade.create({
      data: {
        leadId: criado.id,
        tipo: "NOTA",
        descricao: `Lead criado via seed (${lead.origem ?? "sem origem"})`,
      },
    });
  }

  console.log(`Seed concluído: ${LEADS.length} leads.`);
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
