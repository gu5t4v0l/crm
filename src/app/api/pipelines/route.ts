import { NextResponse } from "next/server";
import { criarPipeline, listarPipelines } from "@/server/pipelines";
import { lerJson, rota } from "@/server/rota";

export const GET = rota(async (request) => {
  const arquivados = request.nextUrl.searchParams.get("arquivados") === "1";
  return NextResponse.json(await listarPipelines({ arquivados }));
});

/** `{ nome, etapas?: string[] }` — Ganho e Perdido são criadas automaticamente no fim. */
export const POST = rota(async (request) => {
  return NextResponse.json(await criarPipeline(await lerJson(request)), { status: 201 });
});
