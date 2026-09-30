// Step 5: talenti e background dal PDF "01_Dati_Gioco" → data/private/{feats,backgrounds}.json
// Richiede i dati dello step 4 (npm run extract:data li genera prima).
import { readFileSync, writeFileSync } from "node:fs";
import { FEAT_RULES } from "./lib/feat-rules";
import { bodyLines, pdfPages, section } from "./lib/pdf-text";
import { equipment, itemNames } from "./lib/equipment";
import { fixSpellModes } from "./lib/spells";
import { splitNames } from "./lib/util";

const SRC = process.env.RULES_DIR ?? "docs/rules";
const OUT = "data/private";
const read = (k: string) => (JSON.parse(readFileSync(`${OUT}/${k}.json`, "utf8")) as { entries: any[] }).entries;

const ABIL: Record<string, string> = { Forza: "str", Destrezza: "dex", Costituzione: "con", Intelligenza: "int", Saggezza: "wis", Carisma: "cha" };
const AB = Object.keys(ABIL).join("|");
const ARMOR: Record<string, string> = { leggere: "light", medie: "medium", pesanti: "heavy", scudi: "shield" };

const lines = bodyLines(await pdfPages(`${SRC}/01_Dati_Gioco_DnD2024.pdf`));

// ---------- Talenti ----------
const ftext = section(lines, "5. Talenti", "6. Armi").replace(/Talento Aumento Prerequisiti Effetto ?/g, "");
const HEADERS: [string, string][] = [
  ["origin", "Origine (livello 1, da background o Umano)"],
  ["general", "Generale (dal 4° livello, via Aumento dei punteggi di caratteristica)"],
  ["fighting_style", "Stile di combattimento (solo con il privilegio Stile di combattimento)"],
  ["epic_boon", "Dono epico (dal 19° livello)"],
];
const cuts = HEADERS.map(([c, h]) => {
  const at = ftext.indexOf(h);
  if (at < 0) throw new Error(`Titolo talenti non trovato: ${h}`);
  return { c, at, from: at + h.length };
});

// "liv. 4+; Forza 13+ o Destrezza 13+; addestramento armature medie" → condizioni (tutte da soddisfare)
function prerequisites(s: string): { conds: string[]; rest: string } {
  const conds: string[] = [];
  let rest = s;
  if (rest.startsWith("— ")) return { conds, rest: rest.slice(2) };
  const item = new RegExp(`^(?:liv\\. (\\d+)\\+|((?:${AB}) \\d+\\+(?: o (?:${AB}) \\d+\\+)*)|privilegio (Incantesimi o Magia del patto|Stile di combattimento|Incantesimi)|addestramento armature (leggere|medie|pesanti|scudi))(?:;\\s*|\\s+)`);
  for (let m; (m = item.exec(rest)); rest = rest.slice(m[0].length)) {
    if (m[1]) conds.push(`level>=${m[1]}`);
    else if (m[2]) conds.push(m[2].split(" o ").map((a) => { const [n, v] = a.split(" "); return `ability:${ABIL[n!]}>=${parseInt(v!)}`; }).join(" || "));
    else if (m[3]) conds.push(m[3] === "Stile di combattimento" ? "hasFeature:fighting_style" : m[3] === "Incantesimi" ? "hasFeature:spellcasting" : "hasFeature:spellcasting || hasFeature:pact_magic");
    else conds.push(`trained:${ARMOR[m[4]!]}`);
  }
  return { conds, rest };
}

const feats: any[] = [];
cuts.forEach((cut, ci) => {
  const text = ftext.slice(cut.from, cuts[ci + 1]?.at).trim();
  const ids = [...text.matchAll(/\[([a-z_ ]+?)\]/g)];
  ids.forEach((m, i) => {
    const id = m[1]!.replace(/ /g, "");
    const startNames = i === 0 ? 0 : -1;
    const prevEnd = i === 0 ? 0 : ids[i - 1]!.index! + ids[i - 1]![0].length;
    const before = text.slice(prevEnd, m.index);
    // nomi = dopo l'ultimo ". " del testo precedente (effetto del talento prima)
    const names = i === 0 ? before : before.slice(before.lastIndexOf(". ") + 2);
    void startNames;
    const segEnd = i + 1 < ids.length ? (() => { const b = text.slice(m.index! + m[0].length, ids[i + 1]!.index); return m.index! + m[0].length + b.lastIndexOf(". ") + 1; })() : text.length;
    let seg = text.slice(m.index! + m[0].length, segEnd).trim();
    const repeatable = seg.startsWith("ripetibile ");
    if (repeatable) seg = seg.slice(11);
    const inc = new RegExp(`^(—|vedi effetto|\\+(\\d) ((?:${AB})(?: / (?:${AB}))*) \\(max (\\d+)\\)) `).exec(seg);
    if (!inc) throw new Error(`Talento ${id}: colonna Aumento non riconosciuta: ${seg.slice(0, 60)}`);
    const abilityIncrease = inc[3] ? inc[3].split(" / ").map((a) => ABIL[a]!) : undefined;
    const { conds, rest } = prerequisites(seg.slice(inc[0].length));
    const rule = FEAT_RULES[id];
    feats.push({
      id, name: splitNames(names.trim(), id), category: cut.c, description: rest.trim(), prerequisites: conds, repeatable,
      ...(abilityIncrease ? { abilityIncrease } : {}), effects: rule?.effects ?? [], choices: rule?.choices ?? [],
      ...(rule?.needsReview ? { needsReview: true } : {}),
    });
  });
});
if (new Set(feats.map((f) => f.id)).size !== feats.length) throw new Error("Talenti: id duplicati");

