// Step 2b — Background e talenti. Legge SOLO i due PDF in docs/srd/ (e i dati di 2a già generati per i nomi di oggetti,
// strumenti, armi e abilità). Ogni background è letto dal PDF IT e dal PDF EN e i due risultati devono coincidere:
// altrimenti lo script si ferma. Per i talenti si verifica contro i PDF l'elenco, la categoria e il prerequisito.
import { readFileSync } from "node:fs";
import { FEAT_COUNTS, FEATS, type Category } from "./lib/feats-srd";
import { pageText, splitTop, writeKind, type Entry, type Lang } from "./lib/srd";
import { joinProse } from "./lib/srd-clean";

const errors: string[] = [];
const fail = (m: string) => errors.push(m);

// ---------- nomi → id (dai dati di 2a) ----------
type Named = { id: string; name: string; amount?: number };
const read = (l: Lang, k: string) => (JSON.parse(readFileSync(`data/srd/${l}/${k}.json`, "utf8")) as { entries: Named[] }).entries;
const norm = (s: string) => s.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
const byName = (l: Lang, kinds: string[]) => new Map(kinds.flatMap((k) => read(l, k).map((e) => [norm(e.name), e] as const)));
const ABIL: Record<Lang, Record<string, string>> = {
  en: { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" },
  it: { forza: "str", destrezza: "dex", costituzione: "con", intelligenza: "int", saggezza: "wis", carisma: "cha" },
};
const BACKGROUNDS = [["acolyte", "Acolyte", "Accolito"], ["criminal", "Criminal", "Criminale"], ["sage", "Sage", "Sapiente"], ["soldier", "Soldier", "Soldato"]] as const;
// Plurali usati nell'elenco dell'equipaggiamento
const PLURAL: Record<Lang, Record<string, string>> = {
  en: { daggers: "dagger", pouches: "pouch" },
  it: { pugnali: "pugnale", borse: "borsa" },
};
const L = {
  it: {
    pages: [93, 93] as [number, number], split: /(Accolito|Criminale|Sapiente|Soldato) Punteggi di caratteristica:/g, stop: "Specie dei personaggi",
    block: /Punteggi di caratteristica: (.+?) Talento: (.+?) Competenze nelle abilità: (.+?) Competenza negli strumenti: (.+?) Equipaggiamento: a scelta tra A e B: \(A\) (.+?); o \(B\) (\d+) mo/,
    and: " e ", gaming: /^un tipo di gioco/i, holy: "simbolo sacro", sameAs: /^gioco \(lo stesso/i, sheets: /^(\d+) fogli$/, gp: /^(\d+) mo$/,
  },
  en: {
    pages: [83, 83] as [number, number], split: /(Acolyte|Criminal|Sage|Soldier) Ability Scores:/g, stop: "Character Species",
    block: /Ability Scores: (.+?) Feat: (.+?) Skill Proficiencies: (.+?) Tool Proficiency: (.+?) Equipment: Choose A or B: \(A\) (.+?); or \(B\) (\d+) GP/,
    and: " and ", gaming: /^choose one kind of gaming set/i, holy: "holy symbol", sameAs: /^gaming set \(same as above\)/i, sheets: /^(\d+) sheets$/, gp: /^(\d+) GP$/,
  },
} as const;

interface Parsed { abilities: string[]; feat: string; featConfig?: { list: string }; skills: string[]; tool: string; equipment: { A: { items: object[]; gp: number }; B: { items: never[]; gp: number } } }

async function parseBackgrounds(l: Lang): Promise<Map<string, Parsed>> {
  const cfg = L[l];
  const gear = byName(l, ["items", "tools", "weapons", "armors"]), skills = byName(l, ["skills"]);
  const feats = new Map(FEATS.map((f) => [norm(f[l]), f.id]));
  const text = joinProse(await pageText(l, cfg.pages[0], cfg.pages[1]));
  const chunks = text.split(cfg.split); // [prima, nome, corpo, nome, corpo, ...]
  const out = new Map<string, Parsed>();
  for (let i = 1; i < chunks.length; i += 2) {
    const name = chunks[i]!, body = chunks[i + 1]!.split(cfg.stop)[0]!;
    const id = BACKGROUNDS.find((b) => b[l === "en" ? 1 : 2] === name)?.[0];
    const m = cfg.block.exec(`${l === "en" ? "Ability Scores:" : "Punteggi di caratteristica:"} ${body}`);
    if (!id || !m) { fail(`${l}: background "${name}" non leggibile`); continue; }
    const [, ab, ft, sk, tl, optA, gpB] = m as unknown as string[];
    // talento: "Magic Initiate (Cleric) (see “Feats”)" → id + lista
    const ftClean = ft!.replace(/\s*\((?:see|vedi)[^)]*\)\s*$/i, "").trim();
    const cfgM = /^(.*?) \((.+)\)$/.exec(ftClean);
    const featName = cfgM ? cfgM[1]! : ftClean;
    const featId = feats.get(norm(featName));
    if (!featId) fail(`${l}: talento "${featName}" sconosciuto (${name})`);
    const list = cfgM ? ({ cleric: "cleric", chierico: "cleric", wizard: "wizard", mago: "wizard" } as Record<string, string>)[norm(cfgM[2]!)] : undefined;
    const abilities = ab!.split(", ").map((a) => ABIL[l][norm(a)] ?? (fail(`${l}: caratteristica "${a}"`), "?"));
    const skillIds = sk!.split(cfg.and).map((s) => skills.get(norm(s))?.id ?? (fail(`${l}: abilità "${s}"`), "?"));
    let tool: string;
    if (cfg.gaming.test(tl!)) tool = "gaming";
    else tool = byName(l, ["tools"]).get(norm(tl!))?.id ?? (fail(`${l}: strumento "${tl}"`), "?");
    // equipaggiamento A: "2 Daggers", "Book (prayers)", "Parchment (10 sheets)", "20 Arrows", "8 GP"
    // il PDF IT ha una virgola mancante dopo "libro (storia)": una parentesi seguita da una parola in minuscolo la segnala
    const parts = splitTop(l === "it" ? optA!.replace(/\) (?=\p{Ll})/gu, "), ") : optA!);
    const gold = cfg.gp.exec(parts.pop()!);
    const items = parts.map((tok) => {
      if (cfg.sameAs.test(tok)) return { item: "$tool", qty: 1 };
      let qty = 1, nm = tok;
      const q = /^(\d+) (.+)$/.exec(tok);
      if (q) { qty = Number(q[1]); nm = q[2]!; }
      let note: string | undefined;
      const n = /^(.*\S) \((.+)\)$/.exec(nm);
      if (n) { nm = n[1]!; const sh = cfg.sheets.exec(n[2]!); if (sh) qty = Number(sh[1]); else note = n[2]; }
      if (norm(nm) === cfg.holy) return { item: "$holy_symbol", qty };
      const e = gear.get(norm(PLURAL[l][norm(nm)] ?? nm)) ?? gear.get(norm(nm));
      if (!e) { fail(`${l}: oggetto "${tok}" sconosciuto (${name})`); return { item: "?", qty }; }
      if (e.amount && qty % e.amount === 0) qty /= e.amount; // "20 frecce" = una confezione da 20
      return { item: e.id, qty, ...(note ? { note } : {}) };
    });
    out.set(id, {
      abilities, feat: featId ?? "?", ...(list ? { featConfig: { list } } : {}), skills: skillIds, tool,
      equipment: { A: { items, gp: Number(gold?.[1] ?? NaN) }, B: { items: [], gp: Number(gpB) } },
    });
  }
  if (out.size !== BACKGROUNDS.length) fail(`${l}: attesi ${BACKGROUNDS.length} background, trovati ${out.size}`);
  return out;
}

