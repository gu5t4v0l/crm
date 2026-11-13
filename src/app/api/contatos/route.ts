import { NextResponse } from "next/server";
import { criarContato, lerContato, listarContatos } from "@/server/contatos";
import { lerJson, rota } from "@/server/rota";

export const GET = rota(async (request) => {
  const params = request.nextUrl.searchParams;
  const contatos = await listarContatos({
    busca: params.get("busca")?.trim() || undefined,
    empresaId: params.get("empresaId") || undefined,
    arquivados: params.get("arquivados") === "1",
  });
  return NextResponse.json(contatos);
});

export const POST = rota(async (request) => {
  const body = await lerJson(request);
  const contato = await criarContato(lerContato(body, { criacao: true }), { forcar: body.forcar === true });
  return NextResponse.json(contato, { status: 201 });
});
