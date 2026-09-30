// npm run extract:data — step 4: dal PDF "01_Dati_Gioco" a data/private/*.json
// I PDF stanno in docs/rules/ (non tracciati); anche l'output è ignorato da git.
import { mkdirSync, writeFileSync } from "node:fs";
import { bodyLines, pdfPages, section } from "./lib/pdf-text";
import { splitNames, toCopper } from "./lib/util";

const SRC = process.env.RULES_DIR ?? "docs/rules";
const OUT = "data/private";
const ABIL: Record<string, string> = {
  Forza: "str", Destrezza: "dex", Costituzione: "con", Intelligenza: "int", Saggezza: "wis", Carisma: "cha",
};
const ABIL_RE = Object.keys(ABIL).join("|");
const COST = "(\\d+(?:\\.\\d+)?) (gp|sp|cp)";

const out: Record<string, unknown[]> = {};
const term = (id: string, it: string, en: string | undefined, extra: Record<string, string | number> = {}, description = "") =>
  ({ id, name: en ? { it, en } : { it }, description, extra });

// Tutti i match consecutivi di `re` in `text`; se ci sono buchi (testo non riconosciuto) lo segnala
function all(text: string, re: RegExp, what: string) {
  const res: { m: RegExpExecArray; gap: string }[] = [];
  let end = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) { res.push({ m, gap: text.slice(end, m.index) }); end = m.index + m[0].length; }
  if (!res.length) throw new Error(`${what}: nessuna voce trovata`);
  return { res, tail: text.slice(end) };
}

function fundamentals(lines: string[]) {
  const rows = (from: string, to: string) => lines.slice(lines.findIndex((l) => l.startsWith(from)) + 1, lines.findIndex((l) => l.startsWith(to)));
  out.skills = rows("Abilità   Inglese", "Linguaggi").flatMap((l) => {
    const m = new RegExp(`^(.+?)\\s{2,}(.+?)\\s{2,}(${ABIL_RE})\\s{2,}([a-z_]+)$`).exec(l);
    return m ? [term(m[4]!, m[1]!, m[2], { ability: ABIL[m[3]!]! })] : [];
  });
  const lang = (rows_: string[], rarity: string) => rows_.flatMap((l) => {
    const m = /^(.+?)\s{2,}(.+?)\s{2,}([a-z_]+)(?:\s{2,}(.+))?$/.exec(l);
    return m ? [term(m[3]!, m[1]!, m[2], { rarity }, m[4] ?? "")] : [];
  });
  out.languages = [
    ...lang(rows("Standard   Inglese", "Rari   Inglese"), "standard"),
    ...lang(rows("Rari   Inglese", "In creazione:"), "rare"),
  ];
  out.sizes = lines.flatMap((l) => {
    const m = /^(.+?)\s{2,}(tiny|small|medium|large|huge|gargantuan)\s{2,}([\d.]+)$/.exec(l);
    return m ? [term(m[2]!, m[1]!, undefined, { space: Number(m[3]) })] : [];
  });
  const list = (label: string, until: string) => {
    const a = lines.findIndex((l) => l.startsWith(label)), b = lines.findIndex((l) => l.startsWith(until));
    const text = lines.slice(a, b < 0 ? undefined : b).join(" ").replace(label, "");
    return [...text.matchAll(/([^,[\]]+?) \[([a-z_]+)\]/g)].map((m) => term(m[2]!, m[1]!.trim(), undefined));
  };
  out.damageTypes = list("Tipi di danno:", "Condizioni:");
  out.coins = [...section(lines, "Monete").matchAll(/(Rame|Argento|Electrum|Oro|Platino) (cp|sp|ep|gp|pp) ([\d.]+)/g)].map((m) =>
    term(({ cp: "copper", sp: "silver", ep: "electrum", gp: "gold", pp: "platinum" } as Record<string, string>)[m[2]!]!, m[1]!, undefined,
      { abbr: m[2]!, valueGp: Number(m[3]) }));
}

