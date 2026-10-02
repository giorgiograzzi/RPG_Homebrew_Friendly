// Oggetti magici SRD 5.2.1 («Oggetti magici A–Z» / «Magic Items A–Z»): legge i due PDF, abbina le voci con la tabella dei nomi
// (lib/magic-names.ts) e controlla che tipo, rarità, sintonia, dadi e CD coincidano. Non scrive nulla se anche un solo controllo fallisce.
// Le voci sono oggetti normali (kind "items", categoria "magic") con in più il blocco `magic`; vanno in data/srd/<lingua>/magic_items.json.
import { MAGIC_NAMES } from "./lib/magic-names";
import { readMagic, type RawMagic } from "./lib/magic-parse";
import { parseType } from "./lib/magic-type";
import { restoreInitials } from "./lib/initials";
import { snake, srdPages, writeKind, type Entry } from "./lib/srd";

const problems: string[] = [];
const bad = (m: string) => problems.push(m);

const [en, it] = [await readMagic("en"), await readMagic("it")];
if (en.length !== it.length) bad(`numero di oggetti diverso: EN ${en.length}, IT ${it.length}`);

// Il PDF inglese ha la «Q» maiuscola con il codice del numero 4 ("4uiver", "4uickness")
const fixQ = (s: string) => s.replace(/\b4u(?=[a-z])/g, "Qu");
for (const e of en) { e.name = fixQ(e.name); e.body = fixQ(e.body); }
// e perde le maiuscole F G H I J K (anche a inizio frase): si ripristinano come per gli incantesimi
const restore = await restoreInitials(await srdPages("en"));
// maiuscole perse in mezzo alla frase (trovate dalla segnalazione di restoreInitials); ogni correzione deve servire almeno una volta
const MID_FIXES: [RegExp, string][] = [
  [/\balf Cover\b/g, "Half Cover"], [/\binesse property\b/g, "Finesse property"], [/\(Quarterstaff orm Only\)/g, "(Quarterstaff Form Only)"],
];
const usedFix = new Set<number>();
for (const e of en) MID_FIXES.forEach(([re, to], n) => { e.body = e.body.replace(re, () => (usedFix.add(n), to)); });
MID_FIXES.forEach(([re], n) => { if (!usedFix.has(n)) bad(`correzione inutilizzata: ${re}`); });
// parole normali che la segnalazione scambia per iniziali perse
const REAL_WORDS = new Set(["nock", "lying"]);
for (const e of en) e.body = restore(e.body, e.name, bad, REAL_WORDS);

// --- abbinamento -----------------------------------------------------------------------------------------------
const byName = (list: RawMagic[], l: string) => {
  const m = new Map<string, RawMagic>();
  for (const e of list) { if (m.has(e.name)) bad(`[${l}] nome doppio: ${e.name}`); m.set(e.name, e); }
  return m;
};
const [enBy, itBy] = [byName(en, "en"), byName(it, "it")];
const usedEn = new Set<string>(), usedIt = new Set<string>();
const pairs: [RawMagic, RawMagic][] = [];
for (const [a, b] of MAGIC_NAMES) {
  const [x, y] = [enBy.get(a), itBy.get(b)];
  if (!x) { bad(`tabella nomi: "${a}" non c'è nel PDF inglese`); continue; }
  if (!y) { bad(`tabella nomi: "${b}" non c'è nel PDF italiano`); continue; }
  if (usedEn.has(a) || usedIt.has(b)) bad(`tabella nomi: voce doppia (${a} / ${b})`);
  usedEn.add(a); usedIt.add(b); pairs.push([x, y]);
}
for (const e of en) if (!usedEn.has(e.name)) bad(`senza abbinamento EN: ${e.name}`);
for (const e of it) if (!usedIt.has(e.name)) bad(`senza abbinamento IT: ${e.name}`);

// --- controlli e valori ----------------------------------------------------------------------------------------
// id: nome inglese in snake_case; le voci «+1, +2 o +3» finiscono con _plus
const ID_FIX: Record<string, string> = { "Stone of Good Luck (Luckstone)": "stone_of_good_luck" };
const idOf = (name: string) => ID_FIX[name] ?? (/, \+1, \+2, or \+3$/.test(name) ? `${snake(name.replace(/, \+1, \+2, or \+3$/, ""))}_plus` : snake(name));
// valori di gioco che devono essere uguali in IT e EN: dadi, CD, bonus (+N) e durate in numeri
const dice = (s: string) => (s.match(/\b\d+d\d+(?:\s*[+−–-]\s*\d+)?/g) ?? []).map((x) => x.replace(/\s/g, "").replace(/[−–]/g, "-")).sort().join();
// le CD nelle tabelle (intestazioni come «Save DC») non contano: si confrontano solo quelle nel testo
const dcs = (s: string) => [...s.split("\n").filter((x) => !x.includes(" | ")).join("\n").matchAll(/\b(?:DC|CD)\b[^\d.;)]{0,28}?(\d+)/g)].map((m) => m[1]).sort().join();

const entries: Entry[] = [];
for (const [e, i] of pairs) {
  const id = idOf(e.name);
  try {
    const [te, ti] = [parseType(e.typeLine, "en"), parseType(i.typeLine, "it")];
    const same = (k: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad(`${id}: ${k} diverso (EN ${JSON.stringify(a)} / IT ${JSON.stringify(b)})`); };
    same("categoria", te.category, ti.category);
    same("rarità", te.rarity.map((r) => [r.rarity, r.note && /^\+\d$/.test(r.note) ? r.note : !!r.note]), ti.rarity.map((r) => [r.rarity, r.note && /^\+\d$/.test(r.note) ? r.note : !!r.note]));
    same("rarità variabile", te.varies, ti.varies);
    same("sintonia", te.attunement, ti.attunement);
    same("sintonia riservata", !!te.attunementBy, !!ti.attunementBy);
    same("si applica a", !!te.appliesTo, !!ti.appliesTo);
    same("dadi", dice(e.body), dice(i.body));
    same("CD", dcs(e.body), dcs(i.body));
    if (!e.body || !i.body) bad(`${id}: testo vuoto`);
    entries.push({
      id, name: { en: e.name, it: i.name },
      category: "magic", weight: 0, cost: 0,
      attunement: te.attunement,
      magic: {
        type: te.category,
        rarity: te.rarity.map((r, n) => ({ rarity: r.rarity, ...(r.note ? { note: { it: ti.rarity[n]!.note!, en: r.note } } : {}) })),
        varies: te.varies,
        ...(te.appliesTo ? { appliesTo: { it: ti.appliesTo!, en: te.appliesTo } } : {}),
        ...(te.attunementBy ? { attunementBy: { it: ti.attunementBy!, en: te.attunementBy } } : {}),
      },
      description: { it: i.body, en: e.body },
    });
  } catch (err) { bad(`${id}: ${(err as Error).message}`); }
}
const ids = entries.map((x) => x.id);
for (const d of ids.filter((x, n) => ids.indexOf(x) !== n)) bad(`id doppio: ${d}`);

if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
entries.sort((a, b) => a.id.localeCompare(b.id));
writeKind("items", entries, "magic_items");
