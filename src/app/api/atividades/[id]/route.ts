import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTipoAtividade } from "@/lib/leads";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const data: {
    descricao?: string;
    tipo?: "NOTA" | "LIGACAO" | "EMAIL" | "REUNIAO" | "WHATSAPP" | "TAREFA";
    concluida?: boolean;
    dataHora?: Date;
  } = {};

  if (body.descricao !== undefined) {
    if (typeof body.descricao !== "string" || !body.descricao.trim()) {
      return NextResponse.json({ error: "Descrição inválida" }, { status: 400 });
    }
    data.descricao = body.descricao.trim();
  }

  if (body.tipo !== undefined) {
    if (!isTipoAtividade(body.tipo)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }
    data.tipo = body.tipo;
  }

  if (body.concluida !== undefined) data.concluida = Boolean(body.concluida);

  if (body.dataHora !== undefined) {
    const dataHora = new Date(body.dataHora);
    if (Number.isNaN(dataHora.getTime())) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }
    data.dataHora = dataHora;
  }

  const atividade = await prisma.atividade.update({ where: { id }, data });
  return NextResponse.json(atividade);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.atividade.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