const [itBg, enBg] = [await parseBackgrounds("it"), await parseBackgrounds("en")];
// verifica incrociata: i due PDF devono dare lo stesso risultato (le note sono testo libero e restano per lingua)
const strip = (p: Parsed) => JSON.stringify({ ...p, equipment: { A: { gp: p.equipment.A.gp, items: p.equipment.A.items.map(({ note: _n, ...x }: any) => x) }, B: p.equipment.B } });
for (const [id] of BACKGROUNDS) if (strip(itBg.get(id)!) !== strip(enBg.get(id)!)) fail(`background ${id}: IT ≠ EN\n  IT ${strip(itBg.get(id)!)}\n  EN ${strip(enBg.get(id)!)}`);
// Gli oggetti sono gli stessi nelle due lingue; la nota ("preghiere" / "prayers") è bilingue
const backgrounds: Entry[] = BACKGROUNDS.map(([id, en, it]) => {
  const [pi, pe] = [itBg.get(id)!, enBg.get(id)!];
  const items = pi.equipment.A.items.map((x: any, i: number) => {
    const y: any = pe.equipment.A.items[i];
    return { item: x.item, qty: x.qty, ...(x.note || y.note ? { note: { it: x.note ?? "", en: y.note ?? "" } } : {}) };
  });
  return { id, name: { en, it }, abilityOptions: pi.abilities, skills: pi.skills, tool: pi.tool, feat: pi.feat, ...(pi.featConfig ? { featConfig: pi.featConfig } : {}),
    equipment: { A: { items, gp: pi.equipment.A.gp }, B: pi.equipment.B },
    // strumento a scelta (gruppo): una scelta `<id>_tool` tra gli strumenti di quel gruppo
    ...(["gaming", "musical", "artisan"].includes(pi.tool) ? { choices: [{ id: `${id}_tool`, label: { it: "Strumento", en: "Tool" }, count: 1, source: `tools:${pi.tool}` }] } : {}) };
});

