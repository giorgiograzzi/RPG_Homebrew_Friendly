// Oggetti magici SRD 5.2.1: legge «Oggetti magici A–Z» (IT) / «Magic Items A–Z» (EN) dai PDF.
// Le pagine hanno due colonne (a volte con una tabella larga che le attraversa); ogni oggetto ha il nome in grassetto grande,
// poi una riga in corsivo con tipo e rarità, poi il testo. Righe e paragrafi si ricostruiscono dalle posizioni, non dall'ordine
// del flusso del PDF, che con le tabelle è sbagliato.
import { readFileSync } from "node:fs";
import { fixEnGlyphs } from "./srd-clean";
import { SRD_PDF, type Lang } from "./srd";
import "./pdf-text"; // polyfill di Promise.withResolvers per Node 20

const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

export interface RawMagic {
  name: string;
  typeLine: string; // "Wondrous Item, Rare (Requires Attunement)"
  body: string; // paragrafi separati da riga vuota; le tabelle hanno una riga per riga e le celle separate da " | "
  page: number;
}

interface It { str: string; x: number; w: number; size: number; font: string }
interface Line { y: number; items: It[]; size: number; text: string; x: number; margin: number; band?: true } // margin = margine sinistro della colonna; band = riga di una tabella larga

// Pagine di «A–Z» (1 = prima pagina del PDF): dalla prima fino all'ultima prima dei Mostri
export const RANGE: Record<Lang, [number, number]> = { en: [209, 253], it: [237, 288] };
const HEAD_SIZE: Record<Lang, number> = { en: 11, it: 11.5 }; // il nome dell'oggetto è più grande del testo (11,3 / 12 contro 9,4 / 10)
const BODY: Record<Lang, number> = { en: 9.4, it: 10 };
const CATS: Record<Lang, RegExp> = {
  en: /^(Armor|Weapon|Wondrous Item|Potion|Ring|Rod|Scroll|Staff|Wand)\b/,
  it: /^(Armatura|Arma|Oggetto meraviglioso|Pozione|Anello|Verga|Pergamena|Bastone|Bacchetta)\b/,
};

type Doc = Awaited<ReturnType<typeof getDocument>["promise"]>;
type Placed = { y: number; it: It };

function joinItems(items: It[]): string {
  let s = "";
  items.forEach((i, n) => {
    const prev = items[n - 1];
    if (prev && i.x - (prev.x + prev.w) > 0.8 && !s.endsWith(" ") && !i.str.startsWith(" ") && !/^[.,;:)]/.test(i.str)) s += " ";
    s += i.str;
  });
  return s.replace(/\s+/g, " ").trim();
}

// Elementi con la stessa ordinata (±2) → righe, da sinistra a destra
function toLines(items: Placed[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.it.x - b.it.x);
  const lines: Line[] = [];
  for (const { y, it } of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - y) <= 2) last.items.push(it);
    else lines.push({ y, items: [it], size: it.size, text: "", x: it.x, margin: 0 });
  }
  for (const ln of lines) {
    ln.items.sort((a, b) => a.x - b.x);
    ln.x = ln.items[0]!.x;
    ln.size = Math.max(...ln.items.map((i) => i.size));
    ln.text = joinItems(ln.items);
  }
  return lines;
}
// Il margine sinistro di un gruppo di righe (una colonna) è la x minima del testo (non delle tabelle, che possono essere rientrate)
function withMargin(lines: Line[], small: number): Line[] {
  if (!lines.length) return lines;
  const body = lines.filter((x) => x.size >= small);
  const m = Math.min(...(body.length ? body : lines).map((x) => x.x));
  for (const ln of lines) ln.margin = m;
  return lines;
}
// due colonne: prima tutta la sinistra, poi la destra (ognuna dall'alto in basso)
const twoColumns = (items: Placed[], mid: number, small: number): Line[] =>
  [0, 1].flatMap((side) => withMargin(toLines(items.filter((r) => (r.it.x < mid ? 0 : 1) === side)), small));

