// Incantesimi SRD 5.2.1: legge le descrizioni da entrambi i PDF, li abbina e verifica IT/EN e liste di classe.
// Non scrive nulla se anche un solo controllo fallisce.
import { readSpells, readClassLists, type RawSpell } from "./lib/spells-parse";
import { snake, srdPages, writeKind, type Entry } from "./lib/srd";

const SCH: Record<string, string> = { trasmutazione: "transmutation", evocazione: "conjuration", invocazione: "evocation", abiurazione: "abjuration", ammaliamento: "enchantment", divinazione: "divination", illusione: "illusion", necromanzia: "necromancy" };
const CL: Record<string, string> = { bardo: "bard", chierico: "cleric", druido: "druid", mago: "wizard", stregone: "sorcerer", warlock: "warlock", ranger: "ranger", paladino: "paladin" };
// Abbinamenti EN → IT per i gruppi in cui livello, scuola, classi e componenti non bastano (verificati a mano sul PDF)
const TIEBREAK: Record<string, string> = {
  "Ray of Frost": "Raggio di gelo", "Shocking Grasp": "Stretta folgorante", "Fireball": "Palla di fuoco", "Lightning Bolt": "Fulmine",
  "Fear": "Paura", "Major Image": "Immagine maggiore", "Find Familiar": "Trova famiglio", "Floating Disk": "Disco fluttuante",
  "Flesh to Stone": "Carne in pietra", "Move Earth": "Muovere il terreno", "Fly": "Volare", "Gaseous Form": "Forma gassosa",
  "Plant Growth": "Crescita vegetale", "Speak with Plants": "Parlare con i vegetali",
};
// Incoerenze dell'SRD stesso (uguali in IT e EN), risolte a favore dell'intestazione dell'incantesimo:
// - Sfera infuocata: nell'intestazione è Evocazione/Conjuration ma nelle liste di classe Invocazione/Evocation (come nel manuale 2024: evocation)
const SCHOOL_FIX: Record<string, string> = { flaming_sphere: "evocation" };
// - Alcuni incantesimi mancano dalle liste di classe del capitolo ma hanno la classe nell'intestazione
const LIST_OMISSIONS: Record<string, string[]> = { bard: ["phantasmal_force"], sorcerer: ["mind_spike", "phantasmal_force"], wizard: ["phantasmal_force"] };
// - Refusi nelle liste IT: "Saltare" invece di "Salto"
const LIST_NAME_FIX: Record<string, string> = { saltare: "salto" };
const problems: string[] = [];
const bad = (m: string) => problems.push(m);

const [en, it] = [await readSpells("en"), await readSpells("it")];

// Nel PDF inglese si perdono le maiuscole F G H I J K (anche a inizio frase: "f you cast" per "If you cast").
// Si ripristinano scegliendo la lettera che dà la parola più frequente nel resto del testo dell'SRD.
const freq = new Map<string, number>();
for (const t of await srdPages("en")) for (const w of t.toLowerCase().match(/[a-z’]+/g) ?? []) freq.set(w, (freq.get(w) ?? 0) + 1);
// parole che la frequenza non risolve ("ft" è un'unità, "guided" e "furthermore" non compaiono mai intere)
const LOST_INITIAL: Record<string, string> = { t: "I", uided: "G", urthermore: "F" };
function restoreInitials(text: string, where: string): string {
  return text.replace(/(^|[.!?] +)([a-z][a-z’]*)/g, (all, pre: string, w: string) => {
    if (LOST_INITIAL[w]) return pre + LOST_INITIAL[w] + w;
    const cands = ["f", "g", "h", "i", "j", "k"].map((c) => [c + w, freq.get(c + w) ?? 0] as const).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (!cands.length || (cands[1] && cands[0]![1] < cands[1][1] * 3)) { bad(`${where}: iniziale persa non risolvibile in "${pre}${w}"`); return all; }
    const best = cands[0]![0];
    return pre + best[0]!.toUpperCase() + best.slice(1);
  });
}
// maiuscole perse in mezzo alla frase (trovate confrontando le parole con le loro varianti F-K); ogni correzione deve servire almeno una volta
const MID_FIXES: [RegExp, string][] = [
  [/\(\s*ire\s*\)/g, "(Fire)"], [/\bire damage/g, "Fire damage"], [/\bncapacitated condition/g, "Incapacitated condition"],
  [/\bnvisible condition/g, "Invisible condition"], [/Celestial, ey, or iend/g, "Celestial, Fey, or Fiend"], [/\balf Cover/g, "Half Cover"],
];
const usedFix = new Set<number>();
for (const s of en) for (const k of ["body", "higher"] as const) MID_FIXES.forEach(([re, to], n) => { s[k] = s[k].replace(re, () => (usedFix.add(n), to)); });
MID_FIXES.forEach(([re], n) => { if (!usedFix.has(n)) bad(`correzione inutilizzata: ${re}`); });
for (const s of en) { s.body = restoreInitials(s.body, s.name); s.higher = restoreInitials(s.higher, s.name); }
if (en.length !== it.length) bad(`numero di incantesimi diverso: EN ${en.length}, IT ${it.length}`);

