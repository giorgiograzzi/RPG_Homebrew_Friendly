// Step 8: incantesimi dal PDF "04_Incantesimi" → data/private/{spells,slotTables}.json
// Controlli: 390 incantesimi; le liste per classe del PDF (nomi, ◆ Concentrazione, ® Rituale) devono coincidere con i dati estratti.
import { writeFileSync } from "node:fs";
import { bodyLines, pdfPages } from "./lib/pdf-text";
import { compact, splitNames } from "./lib/util";

const SRC = process.env.RULES_DIR ?? "docs/rules";
const OUT = "data/private";
type Json = Record<string, any>;

const SCHOOL: Record<string, string> = {
  Abiurazione: "abjuration", Evocazione: "conjuration", Divinazione: "divination", Ammaliamento: "enchantment",
  Invocazione: "evocation", Illusione: "illusion", Necromanzia: "necromancy", Trasmutazione: "transmutation",
};
const CLASS: Record<string, string> = {
  Bardo: "bard", Chierico: "cleric", Druido: "druid", Paladino: "paladin", Ranger: "ranger", Stregone: "sorcerer", Warlock: "warlock", Mago: "wizard",
};
const SAVE: Record<string, string> = { For: "save_str", Des: "save_dex", Cos: "save_con", Int: "save_int", Sag: "save_wis", Car: "save_cha" };
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

const lines = bodyLines(await pdfPages(`${SRC}/04_Incantesimi_DnD2024.pdf`))
  .filter((l) => !/^Incantesimi — D&D 5e 2024/.test(l) && !/^Incantesimo\s{3}Lancio\s{3}Effetto/.test(l));
const at = (t: string, from = 0) => { const i = lines.findIndex((l, k) => k >= from && l.trim() === t); if (i < 0) throw new Error(`Titolo non trovato: ${t}`); return i; };
const last = (t: string) => { const i = lines.map((l) => l.trim()).lastIndexOf(t); if (i < 0) throw new Error(`Titolo non trovato: ${t}`); return i; };

// ---------- catalogo ----------
const iCat = last("Trucchetti (livello 0)");
const rawCat = lines.slice(iCat).map((l) => {
  const m = /^(?:Livello (\d)|Trucchetti \(livello 0\))$/.exec(l.trim());
  return m ? `⟦L:${m[1] ?? 0}⟧` : l;
}).join(" ").replace(/\s+/g, " ");
const idMarks = [...rawCat.matchAll(/\[([a-z_0-9 ]+?)\]/g)];

const DURATION = /^((?:Conc\., )?(?:\d+ (?:round|min|ora|ore|giorno|giorni)|Istantanea|Speciale|Fino a dissolto(?: o attivato)?|Fino a \d+ (?:ore|ora|min)))/;
const TAGS = /^(Concentrazione · Rituale|Concentrazione|Rituale) ?/;
const TIME = /^(Azione Bonus|Azione|Reazione|(\d+) (min|ora|ore))(?: \((.*)\))?$/;

let level = 0;
const spells: Json[] = [];
idMarks.forEach((m, i) => {
  const id = m[1]!.replace(/ /g, "");
  const from = m.index! + m[0].length;
  const to = i + 1 < idMarks.length ? idMarks[i + 1]!.index! : rawCat.length;
  // testo del blocco + nomi dell'incantesimo successivo (dopo l'ultimo ". " oppure dopo un marcatore di livello)
  let body = rawCat.slice(from, to), nextNames = "", nextLevel = level;
  if (i + 1 < idMarks.length) {
    const lm = /⟦L:(\d)⟧/.exec(body);
    if (lm) { nextLevel = Number(lm[1]); nextNames = body.slice(lm.index! + lm[0].length); body = body.slice(0, lm.index); }
    else { const k = body.lastIndexOf(". "); if (k < 0) throw new Error(`${id}: confine col successivo non trovato`); nextNames = body.slice(k + 2); body = body.slice(0, k + 1); }
  }
  // nomi di QUESTO incantesimo: testo prima dell'id, dopo l'ultimo ". " / marcatore di livello (già scartato nel ciclo precedente)
  spells.push({ id, level, body: norm(body), _next: norm(nextNames) });
  if (i + 1 < idMarks.length) { spells[spells.length - 1]!._nextLevel = nextLevel; }
  level = nextLevel;
});
// i nomi del primo incantesimo stanno prima del primo id
const firstNames = norm(rawCat.slice(0, idMarks[0]!.index).replace(/⟦L:\d⟧/g, ""));
spells.forEach((s, i) => { s.names = i === 0 ? firstNames : spells[i - 1]!._next; });