// ---------- Background ----------
const items = itemNames();
const toolIds = new Map<string, string>(read("tools").map((t) => [t.name.it, t.id]));
const skillIds = read("skills").map((s) => s.name.it as string).sort((a, b) => b.length - a.length);
const skillId = new Map<string, string>(read("skills").map((s) => [s.name.it, s.id]));
const featByName = new Map<string, string>(feats.map((f) => [f.name.it, f.id]));
const LIST: Record<string, string> = { Chierico: "cleric", Druido: "druid", Mago: "wizard" };
const GROUP: Record<string, string> = { "Strumenti da artigiano": "artisan", "Set da gioco": "gaming", "Strumento musicale": "musical" };

const btext = section(lines, "3. Background", "4. Classi");
const body = btext.slice(btext.indexOf("(B = 50 mo)") + "(B = 50 mo)".length).trim();
const bre = new RegExp(`\\[(\\w+)\\] ((?:${AB}), (?:${AB}), (?:${AB})) (.+?) ((?:${skillIds.join("|").replace(/[()]/g, "")}), (?:${skillIds.join("|")})) (.+?) (\\d+ mo)(?= |$)`, "g");
const backgrounds: any[] = [];
let end = 0;
for (let m; (m = bre.exec(body)); end = m.index + m[0].length) {
  const id = m[1]!;
  const names = splitNames(body.slice(end, m.index).trim(), id);
  const abil = m[2]!.split(", ").map((a) => ABIL[a]!);
  const fm = /^(.+?)(?: \((Chierico|Druido|Mago)\))?$/.exec(m[3]!)!;
  const feat = featByName.get(fm[1]!);
  if (!feat) throw new Error(`Background ${id}: talento sconosciuto "${m[3]}"`);
  const skills = m[4]!.split(", ").map((s) => skillId.get(s)!);
  // colonna Strumento + equipaggiamento A: lo strumento è o "uno tra: Gruppo" o un nome noto, il resto è equipaggiamento
  const rest = m[5]! + " " + m[6]!;
  let tool: string, eq: string;
  const grp = /^uno tra: (Strumenti da artigiano|Set da gioco|Strumento musicale) (.+)$/.exec(rest);
  if (grp) { tool = GROUP[grp[1]!]!; eq = grp[2]!; }
  else {
    const t = [...toolIds.keys()].sort((a, b) => b.length - a.length).find((n) => rest.startsWith(n + " "));
    if (!t) throw new Error(`Background ${id}: strumento non riconosciuto in "${rest.slice(0, 50)}"`);
    tool = toolIds.get(t)!; eq = rest.slice(t.length + 1);
  }
  const groupChoice = ["artisan", "gaming", "musical"].includes(tool)
    ? [{ id: `${id}_tool`, label: { it: "Strumento" }, count: 1, source: `tools:${tool}` }] : [];
  backgrounds.push({
    id, name: names, abilityOptions: abil, skills, tool, feat, ...(fm[2] ? { featConfig: { list: LIST[fm[2]]! } } : {}),
    equipment: { A: equipment(eq, items), B: { items: [], gp: 50 } }, choices: groupChoice,
  });
}
if (backgrounds.length !== 16) throw new Error(`Background trovati: ${backgrounds.length} (attesi 16)`);
if (body.slice(end).trim()) throw new Error(`Background: testo non riconosciuto: ${body.slice(end, end + 80)}`);

fixSpellModes(feats, "feats");
for (const [kind, entries] of [["feats", feats], ["backgrounds", backgrounds]] as const) {
  writeFileSync(`${OUT}/${kind}.json`, JSON.stringify({ kind, entries }, null, 1) + "\n");
  console.log(`${kind.padEnd(17)} ${entries.length}`);
}
