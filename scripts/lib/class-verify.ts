// Verifica delle classi (step 2d) contro i due PDF dell'SRD: tratti fondamentali, equipaggiamento, tabella dei livelli
// (bonus di competenza, privilegi per livello, colonne) e intestazioni "Livello N: Nome" dei privilegi e della sottoclasse.
// Restituisce la tabella letta dal PDF (uguale in IT e EN, altrimenti errore) e l'elenco degli errori.
import type { ClassDef, FeatureDef, Table } from "./class-types";
import { pageText, type Lang } from "./srd";
import { joinProse } from "./srd-clean";

export const ALL_CLASSES: { id: string; it: string; en: string }[] = [
  { id: "barbarian", it: "Barbaro", en: "Barbarian" }, { id: "bard", it: "Bardo", en: "Bard" }, { id: "cleric", it: "Chierico", en: "Cleric" },
  { id: "druid", it: "Druido", en: "Druid" }, { id: "fighter", it: "Guerriero", en: "Fighter" }, { id: "monk", it: "Monaco", en: "Monk" },
  { id: "paladin", it: "Paladino", en: "Paladin" }, { id: "ranger", it: "Ranger", en: "Ranger" }, { id: "rogue", it: "Ladro", en: "Rogue" },
  { id: "sorcerer", it: "Stregone", en: "Sorcerer" }, { id: "warlock", it: "Warlock", en: "Warlock" }, { id: "wizard", it: "Mago", en: "Wizard" },
];
const PAGES: Record<Lang, [number, number]> = { it: [32, 92], en: [28, 83] };

// Le maiuscole F G H I J K sono perse nel PDF inglese (vedi TODO): si tolgono da entrambi i lati prima del confronto
export const nz = (l: Lang, s: string) => (l === "en" ? s.replace(/[FGHIJK]/g, "") : s).toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();

const cache = new Map<Lang, string>();
async function allText(l: Lang): Promise<string> {
  if (!cache.has(l)) cache.set(l, nz(l, joinProse(await pageText(l, PAGES[l][0], PAGES[l][1]))));
  return cache.get(l)!;
}

/** Sezione di una classe: dal suo blocco "Tratti" fino all'inizio della classe successiva (nell'ordine del PDF). */
export async function classSection(l: Lang, id: string): Promise<string> {
  const text = await allText(l);
  const start = (c: (typeof ALL_CLASSES)[number]) => text.indexOf(nz(l, l === "it" ? `${c.it} Tratti d` : `${c.en} Core ${c.en} Traits`));
  const starts = ALL_CLASSES.map((c) => ({ id: c.id, at: start(c) })).filter((s) => s.at >= 0).sort((a, b) => a.at - b.at);
  const k = starts.findIndex((s) => s.id === id);
  if (k < 0) throw new Error(`${l}: sezione della classe ${id} non trovata`);
  return text.slice(starts[k]!.at, starts[k + 1]?.at ?? text.length);
}

const VALUE = /^(?:[+−-]?\d+(?:[.,]\d+)?(?: (?:m|ft\.?))?|—|\d*d\d+|\d+)(?= |$)/;
function value(l: Lang, tok: string): number | string {
  if (tok === "—") return 0;
  const m = /^([+−-]?\d+(?:[.,]\d+)?) (m|ft\.?)$/.exec(tok);
  if (m) { const n = Number(m[1]!.replace(",", ".").replace("−", "-")); return l === "it" ? Math.round((n * 10) / 3) : n; } // metri → piedi
  if (/^\d*d\d+$/.test(tok)) return tok;
  return Number(tok.replace(",", ".").replace(/^\+/, ""));
}
const pbAt = (n: number) => 2 + Math.floor((n - 1) / 4);

/** Etichette (come nella tabella) dei privilegi di un livello, più i segnaposto della sottoclasse e le voci extra. */
function rowLabels(def: ClassDef, l: Lang, n: number): string[] {
  const out = def.features.filter((x) => x.level === n).map((x) => (x.row ?? x.name)[l]);
  out.push(...(def.extraRows ?? []).filter((x) => x.level === n).map((x) => x.label[l]));
  if (n > 3 && def.subclass.features.some((x) => x.level === n)) out.push(l === "it" ? "Privilegio della sottoclasse" : "Subclass feature");
  return out.map((s) => nz(l, s));
}

