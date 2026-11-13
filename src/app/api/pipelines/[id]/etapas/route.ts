import { NextResponse } from "next/server";
import { criarEtapa, reordenarEtapas } from "@/server/pipelines";
import { lerJson, rota, type ComId } from "@/server/rota";

/** Nova etapa aberta: `{ nome, probabilidade?, cor?, posicao? }`. Devolve o pipeline. */
export const POST = rota<ComId>(async (request, { params }) => {
  const { id } = await params;
  return NextResponse.json(await criarEtapa(id, await lerJson(request)), { status: 201 });
});

/** Reordena as etapas abertas: `{ etapaIds: string[] }`. */
export const PUT = rota<ComId>(async (request, { params }) => {
  const { id } = await params;
  return NextResponse.json(await reordenarEtapas(id, await lerJson(request)));
});
