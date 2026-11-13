import { NextResponse } from "next/server";
import { STATUS_EMPRESA, type StatusEmpresa } from "@/lib/empresas";
import { criarEmpresa, lerEmpresa, listarEmpresas } from "@/server/empresas";
import { lerJson, rota } from "@/server/rota";

export const GET = rota(async (request) => {
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const empresas = await listarEmpresas({
    busca: params.get("busca")?.trim() || undefined,
    status: (STATUS_EMPRESA as readonly string[]).includes(status ?? "") ? (status as StatusEmpresa) : undefined,
    arquivadas: params.get("arquivadas") === "1",
  });
  return NextResponse.json(empresas);
});

export const POST = rota(async (request) => {
  const body = await lerJson(request);
  const empresa = await criarEmpresa(lerEmpresa(body, { criacao: true }), { forcar: body.forcar === true });
  return NextResponse.json(empresa, { status: 201 });
});