function parseTable(def: ClassDef, l: Lang, sec: string, errors: string[]): Table {
  const k = def.columns.length;
  const cols: (number | string)[][] = def.columns.map(() => []);
  // la tabella inizia alla riga del 1° livello (l'intestazione cambia da classe a classe: negli incantatori è mescolata)
  const coreEnd = sec.indexOf(l === "it" ? "diventare un" : "becoming a");
  let pos = sec.indexOf(" 1 +2 ", Math.max(0, coreEnd));
  if (pos < 0) { errors.push(`${l}/${def.id}: prima riga della tabella non trovata`); return {}; }
  pos += 1;
  for (let n = 1; n <= 20; n++) {
    const lead = `${n} +${pbAt(n)} `;
    if (!sec.startsWith(lead, pos)) { errors.push(`${l}/${def.id}: riga ${n}: atteso "${lead}", trovato "${sec.slice(pos, pos + 30)}"`); return {}; }
    pos += lead.length;
    const left = rowLabels(def, l, n).sort((a, b) => b.length - a.length);
    const total = left.length;
    for (let i = 0; i < total; i++) {
      const hit = left.find((x) => sec.startsWith(x, pos));
      if (!hit) { errors.push(`${l}/${def.id}: riga ${n}: privilegi attesi [${left.join(" | ")}], trovato "${sec.slice(pos, pos + 50)}"`); return {}; }
      left.splice(left.indexOf(hit), 1); pos += hit.length;
      pos += /^(, | e | and )/.exec(sec.slice(pos))?.[0].length ?? 0;
    }
    if (total === 0 && sec[pos] === "—") pos += 2; // cella dei privilegi vuota
    else if (sec[pos] === " ") pos++;
    for (let c = 0; c < k; c++) {
      const m = VALUE.exec(sec.slice(pos));
      if (!m) { errors.push(`${l}/${def.id}: riga ${n}: valore ${c + 1}/${k} non leggibile in "${sec.slice(pos, pos + 30)}"`); return {}; }
      cols[c]!.push(value(l, m[0]!)); pos += m[0]!.length + 1;
    }
  }
  return Object.fromEntries(def.columns.map((c, i) => [c.id, cols[i]!]));
}

export interface ClassCheck { table: Table; errors: string[] }

export async function verifyClass(def: ClassDef): Promise<ClassCheck> {
  const errors: string[] = [];
  const tables: Table[] = [];
  for (const l of ["it", "en"] as Lang[]) {
    const sec = await classSection(l, def.id);
    const w = `${l}/${def.id}`;
    const has = (what: string, s: string) => { if (!sec.includes(nz(l, s))) errors.push(`${w}: ${what} "${s}" non trovato nel PDF`); };
    // tratti fondamentali
    const c = def.core;
    const coreEnd = sec.indexOf(l === "it" ? "diventare un" : "becoming a");
    const core = coreEnd > 0 ? sec.slice(0, coreEnd) : sec.slice(0, 1500);
    const inCore = (what: string, s: string | undefined) => { if (s && !core.includes(nz(l, s))) errors.push(`${w}: tratto ${what} "${s}" non trovato nei tratti fondamentali`); };
    inCore("caratteristica primaria", l === "it" ? c.primaryIt : c.primaryEn); inCore("tiri salvezza", l === "it" ? c.savesIt : c.savesEn);
    inCore("abilità", l === "it" ? c.skillsIt : c.skillsEn); inCore("armi", l === "it" ? c.weaponsIt : c.weaponsEn);
    inCore("armature", l === "it" ? c.armorIt : c.armorEn); inCore("strumenti", l === "it" ? c.toolsIt : c.toolsEn);
    inCore("dado vita", `d${def.hitDie} per`);
    // equipaggiamento
    for (const [opt, eq] of Object.entries(def.equipment)) {
      if (!eq) continue;
      if (!core.includes(nz(l, l === "it" ? `${eq.gp} mo` : `${eq.gp} GP`))) errors.push(`${w}: equipaggiamento ${opt}: ${eq.gp} monete non trovate`);
      for (const it of eq.items) if (!core.includes(nz(l, l === "it" ? it.it : it.en))) errors.push(`${w}: equipaggiamento ${opt}: "${l === "it" ? it.it : it.en}" non trovato`);
    }
    for (const p of def.multiclassPhrases[l]) has("multiclasse", p);
    for (const p of def.checkPhrases?.[l] ?? []) has("opzione", p);
    // intestazioni dei privilegi e della sottoclasse
    const head = (lvl: number, name: string) => `${l === "it" ? "livello" : "level"} ${lvl}: ${name}`;
    const feats: FeatureDef[] = [...def.features.filter((x) => !x.tableOnly), ...def.subclass.features];
    for (const x of feats) has("privilegio", head(x.level, x.name[l]));
    // elenchi di incantesimi: nel PDF compaiono con spazi e virgole irregolari ("Cure Wound s, "), si confrontano senza spazi né virgole
    const compact = (x: string) => nz(l, x).replace(/[\s,]/g, "");
    for (const p of def.subclass.checkPhrases?.[l] ?? []) if (!compact(sec).includes(compact(p))) errors.push(`${w}: elenco "${p}" non trovato nel PDF`);
    has("sottoclasse", def.subclass.heading[l]);
    tables.push(parseTable(def, l, sec, errors));
  }
  const [a, b] = tables as [Table, Table];
  for (const col of def.columns) if (JSON.stringify(a[col.id]) !== JSON.stringify(b[col.id])) errors.push(`${def.id}: colonna ${col.id} diversa tra IT e EN\n  IT ${JSON.stringify(a[col.id])}\n  EN ${JSON.stringify(b[col.id])}`);
  return { table: a, errors };
}
