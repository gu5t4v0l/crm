import { normalizeHeader, parseCsv, parseValor } from "@/lib/csv";
import { nomeESegmento, origemDeTexto, separarPessoas } from "@/lib/empresas";
import {
  normalizarCnpj,
  normalizarEmail,
  normalizarInstagram,
  normalizarTelefone,
  normalizarUf,
} from "@/lib/normalizar";
import { criarContato, lerContato } from "@/server/contatos";
import { criarEmpresa, encontrarDuplicadas, lerEmpresa } from "@/server/empresas";
import { erroValidacao } from "@/server/erros";
import { criarNegocio, lerNegocio } from "@/server/negocios";
import { pipelinePadrao } from "@/server/pipelines";

/**
 * Importação de CSV (planilhas e a extensão do Chrome) para Empresa + Contato + Negócio.
 *
 * - Cada linha é uma empresa. Duplicata (mesmas regras do cadastro) é pulada e reportada.
 * - Campo inválido (telefone, CNPJ…) é descartado com aviso; a linha entra sem ele.
 * - `contato`/`responsavel` viram contatos ("Ana/Bia" = dois).
 * - Cria negócio no pipeline padrão se a linha tem valor ou etapa além da primeira.
 * - Etapa "perdido"/"descartado" marca a empresa como Descartada, sem negócio.
 */

const COLUNAS: Record<string, string> = {
  nome: "nome",
  lead: "nome",
  razaosocial: "nome",
  empresa: "empresa",
  companhia: "empresa",
  organizacao: "empresa",
  segmento: "segmento",
  categoria: "segmento",
  ramo: "segmento",
  contato: "contato",
  responsavel: "contato",
  pessoa: "contato",
  cargo: "cargo",
  email: "email",
  emails: "email",
  telefone: "telefone",
  celular: "telefone",
  whatsapp: "telefone",
  fone: "telefone",
  site: "site",
  website: "site",
  instagram: "instagram",
  cnpj: "cnpj",
  endereco: "endereco",
  cidade: "cidade",
  uf: "uf",
  estado: "uf",
  origem: "origem",
  fonte: "origem",
  canal: "origem",
  valor: "valor",
  ticket: "valor",
  valorestimado: "valor",
  estagio: "etapa",
  etapa: "etapa",
  status: "etapa",
  observacao: "observacao",
  observacoes: "observacao",
  notas: "observacao",
};

/** Nomes do funil antigo / da extensão → tipo de destino. */
const ETAPAS_LEGADAS: Record<string, "primeira" | "GANHO" | "DESCARTADA"> = {
  novo: "primeira",
  aberto: "primeira",
  ganho: "GANHO",
  fechado: "GANHO",
  convertido: "GANHO",
  perdido: "DESCARTADA",
  descartado: "DESCARTADA",
};
const APELIDOS_ETAPA: Record<string, string> = { contato: "emcontato", contatado: "emcontato", orcamento: "proposta" };

export type ResultadoImportacao = {
  empresas: number;
  contatos: number;
  negocios: number;
  ignoradas: number;
  avisos: string[];
};