// Righe di una pagina nell'ordine di lettura. Una tabella che attraversa la pagina (celle di testo piccolo sia a sinistra sia a
// destra sulla stessa riga) si legge riga per riga, e le colonne di testo prima e dopo si leggono ciascuna per conto proprio.
async function pageLines(doc: Doc, p: number, l: Lang): Promise<Line[]> {
  const page = await doc.getPage(p);
  const c = await page.getTextContent();
  const mid = page.getViewport({ scale: 1 }).width / 2;
  const raw = (c.items as { str: string; width: number; fontName: string; transform: number[] }[]).filter((i) => i.str.trim() !== "");
  // intestazione di pagina («System Reference Document 5.2.1») e numero di pagina a margine
  const isHeader = (i: { str: string; transform: number[] }) => /^System Reference Document/.test(i.str) || (/^\d{3}$/.test(i.str.trim()) && i.transform[4]! < 40);
  const items: Placed[] = raw.filter((i) => !isHeader(i)).map((i) => ({
    y: i.transform[5]!,
    it: { str: l === "en" ? fixEnGlyphs(i.str) : i.str, x: i.transform[4]!, w: i.width, size: Math.round(i.transform[0]! * 10) / 10, font: i.fontName },
  }));

  const small = BODY[l] - 0.3;
  const all = toLines(items);
  const isSmall = (ln: Line) => ln.size < small && ln.size >= BODY[l] - 1.2;
  // larga = una cella di testo piccolo attraversa la metà della pagina (due tabelle strette, una per colonna, non la attraversano)
  const isWide = (ln: Line) => isSmall(ln) && ln.items.some((i) => i.x < mid - 5 && i.x + i.w > mid + 5);
  // fasce di tabella larga: righe consecutive di testo piccolo (in tutta la larghezza) che ne contengono almeno una larga
  const bands: { top: number; bottom: number }[] = [];
  for (let n = 0; n < all.length;) {
    if (!isSmall(all[n]!)) { n++; continue; }
    let k = n;
    while (k + 1 < all.length && isSmall(all[k + 1]!)) k++;
    if (all.slice(n, k + 1).some(isWide)) bands.push({ top: all[n]!.y + 1, bottom: all[k]!.y - 1 });
    n = k + 1;
  }
  if (!bands.length) return twoColumns(items, mid, small);

  const out: Line[] = [];
  let upper = Infinity;
  for (const b of bands) {
    out.push(...twoColumns(items.filter((r) => r.y < upper && r.y > b.top), mid, small));
    out.push(...withMargin(toLines(items.filter((r) => r.y <= b.top && r.y >= b.bottom)), 0).map((ln) => Object.assign(ln, { band: true as const })));
    upper = b.bottom;
  }
  out.push(...twoColumns(items.filter((r) => r.y < upper), mid, small));
  return out;
}

// Una tabella larga sta in fondo alla pagina e non sempre segue l'oggetto a cui appartiene: qui si indica a chi va attribuita
// (nel PDF italiano segue il testo, nell'inglese è in fondo alla pagina dopo la seconda colonna)
const BAND_OWNER: Record<Lang, Record<number, string>> = { en: { 210: "Apparatus of the Crab" }, it: {} };

export async function readMagic(l: Lang): Promise<RawMagic[]> {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(SRD_PDF(l))), useSystemFonts: true }).promise;
  type Raw = { name: string[]; type: string[]; lines: Line[]; page: number };
  const raws: Raw[] = [];
  let cur: Raw | undefined;
  const isHead = (ln?: Line) => !!ln && ln.size >= HEAD_SIZE[l];

  for (let p = RANGE[l][0]; p <= RANGE[l][1]; p++) {
    const lines = await pageLines(doc, p, l);
    for (let n = 0; n < lines.length; n++) {
      // nuova voce: una o più righe-intestazione (nome) seguite da una riga che inizia con una categoria
      if (isHead(lines[n]) && !isHead(lines[n - 1])) {
        let k = n;
        while (isHead(lines[k])) k++;
        if (lines[k] && CATS[l].test(lines[k]!.text) && k - n <= 3) {
          const name = lines.slice(n, k).map((x) => x.text);
          const type = [lines[k]!.text];
          // il tipo è tutto in corsivo e può andare a capo: continua finché le righe hanno lo stesso carattere
          const tf = lines[k]!.items.map((i) => i.font);
          while (lines[k + 1] && lines[k + 1]!.size === lines[k]!.size && lines[k + 1]!.items.every((i) => tf.includes(i.font))) type.push(lines[++k]!.text);
          cur = { name, type, lines: [], page: p };
          raws.push(cur);
          n = k;
          continue;
        }
      }
      const owner = lines[n]!.band ? BAND_OWNER[l][p] : undefined;
      const target = owner ? raws.find((r) => r.name.join(" ") === owner) : cur;
      if (owner && !target) throw new Error(`tabella di pagina ${p}: oggetto "${owner}" non trovato`);
      target?.lines.push(lines[n]!);
    }
  }
  return raws.map((r) => build(r, l));
}

function build(c: { name: string[]; type: string[]; lines: Line[]; page: number }, l: Lang): RawMagic {
  const name = c.name.join(" ").replace(/\s+/g, " ").trim();
  const typeLine = c.type.join(" ").replace(/\s+/g, " ").trim();
  return { name, typeLine, body: blocks(c.lines, l), page: c.page };
}

