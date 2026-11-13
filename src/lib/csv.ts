/** Parser de CSV tolerante a aspas, vírgula ou ponto-e-vírgula como separador. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const separator = detectSeparator(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];

    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function detectSeparator(text: string) {
  const firstLine = text.split("\n", 1)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  if (tabs > semicolons && tabs > commas) return "\t";
  return semicolons > commas ? ";" : ",";
}

export function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Converte "1.234,56", "1234.56" ou "R$ 1.234,56" em número. */
export function parseValor(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}
