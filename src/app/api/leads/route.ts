import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEstagio } from "@/lib/leads";
import { parseLeadInput } from "@/lib/leadInput";

export async function GET(request: NextRequest) {
  const estagio = request.nextUrl.searchParams.get("estagio");
  const busca = request.nextUrl.searchParams.get("busca")?.trim();

  const leads = await prisma.lead.findMany({
    where: {
      ...(isEstagio(estagio) ? { estagio } : {}),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" as const } },
              { empresa: { contains: busca, mode: "insensitive" as const } },
              { email: { contains: busca, mode: "insensitive" as const } },
              { telefone: { contains: busca, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ estagio: "asc" }, { posicao: "asc" }, { createdAt: "desc" }],
    include: {
      atividades: { orderBy: { dataHora: "desc" }, take: 3 },
    },
  });

  return NextResponse.json(leads);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = parseLeadInput(body, { requireNome: true });

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const estagio = parsed.data.estagio ?? "NOVO";
  const ultimo = await prisma.lead.findFirst({
    where: { estagio },
    orderBy: { posicao: "desc" },
    select: { posicao: true },
  });

  const lead = await prisma.lead.create({
    data: {
      ...parsed.data,
      nome: parsed.data.nome as string,
      estagio,
      posicao: (ultimo?.posicao ?? -1) + 1,
    },
  });

  return NextResponse.json(lead, { status: 201 });
}