const parsed = spells.map((s) => {
  const ctx = s.id;
  const names = splitNames(s.names, s.id);
  const t = s.body as string;
  const g = /^(\S+) (.+?) Tempo: (.+?) Gittata: (.+?) Comp\.: (.+?) Durata: (.*)$/.exec(t);
  if (!g) throw new Error(`${ctx}: campi non riconosciuti in "${t.slice(0, 120)}"`);
  const school = SCHOOL[g[1]!];
  if (!school) throw new Error(`${ctx}: scuola sconosciuta "${g[1]}"`);
  const classes = g[2]!.split(", ").map((c) => CLASS[c.trim()] ?? (() => { throw new Error(`${ctx}: classe sconosciuta "${c}"`); })());
  const tm = TIME.exec(g[3]!.trim());
  if (!tm) throw new Error(`${ctx}: tempo di lancio "${g[3]}"`);
  const unit = tm[1] === "Azione Bonus" ? "bonus_action" : tm[1] === "Azione" ? "action" : tm[1] === "Reazione" ? "reaction" : tm[3] === "min" ? "minute" : "hour";
  const castingTime = { unit, amount: tm[2] ? Number(tm[2]) : 1, ...(tm[4] ? { trigger: norm(tm[4]) } : {}) };
  // componenti: "V,S,M(polvere di rubino 50 mo, consumata)"
  const cm = /^([VSM,]+)(?:\((.*)\))?$/.exec(g[5]!.replace(/\s+/g, " ").trim());
  if (!cm) throw new Error(`${ctx}: componenti "${g[5]}"`);
  const mat = cm[2] ? norm(cm[2]) : undefined;
  const cost = mat && /(\d[\d.]*) mo/.exec(mat);
  const components = {
    v: cm[1]!.includes("V"), s: cm[1]!.includes("S"), m: cm[1]!.includes("M"),
    ...(mat ? { material: mat } : {}), ...(cost ? { materialCost: Number(cost[1]!.replace(/\./g, "")) } : {}),
    materialConsumed: !!mat && /consumat/.test(mat),
  };
  // durata, tag, risoluzione, effetto, livelli superiori
  let rest = norm(g[6]!);
  const dm = DURATION.exec(rest);
  if (!dm) throw new Error(`${ctx}: durata non riconosciuta in "${rest.slice(0, 60)}"`);
  rest = rest.slice(dm[0].length).trim();
  const tag = TAGS.exec(rest);
  if (tag) rest = rest.slice(tag[0].length).trim();
  let resolution = "none", resolutionRaw: string | undefined;
  const rm = /^Risoluzione: (TS (?:For|Des|Cos|Int|Sag|Car)(?: \/ (?:For|Des|Cos|Int|Sag|Car))?|TS vari?o?|Att\. distanza inc\.|Att\. mischia inc\.|Indagare) ?/.exec(rest);
  if (rm) {
    rest = rest.slice(rm[0].length).trim();
    const r = rm[1]!;
    resolution = /^TS (For|Des|Cos|Int|Sag|Car)/.test(r) ? SAVE[/^TS (\w+)/.exec(r)![1]!]! : r.startsWith("Att. distanza") ? "attack_ranged" : r.startsWith("Att. mischia") ? "attack_melee" : "none";
    if (/\/|vari|Indagare/.test(r)) resolutionRaw = r;
  }
  const hl = rest.indexOf("Livelli superiori:");
  const summary = norm(hl >= 0 ? rest.slice(0, hl) : rest);
  const higher = hl >= 0 ? norm(rest.slice(hl + "Livelli superiori:".length)) : undefined;
  const conc = dm[1]!.startsWith("Conc.") || !!tag?.[1]!.includes("Concentrazione");
  return {
    id: s.id, name: names, level: s.level, school, classes, castingTime, range: norm(g[4]!), components,
    duration: dm[1]!, concentration: conc, ritual: !!tag?.[1]!.includes("Rituale"), resolution,
    ...(resolutionRaw ? { resolutionRaw } : {}), summary, ...(higher ? { higherLevels: higher } : {}),
  };
});
if (parsed.length !== 390) throw new Error(`Incantesimi: ${parsed.length} (attesi 390)`);
if (new Set(parsed.map((p) => p.id)).size !== 390) throw new Error("Incantesimi: id duplicati");

