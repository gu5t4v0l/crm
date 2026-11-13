import { NextResponse } from "next/server";
import { atualizarEmpresa, lerEmpresa, obterEmpresa } from "@/server/empresas";
import { lerJson, rota, type ComId } from "@/server/rota";

export const GET = rota<ComId>(async (_request, { params }) => {
  const { id } = await params;
  return NextResponse.json(await obterEmpresa(id));
});

/** Também arquiva/restaura: `{ "arquivada": true | false }`. */
export const PATCH = rota<ComId>(async (request, { params }) => {
  const { id } = await params;
  const body = await lerJson(request);
  const empresa = await atualizarEmpresa(id, lerEmpresa(body, { criacao: false }), { forcar: body.forcar === true });
  return NextResponse.json(empresa);
});
