import { NextResponse } from "next/server";
import { atualizarEtapa, excluirEtapa } from "@/server/pipelines";
import { lerJson, rota, type ComId } from "@/server/rota";

/** `{ nome?, probabilidade?, cor? }`. Devolve o pipeline. */
export const PATCH = rota<ComId>(async (request, { params }) => {
  const { id } = await params;
  return NextResponse.json(await atualizarEtapa(id, await lerJson(request)));
});

/** `?moverPara=<etapaId>` é obrigatório se a etapa tiver negócios. Devolve o pipeline. */
export const DELETE = rota<ComId>(async (request, { params }) => {
  const { id } = await params;
  return NextResponse.json(await excluirEtapa(id, request.nextUrl.searchParams.get("moverPara")));
});