// ---------- controllo incrociato con le liste per classe (§5) ----------
const iLists = last("5. Liste degli incantesimi per classe"), iEnd = last("6. Catalogo degli incantesimi");
const listLines = lines.slice(iLists + 1, iEnd);
const byName = new Map(parsed.map((p) => [compact(p.name.it), p]));
const heads = listLines.flatMap((l, i) => (/^\S+\s+\[(\w+)\]$/.test(l.trim()) && Object.values(CLASS).includes(/\[(\w+)\]/.exec(l)![1]!) ? [{ i, id: /\[(\w+)\]/.exec(l)![1]! }] : []));
const problems: string[] = [];
heads.forEach((h, hi) => {
  const block = listLines.slice(h.i + 1, hi + 1 < heads.length ? heads[hi + 1]!.i : undefined).filter((l) => !/^Livello\s{3}Incantesimi/.test(l));
  const entries: { lv: number; text: string }[] = [];
  for (const l of block) {
    const m = /^(Trucchetti|(\d)°)\s{3}(.*)$/.exec(l);
    if (m) entries.push({ lv: m[1] === "Trucchetti" ? 0 : Number(m[2]), text: m[3]! });
    else if (entries.length) entries[entries.length - 1]!.text += " " + l.trim();
  }
  const seen = new Set<string>();
  for (const e of entries) for (const raw of norm(e.text.replace(/[◆®] = \w+/g, "")).split(", ")) { // toglie la legenda "◆ = Concentrazione ® = Rituale"
    const flags = { conc: raw.includes("◆"), rit: raw.includes("®") };
    const name = raw.replace(/[◆®]/g, "").trim();
    const sp = byName.get(compact(name));
    if (!sp) { problems.push(`${h.id} liv.${e.lv}: "${name}" non esiste nel catalogo`); continue; }
    seen.add(sp.id);
    if (sp.level !== e.lv) problems.push(`${h.id}: ${sp.id} è di livello ${sp.level}, nella lista ${e.lv}`);
    if (!sp.classes.includes(h.id)) problems.push(`${h.id}: ${sp.id} non ha la classe nella scheda`);
    if (sp.concentration !== flags.conc) problems.push(`${sp.id}: Concentrazione ${sp.concentration} ≠ lista ${flags.conc}`);
    if (sp.ritual !== flags.rit) problems.push(`${sp.id}: Rituale ${sp.ritual} ≠ lista ${flags.rit}`);
  }
  for (const p of parsed) if (p.classes.includes(h.id) && !seen.has(p.id)) problems.push(`${h.id}: ${p.id} ha la classe ma non è nella lista`);
});
if (heads.length !== 8) problems.push(`Liste di classe trovate: ${heads.length} (attese 8)`);
if (problems.length) throw new Error(`Controllo incrociato con le liste per classe:\n- ${problems.slice(0, 25).join("\n- ")}${problems.length > 25 ? `\n... e altri ${problems.length - 25}` : ""}`);

// ---------- tabelle degli slot (multiclasse) ----------
const iS = at("2. Tabelle degli slot"), iF = at("3. Fonti di lanci gratuiti (senza slot)");
const tables: Record<string, number[][]> = { full_caster: [], half_caster: [], third_caster: [] };
let curTable = "";
for (const l of lines.slice(iS, iF)) {
  const t = l.trim();
  if (t.startsWith("Incantatore completo")) curTable = "full_caster";
  else if (t.startsWith("Mezzo incantatore")) curTable = "half_caster";
  else if (t.startsWith("Terzo incantatore")) curTable = "third_caster";
  else if (t.startsWith("Magia del patto")) curTable = "";
  const m = curTable && /^(\d{1,2})\s{3}((?:[\d—]+\s*)+)$/.exec(t);
  if (m) {
    const nums = m[2]!.trim().split(/\s+/);
    if (nums.length === 9) { tables[curTable]![Number(m[1]) - 1] = nums.filter((n) => n !== "—").map(Number); }
  }
}
const NAMES: Record<string, string> = { full_caster: "Incantatore completo (tabella multiclasse)", half_caster: "Mezzo incantatore", third_caster: "Terzo incantatore" };
const slotTables = Object.entries(tables).map(([id, rows]) => {
  const slots = Array.from({ length: 20 }, (_, i) => rows[i] ?? []);
  if (id !== "third_caster" && slots.some((r) => r.length === 0)) throw new Error(`Tabella slot ${id} incompleta`);
  if (id === "third_caster" && slots.slice(2).some((r) => r.length === 0)) throw new Error("Tabella slot del terzo incantatore incompleta (dal 3°)");
  return { id, name: { it: NAMES[id] }, slots };
});

for (const [kind, entries] of [["spells", parsed], ["slotTables", slotTables]] as const) {
  writeFileSync(`${OUT}/${kind}.json`, JSON.stringify({ kind, entries }, null, 1) + "\n");
  console.log(`${kind.padEnd(17)} ${entries.length}`);
}
