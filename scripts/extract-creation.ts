// Regole di creazione dal PDF "02_Regole_Creazione_Personaggio" → data/private/creation.json (un record, id "creation")
import { writeFileSync } from "node:fs";
import { bodyLines, pdfPages } from "./lib/pdf-text";

const SRC = process.env.RULES_DIR ?? "docs/rules";
const OUT = "data/private";
const lines = bodyLines(await pdfPages(`${SRC}/02_Regole_Creazione_Personaggio.pdf`))
  .filter((l) => !/^Regole per la creazione del personaggio\s+pag\./.test(l));
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const text = norm(lines.join(" "));

// array standard e acquisto a punti
const arr = /Array standard\s+(\d+), (\d+), (\d+), (\d+), (\d+), (\d+)/.exec(norm(lines.join("   ")));
if (!arr) throw new Error("Array standard non trovato");
const standardArray = arr.slice(1).map(Number);
const pts = lines.find((l) => /^Punteggio\s+8\s/.test(l)), cost = lines.find((l) => /^Costo\s+0\s/.test(l));
if (!pts || !cost) throw new Error("Tabella acquisto a punti non trovata");
const scoreCol = pts.trim().split(/\s+/).slice(1).map(Number), costCol = cost.trim().split(/\s+/).slice(1).map(Number);
const budget = Number(/(\d+) punti; ogni punteggio parte da 8/.exec(text)?.[1]);
if (!budget || scoreCol.length !== costCol.length) throw new Error("Acquisto a punti non riconosciuto");
const pointBuy = { budget, min: Math.min(...scoreCol), max: Math.max(...scoreCol), costs: Object.fromEntries(scoreCol.map((s, i) => [String(s), costCol[i]!])) };

// array consigliati per classe (For Des Cos Int Sag Car)
const CLASS: Record<string, string> = { Barbaro: "barbarian", Bardo: "bard", Chierico: "cleric", Druido: "druid", Guerriero: "fighter", Monaco: "monk", Paladino: "paladin", Ranger: "ranger", Ladro: "rogue", Stregone: "sorcerer", Warlock: "warlock", Mago: "wizard" };
const ORDER = ["str", "dex", "con", "int", "wis", "cha"];
const recommendedArrays: Record<string, Record<string, number>> = {};
for (const l of lines) {
  const m = /^(\w+)\s{3}(\d+)\s{3}(\d+)\s{3}(\d+)\s{3}(\d+)\s{3}(\d+)\s{3}(\d+)\s*$/.exec(l.trim());
  if (m && CLASS[m[1]!]) recommendedArrays[CLASS[m[1]!]!] = Object.fromEntries(ORDER.map((a, i) => [a, Number(m[i + 2])]));
}
if (Object.keys(recommendedArrays).length !== 12) throw new Error(`Array consigliati: ${Object.keys(recommendedArrays).length}/12`);
for (const [c, a] of Object.entries(recommendedArrays)) if ([...Object.values(a)].sort().join() !== [...standardArray].sort().join()) throw new Error(`Array consigliato di ${c} non è una permutazione dell'array standard`);

// partire a livello più alto
const tail = text.slice(text.indexOf("Partire a livello più alto"));
const num = (s: string) => Number(s.replace(/\./g, ""));
const rows = [
  { re: /2-4 Equipaggiamento iniziale normale (\d+) Comun/, lv: [2, 4] },
  { re: /5-10 (\d[\d.]*) mo \+ 1d10 × (\d+) mo/, lv: [5, 10] },
  { re: /11-16 (\d[\d.]*) mo \+ 1d10 × (\d+) mo/, lv: [11, 16] },
  { re: /17-20 (\d[\d.]*) mo \+ 1d10 × (\d+) mo/, lv: [17, 20] },
];
const MAGIC = [{ common: 1, uncommon: 0, rare: 0, veryRare: 0 }, { common: 1, uncommon: 1, rare: 0, veryRare: 0 }, { common: 2, uncommon: 3, rare: 1, veryRare: 0 }, { common: 2, uncommon: 4, rare: 3, veryRare: 1 }];
const startingLevels = rows.map((r, i) => {
  const m = r.re.exec(tail);
  if (!m) throw new Error(`Livello di partenza ${r.lv.join("-")} non trovato`);
  return { minLevel: r.lv[0]!, maxLevel: r.lv[1]!, gold: i === 0 ? 0 : num(m[1]!), ...(i === 0 ? {} : { goldDice: { sides: 10, count: 1, multiplier: num(m[2]!) } }), magicItems: MAGIC[i]! };
});
// controllo degli oggetti magici scritti nel PDF: "1 Comune, 1 Non comune" ecc.
const magicText = ["1 Comune", "1 Comune, 1 Non comune", "2 Comuni, 3 Non comuni, 1 Raro", "2 Comuni, 4 Non comuni, 3 Rari, 1 Molto raro"];
for (const t of magicText) if (!tail.includes(t)) throw new Error(`Oggetti magici non trovati: ${t}`);

// allineamenti
const al = /Legale Buono, Neutrale Buono, Caotico Buono, Legale Neutrale, Neutrale, Caotico Neutrale, Legale Malvagio, Neutrale Malvagio, Caotico Malvagio/.exec(text);
if (!al) throw new Error("Allineamenti non trovati");
const AL: Record<string, string> = {
  "Legale Buono": "lawful_good", "Neutrale Buono": "neutral_good", "Caotico Buono": "chaotic_good", "Legale Neutrale": "lawful_neutral", Neutrale: "true_neutral",
  "Caotico Neutrale": "chaotic_neutral", "Legale Malvagio": "lawful_evil", "Neutrale Malvagio": "neutral_evil", "Caotico Malvagio": "chaotic_evil",
};
const alignments = [...al[0].split(", ").map((n) => ({ id: AL[n]!, name: { it: n } })), { id: "unaligned", name: { it: "Non allineato" } }];

// punti esperienza per livello (§7 "Avanzamento di livello"): due colonne "Liv PX Comp." affiancate
const xpText = /Liv PX Comp\. Liv PX Comp\.(.*?)• A ogni livello/.exec(text)?.[1];
const xpRows = [...(xpText ?? "").matchAll(/(\d+) ([\d.]+) \+(\d)/g)].map((m) => ({ level: Number(m[1]), xp: Number(m[2]!.replace(/\./g, "")), pb: Number(m[3]) }));
const xpByLevel = Array.from({ length: 20 }, (_, i) => xpRows.find((r) => r.level === i + 1));
if (xpByLevel.some((r) => !r)) throw new Error(`Tabella PX incompleta: ${xpRows.length} righe`);
const xpThresholds = xpByLevel.map((r) => r!.xp);
if (xpThresholds.some((v, i) => i > 0 && v <= xpThresholds[i - 1]!) || xpThresholds[0] !== 0 || xpThresholds[19] !== 355000) throw new Error("Tabella PX non coerente");

const entry = { id: "creation", standardArray, pointBuy, recommendedArrays, startingLevels, alignments, xpThresholds };
writeFileSync(`${OUT}/creation.json`, JSON.stringify({ kind: "creation", entries: [entry] }, null, 1) + "\n");
console.log(`creation          1 (array ${standardArray.join("/")}, ${budget} punti, ${startingLevels.length} fasce di livello, ${alignments.length} allineamenti)`);
