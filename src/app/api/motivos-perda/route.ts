import { NextResponse } from "next/server";
import { criarMotivo, listarMotivos } from "@/server/pipelines";
import { lerJson, rota } from "@/server/rota";

export const GET = rota(async (request) => {
  const inativos = request.nextUrl.searchParams.get("inativos") === "1";
  return NextResponse.json(await listarMotivos({ inativos }));
});

export const POST = rota(async (request) => {
  return NextResponse.json(await criarMotivo(await lerJson(request)), { status: 201 });
});
