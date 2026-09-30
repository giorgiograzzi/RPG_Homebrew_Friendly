import { readFileSync } from "node:fs";

// pdfjs 6 usa Promise.withResolvers (Node 22+): lo aggiungiamo per Node 20
if (!("withResolvers" in Promise)) {
  (Promise as unknown as { withResolvers: () => unknown }).withResolvers = function () {
    let resolve!: (v: unknown) => void, reject!: (e: unknown) => void;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

// Testo di un PDF, pagina per pagina (le righe restano come nel PDF)
export async function pdfPages(path: string): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    let t = "";
    for (const it of c.items) if ("str" in it) t += it.str + (it.hasEOL ? "\n" : " ");
    pages.push(t);
  }
  return pages;
}

// Righe di testo senza intestazioni di pagina, indici e righe tratteggiate dell'indice
export function bodyLines(pages: string[]): string[] {
  return pages.flatMap((p) => p.split("\n"))
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l && !/^\.\s{2,}\./.test(l) && !/^Dati di gioco — /.test(l))
    .filter((l) => !/^(Arma|Armatura|Strumento|Oggetto|Dotazione)\s{2,}(Cat\.|Categoria|Gruppo|Peso|Costo)/.test(l));
}

// Testo continuo tra due titoli di sezione (il titolo finale non è incluso)
export function section(lines: string[], from: string, to?: string, fromLast = true): string {
  const idx = (t: string, last: boolean) => {
    const m = lines.map((l, i) => (l.trim() === t ? i : -1)).filter((i) => i >= 0);
    if (!m.length) throw new Error(`Sezione non trovata: "${t}"`);
    return last ? m[m.length - 1]! : m[0]!;
  };
  const a = idx(from, fromLast);
  const b = to ? idx(to, false) : lines.length;
  return lines.slice(a + 1, b > a ? b : lines.length).join(" ").replace(/\s+/g, " ").replace(/Tormentar e\b/g, "Tormentare").trim();
}
