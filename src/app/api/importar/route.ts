import { NextResponse } from "next/server";
import { erroValidacao } from "@/server/erros";
import { importarCsv } from "@/server/importacao";
import { lerJson, rota } from "@/server/rota";

/** `{ csv: string }` — cria empresas, contatos e negócios; devolve contagens e avisos por linha. */
export const POST = rota(async (request) => {
  const body = await lerJson(request);
  if (typeof body.csv !== "string" || !body.csv.trim()) throw erroValidacao("Envie o conteúdo do CSV");
  return NextResponse.json(await importarCsv(body.csv), { status: 201 });
});
