import { NextResponse } from "next/server";
import { metricasDoPipeline } from "@/server/metricas";
import { rota } from "@/server/rota";

export const GET = rota(async (request) => {
  const pipelineId = request.nextUrl.searchParams.get("pipelineId") || undefined;
  return NextResponse.json(await metricasDoPipeline(pipelineId));
});
