import { NextResponse } from "next/server";
import { atualizarMotivo } from "@/server/pipelines";
import { lerJson, rota, type ComId } from "@/server/rota";

/** `{ nome?, ativo? }` — motivos não são excluídos, só desativados. */
export const PATCH = rota<ComId>(async (request, { params }) => {
  const { id } = await params;
  return NextResponse.json(await atualizarMotivo(id, await lerJson(request)));
});
