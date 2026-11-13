import { NextResponse } from "next/server";
import { STATUS_NEGOCIO, type StatusNegocio } from "@/lib/negocios";
import { criarNegocio, lerNegocio, listarNegocios } from "@/server/negocios";
import { lerJson, rota } from "@/server/rota";

export const GET = rota(async (request) => {
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const negocios = await listarNegocios({
    pipelineId: params.get("pipelineId") || undefined,
    empresaId: params.get("empresaId") || undefined,
    status: (STATUS_NEGOCIO as readonly string[]).includes(status ?? "") ? (status as StatusNegocio) : undefined,
    busca: params.get("busca")?.trim() || undefined,
    arquivados: params.get("arquivados") === "1",
    fechadosDias: params.has("fechadosDias") ? Math.max(0, Number(params.get("fechadosDias")) || 0) : undefined,
  });
  return NextResponse.json(negocios);
});

export const POST = rota(async (request) => {
  const negocio = await criarNegocio(lerNegocio(await lerJson(request), { criacao: true }));
  return NextResponse.json(negocio, { status: 201 });
});
