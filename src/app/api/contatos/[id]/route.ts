import { NextResponse } from "next/server";
import { atualizarContato, lerContato, obterContato } from "@/server/contatos";
import { lerJson, rota, type ComId } from "@/server/rota";

export const GET = rota<ComId>(async (_request, { params }) => {
  const { id } = await params;
  return NextResponse.json(await obterContato(id));
});

/** Também arquiva/restaura: `{ "arquivado": true | false }`. */
export const PATCH = rota<ComId>(async (request, { params }) => {
  const { id } = await params;
  const body = await lerJson(request);
  const contato = await atualizarContato(id, lerContato(body, { criacao: false }), { forcar: body.forcar === true });
  return NextResponse.json(contato);
});
