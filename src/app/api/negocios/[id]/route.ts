import { NextResponse } from "next/server";
import { atualizarNegocio, lerNegocio, obterNegocio } from "@/server/negocios";
import { lerJson, rota, type ComId } from "@/server/rota";

export const GET = rota<ComId>(async (_request, { params }) => {
  const { id } = await params;
  return NextResponse.json(await obterNegocio(id));
});

/**
 * Edita e/ou move. Mover: `{ etapaId, depoisDe?: id | null }` (+ `motivoPerdaId` se for para Perdido).
 * Reordenar na mesma etapa: só `{ depoisDe }`. Arquivar: `{ arquivado: true }`.
 */
export const PATCH = rota<ComId>(async (request, { params }) => {
  const { id } = await params;
  return NextResponse.json(await atualizarNegocio(id, lerNegocio(await lerJson(request), { criacao: false })));
});