// --- abbinamento -----------------------------------------------------------------------------------------------
const fp = (s: RawSpell, l: "en" | "it") => [s.level, l === "it" ? SCH[s.school] : s.school, s.classes.map((c) => (l === "it" ? CL[c] : c)).sort().join(","),
  s.components.replace(/\(.*$/s, "").replace(/\s/g, ""), /ritual/i.test(s.castingTime), /^concentrazione|^concentration/i.test(s.duration)].join("|");
const dice = (s: RawSpell) => (s.body + " " + s.higher).match(/\b\d+d\d+\b/g) ?? [];
const sim = (a: RawSpell, b: RawSpell) => {
  const [x, y] = [dice(a), dice(b)]; const r = [...y]; let c = 0;
  for (const t of x) { const i = r.indexOf(t); if (i >= 0) { c++; r.splice(i, 1); } }
  return c * 2 - (x.length - c) - (y.length - c) - Math.abs(a.body.length - b.body.length) / 1000;
};
const groups = new Map<string, [RawSpell[], RawSpell[]]>();
for (const [i, list] of [en, it].entries()) for (const s of list) {
  const k = fp(s, i ? "it" : "en"); if (!groups.has(k)) groups.set(k, [[], []]); groups.get(k)![i]!.push(s);
}
const pairs: [RawSpell, RawSpell][] = [];
for (const [k, [a, b]] of groups) {
  if (a.length !== b.length) { bad(`gruppo ${k}: EN ${a.map((x) => x.name)} / IT ${b.map((x) => x.name)}`); continue; }
  const free = [...b];
  for (const x of a) {
    let j = -1;
    if (a.length === 1) j = 0;
    else if (TIEBREAK[x.name]) j = free.findIndex((y) => y.name === TIEBREAK[x.name]);
    else { let best = -1e9; free.forEach((y, n) => { const s = sim(x, y); if (s > best) { best = s; j = n; } }); }
    if (j < 0) { bad(`${x.name}: nessun abbinamento IT`); continue; }
    pairs.push([x, free.splice(j, 1)[0]!]);
  }
}
// ogni gruppo con più di una voce deve essere coperto da TIEBREAK o da un punteggio senza ambiguità: gli altri si controllano sui dadi
// (sotto, nel confronto dei dadi) e sul numero di quelle già fissate a mano
for (const [x] of pairs) if (!x.name) bad("nome vuoto");

// --- liste di classe nei capitoli --------------------------------------------------------------------------------
const lists = { en: await readClassLists("en"), it: await readClassLists("it") };

// nomi EN: le intestazioni hanno il maiuscoletto ("Acid SplASh"), le liste di classe il nome normale
const listNames = new Map<string, string>();
for (const byLevel of Object.values(lists.en)) for (const rows of Object.values(byLevel)) for (const r of rows) listNames.set(r.name.toLowerCase(), r.name);
const displayName = (n: string) => listNames.get(n.toLowerCase()) ?? n;

// --- valori ------------------------------------------------------------------------------------------------------
const TIME_EN = /^(Action|Bonus Action|Reaction|(\d+) (minutes?|hours?))(.*)$/i;
const TIME_IT = /^(azione bonus|azione|reazione|(\d+) (minuti|minuto|ore|ora))(.*)$/i;
const UNIT = (s: string): [string, number] => {
  const t = s.toLowerCase();
  if (t === "action" || t === "azione") return ["action", 1];
  if (t === "bonus action" || t === "azione bonus") return ["bonus_action", 1];
  if (t === "reaction" || t === "reazione") return ["reaction", 1];
  const m = t.match(/^(\d+) (minutes?|minut[oi])$/); if (m) return ["minute", Number(m[1])];
  const h = t.match(/^(\d+) (hours?|or[ae])$/); if (h) return ["hour", Number(h[1])];
  throw new Error(`tempo di lancio sconosciuto "${s}"`);
};
function castingTime(s: RawSpell, l: "en" | "it") {
  const m = s.castingTime.match(l === "en" ? TIME_EN : TIME_IT);
  if (!m) throw new Error(`tempo di lancio "${s.castingTime}"`);
  const [unit, amount] = UNIT(m[1]!);
  let rest = m[4]!.trim().replace(/^,\s*/, "");
  const ritual = l === "en" ? /^or Ritual$/i.test(rest) : /^o rituale$/i.test(rest);
  if (ritual) rest = "";
  return { unit, amount, ritual, trigger: rest.replace(/^or Ritual$/, "") };
}
const GOLD = (u: string) => ({ g: 1, m: 1, s: 0.1, c: 0.01 })[/^(monete|pezz[oi]) d'oro|^gold|^gp|^mo$/i.test(u) ? "g" : /^(monete|pezz[oi]) d'argento|^silver|^sp|^ma$/i.test(u) ? "s" : "c"];
function material(s: RawSpell, l: "en" | "it") {
  const c = s.components, m = c.match(/^([VSM, ]+?)(?: \((.*)\))?$/s);
  if (!m) throw new Error(`componenti "${c}"`);
  const set = m[1]!.split(",").map((x) => x.trim());
  const text = m[2]?.replace(/\s+/g, " ");
  const cost = text?.match(l === "en" ? /([\d,]+)\+? (GP|SP|CP|Gold Pieces?|Silver Pieces?|Copper Pieces?)/ : /([\d.]+)\+? (monete d'oro|monete d'argento|monete di rame|pezz[oi] d'oro|pezz[oi] d'argento|pezz[oi] di rame|mo|ma|mr)/);
  const consumed = !!text && (l === "en" ? /consumes/.test(text) : /consum/.test(text));
  return {
    v: set.includes("V"), s: set.includes("S"), m: set.includes("M"), text,
    cost: cost ? Number(cost[1]!.replace(/[,.]/g, "")) * GOLD(cost[2]!) : undefined, consumed,
  };
}
const SAVE: Record<string, string> = { Strength: "str", Dexterity: "dex", Constitution: "con", Intelligence: "int", Wisdom: "wis", Charisma: "cha", Forza: "str", Destrezza: "dex", Costituzione: "con", Intelligenza: "int", Saggezza: "wis", Carisma: "cha" };
function resolution(s: RawSpell, l: "en" | "it") {
  const t = s.body + " " + s.higher;
  const found: { at: number; r: string }[] = [];
  const add = (re: RegExp, f: (m: RegExpMatchArray) => string) => { for (const m of t.matchAll(re)) found.push({ at: m.index!, r: f(m) }); };
  if (l === "en") {
    add(/\b(?:a|an|the)(?: DC \d+)? (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw\b/g, (m) => `save_${SAVE[m[1]!]}`);
    add(/\b(melee|ranged) spell attack/gi, (m) => `attack_${m[1]!.toLowerCase()}`);
  } else {
    add(/\btiro salvezza su (Forza|Destrezza|Costituzione|Intelligenza|Saggezza|Carisma)/g, (m) => `save_${SAVE[m[1]!]}`);
    add(/\battacco(?: con incantesimo)? (in mischia|a distanza)/g, (m) => `attack_${m[1] === "a distanza" ? "ranged" : "melee"}`);
  }
  found.sort((a, b) => a.at - b.at);
  const kinds = [...new Set(found.map((f) => f.r))];
  return { kinds, first: kinds[0] ?? "none" };
}

const entries: Entry[] = [];
for (const [e, i] of pairs) {
  const id = snake(e.name), tag = `${id}`;
  try {
    const [ce, ci] = [castingTime(e, "en"), castingTime(i, "it")];
    if (ce.unit !== ci.unit || ce.amount !== ci.amount || ce.ritual !== ci.ritual) bad(`${tag}: tempo di lancio diverso (${e.castingTime} / ${i.castingTime})`);
    const [me, mi] = [material(e, "en"), material(i, "it")];
    if (me.v !== mi.v || me.s !== mi.s || me.m !== mi.m || me.cost !== mi.cost || me.consumed !== mi.consumed) bad(`${tag}: componenti diverse (${e.components} / ${i.components})`);
    const [re, ri] = [resolution(e, "en"), resolution(i, "it")];
    // i tiri salvezza devono coincidere; l'attacco con incantesimo in EN deve comparire anche in IT (non viceversa: "attacco in mischia" compare anche in altri contesti)
    const saves = (r: { kinds: string[] }) => r.kinds.filter((k) => k.startsWith("save_")).sort().join();
    if (saves(re) !== saves(ri) || re.kinds.filter((k) => k.startsWith("attack_")).some((k) => !ri.kinds.includes(k))) bad(`${tag}: risoluzione diversa EN ${re.kinds} / IT ${ri.kinds}`);
    const [de, di] = [[...new Set(dice(e))].sort().join(), [...new Set(dice(i))].sort().join()];
    if (de !== di) bad(`${tag}: dadi diversi EN [${de}] / IT [${di}]`);
    const [conE, conI] = [/^concentration/i.test(e.duration), /^concentrazione/i.test(i.duration)];
    if (conE !== conI) bad(`${tag}: concentrazione diversa`);
    if (e.level !== i.level || e.school !== SCH[i.school]) bad(`${tag}: livello o scuola diversi`);
    if (e.classes.join() !== i.classes.map((c) => CL[c]).join() && e.classes.slice().sort().join() !== i.classes.map((c) => CL[c]).sort().join()) bad(`${tag}: classi diverse`);
    if (!!e.higher !== !!i.higher) bad(`${tag}: livelli superiori presenti solo in una lingua`);
    // gittata: i piedi devono corrispondere ai metri (1 m = 10/3 piedi)
    const [rf, rm] = [e.range.match(/^(\d+) feet$/), i.range.match(/^([\d,]+) metri$/)];
    if (!!rf !== !!rm || (rf && Math.round(Number(rm![1]!.replace(",", ".")) * 10 / 3) !== Number(rf[1]))) bad(`${tag}: gittata diversa (${e.range} / ${i.range})`);
    entries.push({
      id, name: { en: displayName(e.name), it: i.name },
      level: e.level, school: SCHOOL_FIX[id] ?? e.school, classes: e.classes,
      castingTime: { unit: ce.unit, amount: ce.amount, ...(ce.trigger ? { trigger: { it: ci.trigger, en: ce.trigger } } : {}) },
      range: { it: i.range, en: e.range },
      components: { v: me.v, s: me.s, m: me.m, ...(me.text ? { material: { it: mi.text!, en: me.text } } : {}), ...(me.cost !== undefined ? { materialCost: me.cost } : {}), materialConsumed: me.consumed },
      duration: { it: i.duration, en: e.duration },
      concentration: conE, ritual: ce.ritual,
      resolution: re.first, ...(re.kinds.length > 1 ? { resolutionRaw: re.kinds.join(" / ") } : {}),
      summary: { it: i.body, en: e.body },
      ...(e.higher ? { higherLevels: { it: i.higher, en: e.higher } } : {}),
    });
  } catch (err) { bad(`${tag}: ${(err as Error).message}`); }
}

// liste di classe dei capitoli: devono coincidere con le intestazioni degli incantesimi (livello, scuola, classi, C/R/M)
const byEnName = new Map(pairs.map(([x, y]) => [snake(x.name), { en: x, it: y }]));
for (const l of ["en", "it"] as const) {
  const src = l === "en" ? en : it;
  const idOf = (name: string) => l === "en" ? snake(name) : snake(pairs.find(([, y]) => y.name.toLowerCase() === name.toLowerCase())?.[0].name ?? "?");
  for (const [cls, byLevel] of Object.entries(lists[l])) {
    const clsId = l === "en" ? cls : CL[cls]!;
    const fromHeads = src.filter((s) => s.classes.some((c) => (l === "en" ? c : CL[c]) === clsId));
    const rows = Object.entries(byLevel).flatMap(([lv, rs]) => rs.map((r) => ({ ...r, level: Number(lv) })));
    const key = (n: string) => { const k = n.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " "); return LIST_NAME_FIX[k] ?? k; };
    const heads = new Map(fromHeads.map((s) => [key(s.name), s]));
    const seen = new Set<string>();
    for (const r of rows) {
      const s = heads.get(key(r.name));
      if (!s) { bad(`[${l}] ${cls}: "${r.name}" è nella lista ma non nelle intestazioni`); continue; }
      seen.add(key(r.name));
      const id = idOf(s.name);
      const school = SCHOOL_FIX[id] ?? (l === "en" ? s.school : SCH[s.school]);
      const listSchool = l === "en" ? r.school.toLowerCase() : SCH[r.school.toLowerCase()];
      if (s.level !== r.level || school !== listSchool) bad(`[${l}] ${cls}/${r.name}: livello o scuola diversi dalla lista`);
      const mat = byEnName.get(id) ? material(l === "en" ? byEnName.get(id)!.en : byEnName.get(id)!.it, l) : undefined;
      const flags = [/^concentra/i.test(s.duration) && "C", /ritual/i.test(s.castingTime) && "R", mat && mat.cost !== undefined && (mat.cost >= 1 || mat.consumed) && "M"].filter(Boolean).join(", ");
      if (flags !== r.special) bad(`[${l}] ${cls}/${r.name}: speciale "${r.special}" ≠ "${flags}"`);
    }
    const missing = fromHeads.filter((s) => !seen.has(key(s.name))).map((s) => idOf(s.name)).sort();
    const allowed = (LIST_OMISSIONS[clsId] ?? []).slice().sort();
    if (missing.join() !== allowed.join()) bad(`[${l}] ${cls}: incantesimi non in lista: [${missing}], attesi [${allowed}]`);
  }
}

if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
entries.sort((a, b) => a.id.localeCompare(b.id));
writeKind("spells", entries);
