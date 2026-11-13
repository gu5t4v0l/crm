import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeHeader, parseCsv, parseValor } from "@/lib/csv";
import { ESTAGIOS, type Estagio } from "@/lib/leads";

const COLUNAS: Record<string, string> = {
  nome: "nome",
  lead: "nome",
  contato: "nome",
  empresa: "empresa",
  companhia: "empresa",
  organizacao: "empresa",
  email: "email",
  emails: "email",
  telefone: "telefone",
  celular: "telefone",
  whatsapp: "telefone",
  fone: "telefone",
  origem: "origem",
  fonte: "origem",
  canal: "origem",
  valor: "valor",
  ticket: "valor",
  valorestimado: "valor",
  estagio: "estagio",
  status: "estagio",
  etapa: "estagio",
  responsavel: "responsavel",
  vendedor: "responsavel",
  observacao: "observacao",
  observacoes: "observacao",
  notas: "observacao",
};

function mapEstagio(raw: string): Estagio | null {
  const key = normalizeHeader(raw);
  if (!key) return null;
  const direto = ESTAGIOS.find((e) => normalizeHeader(e) === key);
  if (direto) return direto;
  const apelidos: Record<string, Estagio> = {
    novo: "NOVO",
    aberto: "NOVO",
    emcontato: "CONTATO",
    contatado: "CONTATO",
    negociacao: "PROPOSTA",
    proposta: "PROPOSTA",
    orcamento: "PROPOSTA",
    ganho: "GANHO",
    fechado: "GANHO",
    convertido: "GANHO",
    perdido: "PERDIDO",
    descartado: "PERDIDO",
  };
  return apelidos[key] ?? null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.csv !== "string" || !body.csv.trim()) {
    return NextResponse.json({ error: "Envie o conteúdo do CSV" }, { status: 400 });
  }

  const linhas = parseCsv(body.csv);
  if (linhas.length < 2) {
    return NextResponse.json(
      { error: "CSV precisa de um cabeçalho e ao menos uma linha" },
      { status: 400 },
    );
  }

  const cabecalho = linhas[0].map((c) => COLUNAS[normalizeHeader(c)] ?? null);
  if (!cabecalho.includes("nome")) {
    return NextResponse.json(
      { error: "CSV precisa de uma coluna 'nome'" },
      { status: 400 },
    );
  }

  const erros: string[] = [];
  let ignorados = 0;
  const registros: {
    nome: string;
    empresa: string | null;
    email: string | null;
    telefone: string | null;
    origem: string | null;
    responsavel: string | null;
    observacao: string | null;
    valor: number | null;
    estagio: Estagio;
  }[] = [];

  for (let i = 1; i < linhas.length; i += 1) {
    const campos: Record<string, string> = {};
    linhas[i].forEach((celula, idx) => {
      const chave = cabecalho[idx];
      if (chave) campos[chave] = celula.trim();
    });

    if (!campos.nome) {
      erros.push(`Linha ${i + 1}: nome vazio, ignorada`);
      ignorados += 1;
      continue;
    }

    let estagio: Estagio = "NOVO";
    if (campos.estagio) {
      const mapeado = mapEstagio(campos.estagio);
      if (mapeado) {
        estagio = mapeado;
      } else {
        erros.push(`Linha ${i + 1}: estágio "${campos.estagio}" desconhecido, usando Novo`);
      }
    }

    registros.push({
      nome: campos.nome,
      empresa: campos.empresa || null,
      email: campos.email || null,
      telefone: campos.telefone || null,
      origem: campos.origem || null,
      responsavel: campos.responsavel || null,
      observacao: campos.observacao || null,
      valor: campos.valor ? parseValor(campos.valor) : null,
      estagio,
    });
  }

  if (!registros.length) {
    return NextResponse.json({ error: "Nenhuma linha válida", erros }, { status: 400 });
  }

  // Posição inicial por estágio, continuando de onde o funil já está.
  const posicoes = new Map<Estagio, number>();
  for (const estagio of ESTAGIOS) {
    const ultimo = await prisma.lead.findFirst({
      where: { estagio },
      orderBy: { posicao: "desc" },
      select: { posicao: true },
    });
    posicoes.set(estagio, (ultimo?.posicao ?? -1) + 1);
  }

  const dados = registros.map((registro) => {
    const posicao = posicoes.get(registro.estagio) ?? 0;
    posicoes.set(registro.estagio, posicao + 1);
    return { ...registro, posicao };
  });

  const { count } = await prisma.lead.createMany({ data: dados });

  return NextResponse.json({ importados: count, ignorados, erros }, { status: 201 });
}

