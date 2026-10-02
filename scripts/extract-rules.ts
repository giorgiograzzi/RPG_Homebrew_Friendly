// Regole di gioco dell'SRD 5.2.1 usate dal motore: condizioni, tabella degli slot del multiclasse e regole di creazione.
// Ogni valore si legge da entrambi i PDF e deve coincidere; non scrive nulla se un controllo fallisce.
import { readFileSync } from "node:fs";
import { CONDITIONS } from "./lib/conditions-srd";
import { LANGS, srdPages, writeKind, type Lang } from "./lib/srd";
import { joinProse } from "./lib/srd-clean";

const problems: string[] = [];
const bad = (m: string) => problems.push(m);
const flat = async (l: Lang, from = 1, to?: number) => joinProse((await srdPages(l)).slice(from - 1, to).join("\n")).replace(/\s+/g, " ");
const num = (s: string) => Number(s.replace(/[.,](?=\d{3}\b)/g, "").replace(/−/g, "-"));
const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canon(x)])) : v;
const same = (what: string, a: unknown, b: unknown) => { if (JSON.stringify(canon(a)) !== JSON.stringify(canon(b))) bad(`${what}: EN ${JSON.stringify(a)} ≠ IT ${JSON.stringify(b)}`); };

const [en, it] = [await flat("en"), await flat("it")];
const text: Record<Lang, string> = { en, it };
const dataClass = (l: Lang, id: string) => JSON.parse(readFileSync(`data/srd/${l}/classes.json`, "utf8")).entries.find((c: { id: string }) => c.id === id);

// --- condizioni --------------------------------------------------------------------------------------------------
const conditions = CONDITIONS.map((c) => {
  const body = {} as Record<Lang, string>;
  for (const l of LANGS) {
    const t = text[l], head = `${c.name[l]} [${l === "en" ? "Condition" : "condizione"}]`;
    const a = t.indexOf(head);
    if (a < 0) { bad(`${c.id}/${l}: titolo "${head}" non trovato`); body[l] = ""; continue; }
    const b = t.indexOf(c.end[l], a + head.length);
    if (b < 0) { bad(`${c.id}/${l}: fine "${c.end[l]}" non trovata`); body[l] = ""; continue; }
    // si toglie la frase introduttiva ("While you have the X condition, you experience the following effects.")
    const raw = t.slice(a + head.length, b).trim();
    const intro = raw.match(l === "en" ? /^.*?(?:following effects?\.)\s*/ : /^.*?seguent[ei] effett[oi]:\s*/);
    body[l] = (intro ? raw.slice(intro[0].length) : raw).trim();
    if (!intro) bad(`${c.id}/${l}: frase introduttiva non trovata`);
    for (const p of c.check[l]) if (!body[l].replace(/\s+/g, " ").includes(p)) bad(`${c.id}/${l}: manca "${p}"`);
    if (/(^|[.!?] )[a-z]/.test(body[l]) && l === "en") bad(`${c.id}/en: iniziale persa in "${body[l].match(/.{20}(?:^|[.!?] )[a-z].{10}/)?.[0]}"`);
  }
  return {
    id: c.id, name: c.name, description: { it: body.it, en: body.en }, notes: "",
    stackable: !!c.stackable, requiresSource: !!c.requiresSource, grantsConditions: c.grants ?? [],
    ...(c.levels ? { levels: c.levels } : {}), effects: c.effects, ...(c.removal ? { removal: c.removal } : {}),
    endConditions: c.endConditions ?? [], ...(c.escape ? { escape: c.escape } : {}),
  };
});

// --- tabella degli slot del multiclasse ---------------------------------------------------------------------------
function slotRows(l: Lang): number[][] {
  const t = text[l], key = l === "en" ? "Multiclass Spellcaster: Spell Slots per Spell Level Level 1 2 3 4 5 6 7 8 9" : "Incantatore multiclasse: slot incantesimo per livello di incantesimo Livello 1 2 3 4 5 6 7 8 9";
  const a = t.indexOf(key);
  if (a < 0) { bad(`slot multiclasse/${l}: tabella non trovata`); return []; }
  const tok = t.slice(a + key.length).trim().split(" ");
  const rows: number[][] = [];
  for (let lv = 1, i = 0; lv <= 20; lv++) {
    if (Number(tok[i]) !== lv) { bad(`slot multiclasse/${l}: attesa la riga ${lv}, trovato "${tok[i]}"`); break; }
    const cells = tok.slice(i + 1, i + 10).map((c) => (c === "—" ? 0 : Number(c)));
    if (cells.some((c) => Number.isNaN(c))) { bad(`slot multiclasse/${l}: riga ${lv} non valida`); break; }
    rows.push(cells.filter((c) => c > 0)); i += 10;
  }
  return rows;
}
const [slotsEn, slotsIt] = [slotRows("en"), slotRows("it")];
same("slot multiclasse", slotsEn, slotsIt);
const full = slotsEn;
for (const id of ["bard", "cleric", "druid", "sorcerer", "wizard"]) same(`slot ${id} / tabella multiclasse`, dataClass("en", id)?.spellSlots, full);
const half = dataClass("en", "paladin")?.spellSlots;
same("slot Paladino / Ranger", half, dataClass("en", "ranger")?.spellSlots);
const slotTables = [
  { id: "full_caster", name: { en: "Full caster", it: "Incantatore completo" }, slots: full },
  { id: "half_caster", name: { en: "Half caster", it: "Mezzo incantatore" }, slots: half },
];

