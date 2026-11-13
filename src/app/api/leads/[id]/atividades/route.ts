import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTipoAtividade } from "@/lib/leads";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const atividades = await prisma.atividade.findMany({
    where: { leadId: id },
    orderBy: { dataHora: "desc" },
  });
  return NextResponse.json(atividades);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.descricao !== "string" || !body.descricao.trim()) {
    return NextResponse.json({ error: "Descrição é obrigatória" }, { status: 400 });
  }

  if (body.tipo !== undefined && !isTipoAtividade(body.tipo)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true } });
  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const dataHora = body.dataHora ? new Date(body.dataHora) : new Date();
  if (Number.isNaN(dataHora.getTime())) {
    return NextResponse.json({ error: "Data inválida" }, { status: 400 });
  }

  const atividade = await prisma.atividade.create({
    data: {
      leadId: id,
      tipo: body.tipo ?? "NOTA",
      descricao: body.descricao.trim(),
      dataHora,
      concluida: Boolean(body.concluida),
    },
  });

  return NextResponse.json(atividade, { status: 201 });
}
