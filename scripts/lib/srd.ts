import { mkdirSync, writeFileSync } from "node:fs";
import { pdfPages, pdfPagesColumns } from "./pdf-text";
import { DESCRIPTIONS, GROUP_DESCRIPTIONS } from "./descriptions";
import { fixEnGlyphs } from "./srd-clean";
import { fixSpellModes } from "./spells";

export type Lang = "it" | "en";
export const LANGS: Lang[] = ["it", "en"];
export const SRD_PDF = (l: Lang) => `docs/srd/SRD_5.2.1_${l}.pdf`;
export const OUT = (l: Lang) => `data/srd/${l}`;

// Pagine dell'SRD (indice 1 = pagina 1 del PDF), lette una volta sola per lingua.
// Il PDF inglese ha glifi con codici sbagliati: si correggono qui (vedi srd-clean.ts)
const cache = new Map<Lang, string[]>();
export async function srdPages(l: Lang): Promise<string[]> {
  if (!cache.has(l)) cache.set(l, (await pdfPages(SRD_PDF(l))).map((t) => (l === "en" ? fixEnGlyphs(t) : t).replace(/System Reference Document 5\.2\.1 \d+ ?/g, "")));
  return cache.get(l)!;
}
// Come srdPages, ma con le colonne lette in ordine (per le pagine a due colonne, come gli incantesimi)
const cacheCols = new Map<Lang, string[]>();
export async function srdPagesColumns(l: Lang): Promise<string[]> {
  if (!cacheCols.has(l)) cacheCols.set(l, (await pdfPagesColumns(SRD_PDF(l))).map((t) => (l === "en" ? fixEnGlyphs(t) : t).replace(/System Reference Document 5\.2\.1 \d+ ?/g, "")));
  return cacheCols.get(l)!;
}
export const pageText = async (l: Lang, from: number, to = from) => (await srdPages(l)).slice(from - 1, to).join("\n");

export const snake = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// "1,500 GP" → rame (1 GP = 100 CP)
const UNIT: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000, mr: 1, ma: 10, me: 50, mo: 100, mp: 1000 };
export function copper(amount: string, unit: string): number {
  const n = Number(/^\d{1,3}([.,]\d{3})+$/.test(amount) ? amount.replace(/[.,]/g, "") : amount.replace(",", "."));
  const u = UNIT[unit.toLowerCase()];
  if (Number.isNaN(n) || u === undefined) throw new Error(`Costo non valido: "${amount} ${unit}"`);
  return Math.round(n * u);
}

// Peso in libbre dal testo EN: "58½ lb.", "1/4 lb.", "1 ½ lb.", "5 lb. (full)", "—"
export function pounds(s: string): number {
  const t = s.replace(/lb\.?/g, "").replace(/\(full\)/g, "").replace(/,/g, "").trim();
  if (!t || t === "—") return 0;
  let total = 0;
  for (const tok of t.split(/\s+/)) {
    if (tok === "½") total += 0.5;
    else if (tok.endsWith("½")) total += Number(tok.slice(0, -1)) + 0.5;
    else if (tok.includes("/")) { const [a, b] = tok.split("/").map(Number); total += a! / b!; }
    else if (Number.isNaN(Number(tok))) throw new Error(`Peso non valido: "${s}"`);
    else total += Number(tok);
  }
  return total;
}
// Peso IT in kg ("1,5 kg", "—") → libbre (nell'SRD italiano 1 lb = 0,5 kg)
export function kgToPounds(s: string): number {
  const t = s.replace(/kg/, "").replace(/\(pieno\)/, "").trim();
  if (!t || t === "—") return 0;
  return Number(t.replace(",", ".")) * 2;
}

// Separa per virgola fuori dalle parentesi
export function splitTop(s: string): string[] {
  const r: string[] = []; let d = 0, cur = "";
  for (const c of s) {
    if (c === "(") d++; if (c === ")") d--;
    if (c === "," && d === 0) { r.push(cur.trim()); cur = ""; } else cur += c;
  }
  return [...r, cur.trim()].filter(Boolean);
}

// Un nome di riga come regex che tollera gli a capo dentro il nome e richiede una colonna (3+ spazi) o un a capo dopo
export const rowStart = (name: string) =>
  new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[ \\n]+")}(?: {3,}|[ \\n]*\\n)`, "m");

// Testi bilingui scritti nel codice ({ it, en }) diventano la stringa della lingua del file, a qualsiasi profondità
export function localize(v: unknown, l: Lang): unknown {
  if (Array.isArray(v)) return v.map((x) => localize(x, l));
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const k = Object.keys(o);
    if (k.length === 2 && k.includes("it") && k.includes("en") && typeof o.it === "string" && typeof o.en === "string") return o[l];
    return Object.fromEntries(Object.entries(o).map(([a, b]) => [a, localize(b, l)]));
  }
  return v;
}

export interface Entry { id: string; name: { en: string; it: string }; [k: string]: unknown }

// Scrive i file data/srd/<lingua>/<file>.json (file = kind, se non indicato) con lo stesso contenuto, il nome e la descrizione nella lingua del file
export function writeKind(kind: string, entries: Entry[] | Record<string, unknown>[], file = kind) {
  for (const l of LANGS) {
    mkdirSync(OUT(l), { recursive: true });
    // gli incantesimi concessi hanno il modo giusto per il loro livello (trucchetto a volontà, ecc.)
    if (kind !== "spells") for (const e of entries as Entry[]) fixSpellModes(e, `${kind}/${e.id}`);
    const out = (entries as Entry[]).map((e) => {
      const d = DESCRIPTIONS[kind]?.[e.id] ?? GROUP_DESCRIPTIONS[String(e.group)];
      // voci senza nome (le regole di creazione) e senza origine (nello schema non c'è) restano come sono
      const named = e.name ? { name: e.name[l].replace(/’/g, "'") } : {};
      return { ...(localize({ ...e, name: undefined }, l) as object), ...named, ...(d ? { description: d[l] } : {}), ...(kind === "creation" ? {} : { origin: "srd" }) };
    });
    writeFileSync(`${OUT(l)}/${file}.json`, JSON.stringify({ kind, entries: out }, null, 1) + "\n");
  }
  console.log(`${file}: ${entries.length}`);
}
