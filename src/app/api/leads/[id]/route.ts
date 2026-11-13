import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseLeadInput } from "@/lib/leadInput";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { atividades: { orderBy: { dataHora: "desc" } } },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  return NextResponse.json(lead);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = parseLeadInput(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const atual = await prisma.lead.findUnique({ where: { id }, select: { estagio: true } });
  if (!atual) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const data = { ...parsed.data };

  // Ao mover para um novo estágio, joga para o fim da coluna (salvo posição explícita).
  if (data.estagio && data.estagio !== atual.estagio && data.posicao === undefined) {
    const ultimo = await prisma.lead.findFirst({
      where: { estagio: data.estagio },
      orderBy: { posicao: "desc" },
      select: { posicao: true },
    });
    data.posicao = (ultimo?.posicao ?? -1) + 1;
  }

  if (data.estagio === "GANHO" || data.estagio === "PERDIDO") {
    data.fechadoEm = new Date();
  } else if (data.estagio) {
    data.fechadoEm = null;
  }

  const lead = await prisma.lead.update({
    where: { id },
    data,
    include: { atividades: { orderBy: { dataHora: "desc" } } },
  });

  return NextResponse.json(lead);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.lead.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