// Regole per nome: la descrizione va dal titolo fino al titolo successivo
function rules(text: string, names: string[]) {
  const starts = names.map((n) => {
    const m = new RegExp(`${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(([^)]+)\\) \\[(\\w+)\\]`).exec(text);
    if (!m) throw new Error(`Regola non trovata: ${n}`);
    return { n, en: m[1]!, id: m[2]!, at: m.index, from: m.index + m[0].length };
  }).sort((a, b) => a.at - b.at);
  return starts.map((s, i) => term(s.id, s.n, s.en, {}, text.slice(s.from, starts[i + 1]?.at).trim()));
}

const PROP: Record<string, string> = {
  Accurata: "finesse", Leggera: "light", "Da lancio": "thrown", "A due mani": "two_handed", Pesante: "heavy",
  Portata: "reach", Munizioni: "ammunition", Ricarica: "loading", Versatile: "versatile",
};
const DMG: Record<string, string> = { Contundente: "bludgeoning", Perforante: "piercing", Tagliente: "slashing" };
const MAST: Record<string, string> = {
  Fendere: "cleave", Sfiorare: "graze", Intaccare: "nick", Spingere: "push", Fiaccare: "sap",
  Rallentare: "slow", Rovesciare: "topple", Tormentare: "vex",
};

function splitTop(s: string): string[] {
  const r: string[] = []; let d = 0, cur = "";
  for (const c of s) {
    if (c === "(") d++; if (c === ")") d--;
    if (c === "," && d === 0) { r.push(cur.trim()); cur = ""; } else cur += c;
  }
  return [...r, cur.trim()].filter(Boolean);
}

