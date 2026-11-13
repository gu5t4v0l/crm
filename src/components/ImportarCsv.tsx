"use client";

import { useState } from "react";
import { api } from "@/lib/basePath";

type Resultado = { empresas: number; contatos: number; negocios: number; ignoradas: number; avisos: string[] };

const EXEMPLO = `nome;segmento;contato;email;telefone;instagram;cidade;origem;valor;etapa;observacao
Padaria Pão Quente;Padaria;Ana Souza;ana@paoquente.com;(11) 99999-0000;@paoquente;São Paulo;Instagram;2500,00;Proposta;Pediu orçamento
Oficina Beta;Mecânica;João Lima;;(21) 98888-1111;;Rio de Janeiro;Maps;;Novo;`;

export default function ImportarCsv() {
  const [csv, setCsv] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function lerArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    setCsv(await arquivo.text());
    setResultado(null);
    setErro(null);
  }

  async function importar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    setResultado(null);

    const resposta = await fetch(api("/api/importar"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });

    const corpo = await resposta.json().catch(() => null);
    setEnviando(false);

    if (!resposta.ok) {
      setErro(corpo?.error ?? "Falha na importação");
      return;
    }

    setResultado(corpo);
    setCsv("");
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold">Importar empresas por CSV</h1>
      <p className="mt-1 text-sm opacity-70">
        Aceita separador <code>;</code>, <code>,</code> ou tab. Cada linha vira uma empresa; a coluna{" "}
        <code>nome</code> é obrigatória. Duplicatas (mesmo telefone, Instagram, site, CNPJ ou nome) são
        puladas.
      </p>

      <form onSubmit={importar} className="card mt-5 space-y-4 p-5">
        <div>
          <label className="label">Arquivo .csv</label>
          <input type="file" accept=".csv,text/csv" onChange={lerArquivo} className="text-sm" />
        </div>

        <div>
          <label className="label">Ou cole o conteúdo</label>
          <textarea
            className="input font-mono text-xs"
            rows={10}
            placeholder={EXEMPLO}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" className="btn-primary" disabled={enviando || !csv.trim()}>
            {enviando ? "Importando…" : "Importar"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setCsv(EXEMPLO)}>
            Usar exemplo
          </button>
        </div>
      </form>

      {erro ? <p className="mt-4 text-sm text-red-500">{erro}</p> : null}

      {resultado ? (
        <div className="card mt-4 p-4 text-sm">
          <p className="font-semibold text-brand-teal">
            {resultado.empresas} empresa(s), {resultado.contatos} contato(s) e {resultado.negocios} negócio(s)
            criados{resultado.ignoradas ? ` · ${resultado.ignoradas} linha(s) ignorada(s)` : ""}.
          </p>
          {resultado.avisos.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 opacity-70">
              {resultado.avisos.map((mensagem) => (
                <li key={mensagem}>{mensagem}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <section className="mt-6 text-sm opacity-70">
        <h2 className="font-semibold">Colunas reconhecidas</h2>
        <p className="mt-1">
          nome, segmento (ou categoria), contato (ou responsável — “Ana/Bia” vira dois), cargo, email,
          telefone, site, instagram, cnpj, endereco, cidade, uf, origem, valor, etapa, observacao. Com{" "}
          <code>valor</code> ou uma <code>etapa</code> além da primeira, cria um negócio no pipeline padrão;
          etapa Perdido/Descartado marca a empresa como Descartada. O CSV da extensão do Chrome já vem
          nesse formato.
        </p>
      </section>
    </main>
  );
}