// --- creazione del personaggio -------------------------------------------------------------------------------------
const after = (l: Lang, key: string, len: number) => { const a = text[l].indexOf(key); if (a < 0) { bad(`${l}: "${key}" non trovato`); return ""; } return text[l].slice(a + key.length, a + key.length + len); };
const per: Record<Lang, { array: number[]; cost: Record<string, number>; byClass: Record<string, Record<string, number>>; xp: number[]; bands: unknown[]; align: string[] }> = {} as never;
const CLS: Record<string, string> = { Barbarian: "barbarian", Bard: "bard", Cleric: "cleric", Druid: "druid", Fighter: "fighter", Monk: "monk", Paladin: "paladin", Ranger: "ranger", Rogue: "rogue", Sorcerer: "sorcerer", Warlock: "warlock", Wizard: "wizard",
  Barbaro: "barbarian", Bardo: "bard", Chierico: "cleric", Druido: "druid", Guerriero: "fighter", Monaco: "monk", Ladro: "rogue", Mago: "wizard", Paladino: "paladin", Stregone: "sorcerer" };
const ABS = ["str", "dex", "con", "int", "wis", "cha"];
const MAGIC = (s: string) => {
  const o = { common: 0, uncommon: 0, rare: 0, veryRare: 0 };
  for (const m of s.matchAll(/(\d+) (molto raro|raro|rari|non comuni|non comune|comuni|comune|Very Rare|Uncommon|Common|Rare)/g)) {
    const k = /^(molto raro|Very Rare)$/.test(m[2]!) ? "veryRare" : /^(raro|rari|Rare)$/.test(m[2]!) ? "rare" : /^(non comune|non comuni|Uncommon)$/.test(m[2]!) ? "uncommon" : "common";
    o[k] += Number(m[1]);
  }
  return o;
};
for (const l of LANGS) {
  const t = text[l], isEn = l === "en";
  const arr = (isEn ? /Standard Array\. Use the following six scores for your abilities: ([\d, ]+)\./ : /Serie standard\. Utilizza i seguenti sei punteggi per le tue caratteristiche: ([\d, ]+)\./).exec(t);
  const costTab = after(l, isEn ? "Ability Score Point Costs Score Cost " : "Costi in punti del punteggio di caratteristica Punteggio Costo ", 120);
  const pairs = [...costTab.replace(isEn ? "Score Cost" : "Punteggio Costo", "").matchAll(/(\d+) (\d+)/g)].map((m) => [m[1]!, Number(m[2])] as const).slice(0, 8);
  const cost = Object.fromEntries(pairs);
  const by = after(l, isEn ? "Standard Array by Class Class Str. Dex. Con. Int. Wis. Cha. " : "Serie standard per classe Classe For Des Cos Int Sag Car ", 700);
  const byClass: Record<string, Record<string, number>> = {};
  for (const m of by.matchAll(/([A-Za-z]+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+)/g)) if (CLS[m[1]!]) byClass[CLS[m[1]!]!] = Object.fromEntries(ABS.map((a, i) => [a, Number(m[2 + i])]));
  // la tabella ha due pezzi (livelli 1-15 e 16-20): si leggono tutte le righe "livello PE bonus" delle pagine del capitolo
  const xpPages = (await srdPages(l)).slice(isEn ? 22 : 24, isEn ? 24 : 27).join("\n");
  const xp: number[] = [];
  const found = new Map<number, number>();
  for (const m of joinProse(xpPages).replace(/\s+/g, " ").matchAll(/(?<![\d.,])(\d{1,2}) ([\d.,]+) \+([2-6])(?![\d])/g)) found.set(Number(m[1]), num(m[2]!));
  for (let lv = 1; lv <= 20; lv++) { const v = found.get(lv); if (v === undefined) bad(`${l}: tabella PE, manca il livello ${lv}`); else xp.push(v); }
  const bandKey = isEn ? "Starting Equipment at Higher Levels Starting Level Equipment and Money Magic Items " : "Equipaggiamento di partenza a livelli superiori Livello di partenza Equipaggiamento e denaro Oggetti magici ";
  const bandTxt = after(l, bandKey, 800);
  const bands: unknown[] = [];
  const rowRe = isEn
    ? /(\d+)–(\d+) (Normal starting equipment|[\d,]+ (?:GP|gp) plus 1d10 × (\d+) GP plus normal starting equipment) ((?:\d+ (?:Very Rare|Rare|Uncommon|Common)(?:, )?)+)/g
    : /(\d+)–(\d+) (Equipaggiamento di partenza ordinario|[\d.]+ mo più 1d10 × (\d+) mo più equipaggiamento di partenza ordinario) ((?:\d+ (?:molto raro|rari|raro|non comuni|non comune|comuni|comune)(?:, )?)+)/g;
  for (const m of bandTxt.matchAll(rowRe)) {
    const gold = /^\d/.test(m[3]!) ? num(m[3]!.split(" ")[0]!) : 0;
    bands.push({ minLevel: Number(m[1]), maxLevel: Number(m[2]), gold, ...(m[4] ? { goldDice: { sides: 10, count: 1, multiplier: Number(m[4]) } } : {}), magicItems: MAGIC(m[5]!) });
  }
  const align = isEn
    ? [...t.matchAll(/(Lawful Good|Neutral Good|Chaotic Good|Lawful Neutral|Neutral|Chaotic Neutral|Lawful Evil|Neutral Evil|Chaotic Evil) \((LG|NG|CG|LN|N|CN|LE|NE|CE)\)\./g)].map((m) => m[1]!)
    : [...t.matchAll(/(Legale buono|Neutrale buono|Caotico buono|Legale neutrale|Neutrale|Caotico neutrale|Legale malvagio|Neutrale malvagio|Caotico malvagio) \((LB|NB|CB|LN|N|CN|LM|NM|CM)\)\./g)].map((m) => m[1]!);
  per[l] = { array: arr ? arr[1]!.split(",").map((x) => Number(x.trim())) : [], cost, byClass, xp, bands, align };
}
for (const k of ["array", "cost", "byClass", "xp", "bands"] as const) same(`creazione/${k}`, per.en[k], per.it[k]);
if (per.en.align.length !== 9 || per.it.align.length !== 9) bad(`allineamenti: EN ${per.en.align.length}, IT ${per.it.align.length}`);
if (per.en.array.length !== 6) bad("serie standard non letta");
if (Object.keys(per.en.byClass).length !== 12) bad(`serie standard per classe: ${Object.keys(per.en.byClass).length} classi`);
if (per.en.bands.length !== 4) bad(`fasce di partenza: ${per.en.bands.length}`);
if (Object.keys(per.en.cost).length !== 8 || Object.values(per.en.cost).reduce((a, b) => a + (b as number), 0) !== 0 + 0 + 1 + 2 + 3 + 4 + 5 + 7 + 9) bad("tabella dei costi non valida");
// la riga dell'alleato SRD: Neutral e Neutrale compaiono anche in altri testi, ma qui si cercano solo le forme "(N)"
const alignIds = ["lawful_good", "neutral_good", "chaotic_good", "lawful_neutral", "neutral", "chaotic_neutral", "lawful_evil", "neutral_evil", "chaotic_evil"];
const order = (a: string[], names: string[]) => names.map((n) => a.indexOf(n));
const alignEn = ["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil"];
const alignIt = ["Legale buono", "Neutrale buono", "Caotico buono", "Legale neutrale", "Neutrale", "Caotico neutrale", "Legale malvagio", "Neutrale malvagio", "Caotico malvagio"];
if (order(per.en.align, alignEn).some((i, n) => i !== n) || order(per.it.align, alignIt).some((i, n) => i !== n)) bad("allineamenti: ordine inatteso");
const creation = [{
  id: "creation", standardArray: per.en.array,
  pointBuy: { budget: 27, min: 8, max: 15, costs: per.en.cost },
  recommendedArrays: per.en.byClass, startingLevels: per.en.bands,
  alignments: alignIds.map((id, i) => ({ id, name: { en: alignEn[i]!, it: alignIt[i]!.replace(/^./, (c) => c.toUpperCase()) } })),
  xpThresholds: per.en.xp,
}];

if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
writeKind("conditions", conditions as never);
writeKind("slotTables", slotTables as never);
writeKind("creation", creation as never);