function weapons(lines: string[]) {
  const text = section(lines, "6. Armi", "Proprietà delle armi");
  const re = new RegExp(`(.+?) \\[(\\w+)\\] (Semplice|Marziale) (mischia|distanza) (\\d+d\\d+|\\d+) (Contundente|Perforante|Tagliente) (.+?) (${Object.keys(MAST).join("|")}) ([\\d.]+) lb ${COST}`, "g");
  const { res, tail } = all(text, re, "armi");
  if (tail.trim()) throw new Error(`Armi: testo non riconosciuto: ${tail}`);
  out.weapons = res.map(({ m, gap }) => {
    const names = splitNames(m[1]!.trim(), m[2]!);
    if (gap.trim()) throw new Error(`Armi: testo inatteso prima di ${m[2]}: ${gap}`);
    const props: string[] = []; const notes: string[] = [];
    let versatileDamage: string | undefined; let range: { normal: number; long: number } | undefined; let ammoName: string | undefined;
    for (const tok of m[7] === "—" ? [] : splitTop(m[7]!)) {
      const name = tok.replace(/\s*\(.*$/, "");
      const id = PROP[name];
      if (!id) { notes.push(tok); continue; }
      if (!props.includes(id)) props.push(id);
      const v = /Versatile \((\d+d\d+)\)/.exec(tok); if (v) versatileDamage = v[1];
      const r = /\((\d+)\/(\d+)/.exec(tok); if (r) range = { normal: Number(r[1]), long: Number(r[2]) };
      const am = /^Munizioni \(\d+\/\d+; (.+)\)$/.exec(tok); if (am) ammoName = am[1]; // "Munizioni (80/320; Quadrelli (20))"
    }
    return {
      id: m[2], name: names, category: m[3] === "Semplice" ? "simple" : "martial", kind: m[4] === "mischia" ? "melee" : "ranged",
      damage: m[5], damageType: DMG[m[6]!], properties: props, ...(versatileDamage ? { versatileDamage } : {}),
      ...(range ? { range } : {}), mastery: MAST[m[8]!], weight: Number(m[9]), cost: toCopper(m[10]!, m[11]!),
      description: notes.join(", "),
      ...(ammoName ? { _ammoName: ammoName } : {}),
      ...(notes.some((n) => /solo se non in sella/.test(n)) ? { twoHandedUnlessMounted: true } : {}),
    };
  });
}

const ARMOR_EN: Record<string, string> = {
  padded: "Padded Armor", leather: "Leather Armor", studded_leather: "Studded Leather Armor", hide: "Hide Armor",
  chain_shirt: "Chain Shirt", scale_mail: "Scale Mail", breastplate: "Breastplate", half_plate: "Half Plate Armor",
  ring_mail: "Ring Mail", chain_mail: "Chain Mail", splint: "Splint Armor", plate: "Plate Armor", shield: "Shield",
};

function armors(lines: string[]) {
  const text = section(lines, "7. Armature", "8. Strumenti");
  const times = [/leggere: indossare (\d+) minuto?, togliere (\d+) minuto?/, /medie: indossare (\d+) minut\w, togliere (\d+) minut\w/, /pesanti: indossare (\d+) minut\w, togliere (\d+) minut\w/]
    .map((r) => r.exec(text)?.slice(1).map(Number));
  if (times.some((t) => !t) || !/scudo: 1 azione/.test(text)) throw new Error("Armature: tempi indossa/togli non trovati");
  const T: Record<string, number[]> = { light: times[0]!, medium: times[1]!, heavy: times[2]!, shield: [0, 0] };
  const CAT: Record<string, string> = { Leggere: "light", Medie: "medium", Pesanti: "heavy", Scudo: "shield" };
  const re = new RegExp(`(.+?) \\[(\\w+)\\] (Leggere|Medie|Pesanti|Scudo) (\\+?\\d+)(?: \\+ Des(?: \\(max (\\d)\\))?)? (—|\\d+) (—|Svantaggio) (\\d+) lb ${COST}`, "g");
  out.armors = all(text, re, "armature").res.map(({ m }) => {
    const cat = CAT[m[3]!]!;
    const dexCap = cat === "heavy" ? 0 : m[5] ? Number(m[5]) : null;
    return {
      id: m[2], name: splitNames(m[1]!.trim(), m[2]!, ARMOR_EN[m[2]!]), category: cat, baseAc: Number(m[4]!.replace("+", "")),
      dexCap, strRequired: m[6] === "—" ? 0 : Number(m[6]), stealthDisadvantage: m[7] === "Svantaggio",
      donMinutes: T[cat]![0], doffMinutes: T[cat]![1], weight: Number(m[8]), cost: toCopper(m[9]!, m[10]!),
    };
  });
}

function tools(lines: string[]) {
  const text = section(lines, "8. Strumenti", "9. Equipaggiamento d'avventura");
  const G: Record<string, string> = { "Strumenti da artigiano": "artisan", "Altri strumenti": "other", "Set da gioco": "gaming", "Strumento musicale": "musical" };
  const re = new RegExp(`(.+?) \\((.+?)\\) \\[(\\w+)\\] (${Object.keys(G).join("|")}) (${ABIL_RE}) ([\\d.]+) lb ${COST}`, "g");
  out.tools = all(text, re, "strumenti").res.map(({ m }) => ({
    id: m[3], name: { it: m[1]!.trim(), en: m[2] }, group: G[m[4]!], ability: ABIL[m[5]!], weight: Number(m[6]), cost: toCopper(m[7]!, m[8]!),
  }));
}

// Ultimo gruppo tra parentesi bilanciate alla fine di `s`
function lastGroup(s: string) {
  const t = s.trimEnd(); let d = 0;
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i] === ")") d++;
    if (t[i] === "(" && --d === 0) return { before: t.slice(0, i).trimEnd(), inner: t.slice(i + 1, -1) };
  }
  throw new Error(`Parentesi non bilanciate in "${s}"`);
}