// ---------- talenti: verifica sui PDF ----------
const CAT = {
  en: { Origin: "origin", General: "general", "Fighting Style": "fighting_style", "Epic Boon": "epic_boon" },
  it: { Origini: "origin", Generale: "general", "Stile di combattimento": "fighting_style", "Dono epico": "epic_boon" },
} as Record<Lang, Record<string, Category>>;
const HEAD = {
  en: /([A-Z][A-Za-z’'-]*(?: [A-Za-z’'-]+)*?) (Origin|General|Fighting Style|Epic Boon) Feat(?: \(Prerequisite: ([^)]*)\))?/g,
  it: /([A-Z][A-Za-zàèéìòùÀ’'-]*(?: [A-Za-zàèéìòùÀ’'-]+)*?) Talento (Origini|Generale|Stile di combattimento|Dono epico)(?: \(prerequisito: ([^)]*)\))?/g,
};
const norm2 = (s: string) => norm(s).replace(/\.$/, "");
for (const [l, [a, b]] of [["en", [87, 90]], ["it", [98, 100]]] as [Lang, [number, number]][]) {
  const text = joinProse(await pageText(l, a, b));
  const found = [...text.matchAll(HEAD[l])].map((m) => ({ name: m[1]!.split(/\. | (?=[A-Z][a-z]+ Feat\b)/).pop()!.trim(), cat: CAT[l][m[2]!]!, pre: m[3] ?? "" }));
  const counts: Record<string, number> = {};
  for (const f of found) counts[f.cat] = (counts[f.cat] ?? 0) + 1;
  for (const [c, n] of Object.entries(FEAT_COUNTS)) if (counts[c] !== n) fail(`talenti ${l}: categoria ${c} attesi ${n}, trovati ${counts[c] ?? 0}`);
  for (const d of FEATS) {
    // il nome del PDF può essere preceduto da altro testo: si controlla che l'intestazione finisca con il nome
    const h = found.find((f) => norm(f.name).endsWith(norm(d[l])));
    if (!h) { fail(`talento ${d.id}: intestazione "${d[l]}" non trovata nel PDF ${l}`); continue; }
    if (h.cat !== d.category) fail(`talento ${d.id}: categoria ${h.cat} nel PDF ${l}, nei dati ${d.category}`);
    if (norm2(h.pre) !== norm2(l === "en" ? d.prereqEn : d.prereqIt)) fail(`talento ${d.id}: prerequisito "${h.pre}" nel PDF ${l}, nei dati "${l === "en" ? d.prereqEn : d.prereqIt}"`);
  }
}
const feats: Entry[] = FEATS.map((f) => ({
  id: f.id, name: { en: f.en, it: f.it }, category: f.category, prerequisites: f.prereq, repeatable: f.repeatable ?? false,
  ...(f.abilityIncrease ? { abilityIncrease: f.abilityIncrease } : {}), ...(f.effects ? { effects: f.effects } : {}), ...(f.choices ? { choices: f.choices } : {}),
}));

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
writeKind("backgrounds", backgrounds);
writeKind("feats", feats);
