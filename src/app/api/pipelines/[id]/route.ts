import { NextResponse } from "next/server";
import { atualizarPipeline, obterPipeline } from "@/server/pipelines";
import { lerJson, rota, type ComId } from "@/server/rota";

export const GET = rota<ComId>(async (_request, { params }) => {
  const { id } = await params;
  return NextResponse.json(await obterPipeline(id));
});

/** `{ nome?, padrao?: true, arquivado? }` */
export const PATCH = rota<ComId>(async (request, { params }) => {
  const { id } = await params;
  return NextResponse.json(await atualizarPipeline(id, await lerJson(request)));
});