// Unisce le righe di un paragrafo o di una cella: toglie i trattini di sillabazione a fine riga
function joinProse(ls: string[]): string {
  return ls.join("\n")
    .replace(/(\d) ?-[ \t]*\n(\p{L})/gu, "$1-$2") // "40-⏎foot": il trattino è vero
    .replace(/(\p{L}) ?-[ \t]*\n(\p{Ll})/gu, "$1$2")
    .replace(/\s*\n\s*/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

// Celle di una riga di tabella: elementi separati da più di 5 punti sono celle diverse. La x è relativa al margine della colonna,
// così una tabella che continua nella colonna dopo ha le stesse colonne.
function cellsOf(ln: Line): { x: number; text: string }[] {
  const cells: { x: number; text: string }[] = [];
  let prev: It | undefined;
  for (const i of ln.items) {
    const gap = prev ? i.x - (prev.x + prev.w) : 0;
    if (!prev || gap > 5) cells.push({ x: i.x - ln.margin, text: i.str });
    else cells[cells.length - 1]!.text += (gap > 0.8 ? " " : "") + i.str;
    prev = i;
  }
  return cells;
}

// Righe di tabella → "cella | cella". Le colonne sono i gruppi di x ai quali iniziano le celle (l'intestazione può essere
// allineata in modo diverso dai dati); una riga che non parte dalla prima colonna continua la riga precedente.
function table(lines: Line[]): string {
  const rowsCells = lines.map(cellsOf);
  const xs = rowsCells.flat().map((c) => c.x).sort((a, b) => a - b);
  const groups: { x: number; n: number }[] = [];
  for (const x of xs) {
    const g = groups[groups.length - 1];
    if (g && x - g.x <= 8) g.n++; else groups.push({ x, n: 1 });
  }
  const maxN = Math.max(...groups.map((g) => g.n));
  const real = groups.filter((g) => g.n >= 2 && g.n >= maxN * 0.3);
  const colX = (real.length ? real : groups).map((g) => g.x);
  const colOf = (x: number) => colX.reduce((best, cx, n) => (Math.abs(x - cx) < Math.abs(x - colX[best]!) ? n : best), 0);
  const rows: string[][][] = []; // riga → colonna → righe di testo
  for (const cs of rowsCells) {
    // una riga nuova parte dalla prima colonna e ha più celle; una sola cella nella prima colonna è il testo andato a capo
    if (!rows.length || (colOf(cs[0]!.x) === 0 && (cs.length > 1 || !rows[rows.length - 1]![0]!.length))) rows.push(colX.map(() => []));
    const row = rows[rows.length - 1]!;
    for (const c of cs) row[colOf(c.x)]!.push(c.text);
  }
  const text = rows.map((r) => r.map((c) => joinProse(c)));
  // la riga di intestazione si ripete dopo un salto di pagina
  return text.filter((r, n) => n === 0 || r.join("|") !== text[0]!.join("|")).map((r) => r.join(" | ")).join("\n");
}

// Righe → paragrafi e tabelle (testo più piccolo).
// Paragrafi: di solito la prima riga è rientrata e le altre no; i capoversi con un titolo in linea («Cast Spell. …») sono il
// contrario: la prima riga è a filo del margine e le altre rientrate. Un'elenco puntato ha una voce per riga.
function blocks(lines: Line[], l: Lang): string {
  const out: string[] = [];
  let para: string[] = [];
  let first: Line | undefined; // prima riga del paragrafo in corso
  let hanging = false; // il paragrafo ha il rientro sulle righe dopo la prima
  let tbl: Line[] = [];
  const flush = () => { if (para.length) out.push(joinProse(para)); para = []; first = undefined; hanging = false; };
  const flushTable = () => { if (tbl.length) out.push(table(tbl)); tbl = []; };
  const indented = (ln: Line) => ln.x >= ln.margin + 5;
  // la prima riga inizia con un titolo in linea: il primo elemento è in un altro carattere e finisce con un punto
  const runIn = (ln: Line) => ln.items.length > 1 && ln.items[0]!.font !== ln.items[1]!.font && /[.:]$/.test(ln.items[0]!.str.trim());
  for (const ln of lines) {
    // testo di una tabella: un po' più piccolo del corpo. Più piccolo ancora (note a piè di tabella, 8 pt) è un normale paragrafo
    if (ln.size < BODY[l] - 0.3 && ln.size >= BODY[l] - 1.2) { flush(); tbl.push(ln); continue; }
    flushTable();
    if (para.length) {
      if (/^•/.test(ln.text) || runIn(ln)) flush();
      else if (hanging) { if (!indented(ln)) flush(); }
      else if (indented(ln)) {
        // un paragrafo di una riga sola, a filo del margine e con un titolo in linea, continua con la riga rientrata
        if (para.length === 1 && first && !indented(first) && runIn(first)) hanging = true; else flush();
      }
    }
    if (!para.length) first = ln;
    para.push(ln.text);
  }
  flush(); flushTable();
  return out.join("\n\n");
}