export async function importarCsv(csv: string): Promise<ResultadoImportacao> {
  const linhas = parseCsv(csv);
  if (linhas.length < 2) throw erroValidacao("CSV precisa de um cabeçalho e ao menos uma linha");

  const cabecalho = linhas[0].map((c) => COLUNAS[normalizeHeader(c)] ?? null);
  if (!cabecalho.includes("nome") && !cabecalho.includes("empresa")) {
    throw erroValidacao("CSV precisa de uma coluna 'nome' ou 'empresa'");
  }

  const pipeline = await pipelinePadrao();
  const abertas = pipeline.etapas.filter((e) => e.tipo === "ABERTA");
  const porNome = new Map(pipeline.etapas.map((e) => [normalizeHeader(e.nome), e]));
  const resultado: ResultadoImportacao = { empresas: 0, contatos: 0, negocios: 0, ignoradas: 0, avisos: [] };

  for (let i = 1; i < linhas.length; i += 1) {
    const n = i + 1;
    const c: Record<string, string> = {};
    linhas[i].forEach((celula, idx) => {
      const chave = cabecalho[idx];
      if (chave && celula.trim()) c[chave] = celula.trim();
    });

    const nomeBase = c.nome ?? c.empresa;
    if (!nomeBase) {
      resultado.avisos.push(`Linha ${n}: sem nome, ignorada`);
      resultado.ignoradas += 1;
      continue;
    }

    // Campo inválido é descartado com aviso, para não perder a linha inteira.
    const valido = (campo: string, rotulo: string, normalizar: (v: string) => string | null) => {
      if (!c[campo]) return undefined;
      try {
        normalizar(c[campo]);
        return c[campo];
      } catch {
        resultado.avisos.push(`Linha ${n}: ${rotulo} "${c[campo]}" inválido, ignorado`);
        return undefined;
      }
    };

    // A extensão antiga mandava o @ do Instagram na coluna empresa.
    let empresaCol: string | undefined = c.empresa;
    if (empresaCol?.startsWith("@")) {
      c.instagram ??= empresaCol;
      empresaCol = undefined;
    }
    const { nome, segmento } = nomeESegmento(nomeBase, c.nome ? empresaCol : undefined);

    // Etapa: nome de etapa do pipeline, apelido do funil antigo, ou nada.
    const chaveEtapa = c.etapa ? normalizeHeader(c.etapa) : "";
    const legado = ETAPAS_LEGADAS[chaveEtapa];
    const etapa = chaveEtapa
      ? (porNome.get(chaveEtapa) ?? porNome.get(APELIDOS_ETAPA[chaveEtapa] ?? "") ?? (legado === "primeira" ? abertas[0] : undefined))
      : undefined;
    const descartada = legado === "DESCARTADA" || etapa?.tipo === "PERDIDO";
    if (chaveEtapa && !etapa && !legado) resultado.avisos.push(`Linha ${n}: etapa "${c.etapa}" desconhecida, ignorada`);

    const pessoas = separarPessoas(c.contato);
    const emailDoContato = pessoas.length === 1;

    const dadosEmpresa = lerEmpresa(
      {
        nome,
        segmento: c.segmento ?? segmento,
        status: descartada ? "DESCARTADA" : etapa?.tipo === "GANHO" || legado === "GANHO" ? "CLIENTE" : "PROSPECT",
        origem: origemDeTexto(c.origem),
        cnpj: valido("cnpj", "CNPJ", normalizarCnpj),
        telefone: valido("telefone", "telefone", normalizarTelefone),
        email: emailDoContato ? undefined : valido("email", "e-mail", normalizarEmail),
        site: c.site,
        instagram: valido("instagram", "Instagram", normalizarInstagram),
        endereco: c.endereco,
        cidade: c.cidade,
        uf: valido("uf", "UF", normalizarUf),
        observacao: c.observacao,
      },
      { criacao: true },
    );

    const duplicadas = await encontrarDuplicadas(dadosEmpresa);
    if (duplicadas.length) {
      const d = duplicadas[0];
      resultado.avisos.push(`Linha ${n}: "${nome}" já existe como "${d.nome}" (${d.motivo}), ignorada`);
      resultado.ignoradas += 1;
      continue;
    }

    try {
      const empresa = await criarEmpresa(dadosEmpresa, { forcar: true });
      resultado.empresas += 1;

      for (const pessoa of pessoas) {
        const contato = await criarContato(
          lerContato(
            {
              nome: pessoa,
              empresaId: empresa.id,
              cargo: c.cargo,
              email: emailDoContato ? valido("email", "e-mail", normalizarEmail) : undefined,
            },
            { criacao: true },
          ),
          { forcar: true },
        ).catch((e) => {
          resultado.avisos.push(`Linha ${n}: contato "${pessoa}" não criado (${e instanceof Error ? e.message : e})`);
          return null;
        });
        if (contato) resultado.contatos += 1;
      }

      const valor = c.valor ? parseValor(c.valor) : null;
      const temNegocio = !descartada && (valor !== null || (etapa && etapa.id !== abertas[0]?.id));
      if (temNegocio) {
        const destino = etapa ?? abertas[0];
        if (destino.tipo === "GANHO" || destino.tipo === "ABERTA") {
          await criarNegocio(lerNegocio({ empresaId: empresa.id, etapaId: destino.id, valor: valor ?? 0 }, { criacao: true }));
          resultado.negocios += 1;
        }
      }
    } catch (e) {
      resultado.avisos.push(`Linha ${n}: ${e instanceof Error ? e.message : "erro ao importar"}`);
      resultado.ignoradas += 1;
    }
  }

  return resultado;
}