function items(lines: string[]) {
  const gearText = section(lines, "9. Equipaggiamento d'avventura", "Dotazioni (pack)");
  const { res, tail } = all(gearText, new RegExp(`\\[(\\w+)\\] ([\\d.]+) lb ${COST}`, "g"), "oggetti");
  const gear: Record<string, unknown>[] = [];
  let prev: Record<string, unknown> | undefined;
  for (const { m, gap } of res) {
    const { before, inner } = lastGroup(gap);
    const cut = before.lastIndexOf(". ");
    if (prev && cut >= 0) prev.description = before.slice(0, cut + 1).trim();
    const it = (cut >= 0 ? before.slice(cut + 2) : before).trim();
    prev = { id: m[1], name: { it, en: inner }, category: "gear", weight: Number(m[2]), cost: toCopper(m[3]!, m[4]!), description: "" };
    gear.push(prev);
  }
  if (tail.trim() && prev) prev.description = tail.trim();

  const ammoText = section(lines, "Munizioni, colpo senz'armi, armi improvvisate", "7. Armature").replace(/^.*?Munizione Contenitore Peso Costo /, "");
  const ammo = all(ammoText, new RegExp(`(.+?) \\[(\\w+)\\] (Faretra|Custodia per quadrelli|Borsa) ([\\d.]+) lb ${COST}`, "g"), "munizioni").res.map(({ m }) => ({
    id: m[2], name: { it: m[1]!.trim() }, category: "ammunition", weight: Number(m[4]), cost: toCopper(m[5]!, m[6]!), description: `Contenitore: ${m[3]}`,
  }));

  const byName = new Map([...gear, ...ammo].map((g) => [(g.name as { it: string }).it, g.id as string]));
  const packText = section(lines, "Dotazioni (pack)", "Monete");
  const packRe = /(Dotazione da .+?) \((.+?)\) \[(\w+)\] (\d+) gp ([\d.]+) lb (.+?)(?= Dotazione da |$)/g;
  const packs = all(packText, packRe, "dotazioni").res.map(({ m }) => ({
    id: m[3], name: { it: m[1]!, en: m[2] }, category: "pack", weight: Number(m[5]), cost: toCopper(m[4]!, "gp"), description: "",
    contents: splitTop(m[6]!).map((c) => {
      const q = /^(\d+)× (.+)$/.exec(c);
      const name = q ? q[2]! : c; const id = byName.get(name);
      if (!id) throw new Error(`Dotazione ${m[3]}: oggetto sconosciuto "${name}"`);
      return { item: id, qty: q ? Number(q[1]) : 1 };
    }),
  }));
  out.items = [...gear, ...ammo, ...packs];
}

const pages = await pdfPages(`${SRC}/01_Dati_Gioco_DnD2024.pdf`);
const lines = bodyLines(pages);
fundamentals(lines);
weapons(lines); armors(lines); tools(lines); items(lines);
const propText = section(lines, "Proprietà delle armi", "Proprietà di maestria");
out.weaponProperties = rules(propText, ["Munizioni", "Accurata", "Pesante", "Leggera", "Ricarica", "Gittata", "Portata", "Da lancio", "A due mani", "Versatile"]);
out.masteries = rules(section(lines, "Proprietà di maestria", "Munizioni, colpo senz'armi, armi improvvisate"),
  ["Fendere", "Sfiorare", "Intaccare", "Spingere", "Fiaccare", "Rallentare", "Rovesciare", "Tormentare"]);

// munizioni: nome italiano ("Quadrelli (20)") → id dell'oggetto
const ammoIds = new Map((out.items as { id: string; name: { it: string }; category: string }[]).filter((i) => i.category === "ammunition").map((i) => [i.name.it, i.id]));
for (const w of out.weapons as Record<string, any>[]) {
  if (!w._ammoName) continue;
  const aid = ammoIds.get(w._ammoName);
  if (!aid) throw new Error(`Arma ${w.id}: munizione sconosciuta "${w._ammoName}"`);
  w.ammunition = aid; delete w._ammoName;
}

mkdirSync(OUT, { recursive: true });
for (const [kind, entries] of Object.entries(out)) {
  writeFileSync(`${OUT}/${kind}.json`, JSON.stringify({ kind, entries }, null, 1) + "\n");
  console.log(`${kind.padEnd(17)} ${entries.length}`);
}
