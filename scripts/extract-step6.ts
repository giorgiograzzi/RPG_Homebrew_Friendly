// Step 6: specie dal PDF "01_Dati_Gioco" → data/private/species.json
import { writeFileSync } from "node:fs";
import { bodyLines, pdfPages } from "./lib/pdf-text";
import { fixSpellModes, spellLevels } from "./lib/spells";
import { DRAGON_DAMAGE, FREE_CAST_USES, OPTION_EFFECTS, SIMPLE_CHOICES, SPECIES_EFFECTS } from "./lib/species-rules";

const SRC = process.env.RULES_DIR ?? "docs/rules";
const OUT = "data/private";
const lines = bodyLines(await pdfPages(`${SRC}/01_Dati_Gioco_DnD2024.pdf`));
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
type Json = Record<string, unknown>;

// ---- blocchi per specie ----
const start = lines.findIndex((l) => l.trim() === "2. Specie");
const end = lines.findIndex((l, i) => i > start && l.trim() === "3. Background");
const HEAD = /^(.+?) \((.+?)\)\s+\[(\w+)\]\s*$/;
const heads = lines.map((l, i) => ({ m: HEAD.exec(l.trim()), i })).filter((h) => h.m && h.i > start && h.i < end);
if (heads.length !== 10) throw new Error(`Specie trovate: ${heads.length} (attese 10)`);

const SIZE: Record<string, string> = { Minuscola: "tiny", Piccola: "small", Media: "medium", Grande: "large" };

// Uso dei tratti: "Usi: 1 / Riposo Lungo", "Usi: bonus competenza / Riposo Breve o Lungo"
const USI = / ?Usi: (1|bonus competenza) \/ Riposo (Lungo|Breve o Lungo)/g;

function traits(text: string) {
  const marks = [...text.matchAll(/\[(\w+)\] (\d) /g)];
  if (!marks.length) throw new Error("Nessun tratto trovato");
  const out: Json[] = [];
  // l'intestazione della tabella dei tratti ("Tratto Livello Effetto") non fa parte del nome
  const stripHeader = (n: string) => n.replace(/^(?:Tratto Livello Effetto )+/, "").trim();
  let name = stripHeader(norm(text.slice(0, marks[0]!.index)));
  marks.forEach((m, i) => {
    const from = m.index! + m[0].length;
    const to = i + 1 < marks.length ? marks[i + 1]!.index! : text.length;
    const gap = text.slice(from, to);
    const uses = [...gap.matchAll(USI)][0];
    const clean = norm(gap.replace(USI, ""));
    let desc = clean, next = "";
    if (i + 1 < marks.length) {
      const k = clean.lastIndexOf(". ");
      if (k < 0) throw new Error(`Tratto ${m[1]}: confine col tratto successivo non trovato`);
      desc = clean.slice(0, k + 1); next = stripHeader(clean.slice(k + 2));
    }
    out.push({
      id: m[1], name: { it: name }, level: Number(m[2]), description: desc,
      effects: uses ? [{
        op: "resource", resourceId: m[1], uses: uses[1] === "1" ? 1 : "pb",
        recharge: uses[2] === "Lungo" ? "long_rest" : "short_rest",
      }] : [],
    });
    name = next;
  });
  return out;
}

const SPELLS = /Incantesimi: (liv\.\d+: [a-z_, ]+?(?:; liv\.\d+: [a-z_, ]+?)*)(?= [A-Z]|$)/;
const LEVELS = spellLevels(); // trucchetto o 1° livello secondo i dati veri degli incantesimi
function spellEffects(list: string): Json[] {
  return list.split("; ").flatMap((part) => {
    const [lv, ids] = part.replace("liv.", "").split(": ") as [string, string];
    return ids.split(", ").map((spell) => LEVELS.get(spell) === 0
      ? { op: "grantSpell", spell, mode: "cantrip", abilityFrom: "spell_ability" }
      : {
        op: "grantSpell", spell, mode: "alwaysPrepared", abilityFrom: "spell_ability", // caratteristica scelta (scelta spell_ability)
        freeCast: { uses: FREE_CAST_USES[spell] ?? 1, recharge: "long_rest" },
        ...(Number(lv) > 1 ? { when: `level>=${lv}` } : {}),
      });
  });
}

function choices(text: string): Json[] {
  return text.split("Scelta: ").filter(Boolean).map((part) => {
    const h = /^(.+?) \[(\w+)\] (.*)$/.exec(part.trim())!;
    const [label, id, rest] = [h[1]!, h[2]!, h[3]!];
    if (!rest.startsWith("Opzione Effetto ")) {
      const c = SIMPLE_CHOICES[id];
      if (!c) throw new Error(`Scelta semplice non codificata: ${id} ("${rest}")`);
      return c;
    }
    const body = rest.slice("Opzione Effetto ".length);
    const marks = [...body.matchAll(/\[(\w+)\]/g)];
    let name = norm(body.slice(0, marks[0]!.index));
    const options = marks.map((m, i) => {
      const from = m.index! + m[0].length;
      const seg = norm(body.slice(from, i + 1 < marks.length ? marks[i + 1]!.index : undefined));
      let own = seg, next = "";
      if (i + 1 < marks.length) {
        const sp = SPELLS.exec(seg), dr = /Danno\/resistenza: \S+/.exec(seg);
        const cut = sp ? sp.index + sp[0].length : dr ? dr.index + dr[0].length : seg.lastIndexOf(". ") + 1;
        if (cut <= 0) throw new Error(`Opzione ${m[1]}: confine non trovato`);
        own = seg.slice(0, cut); next = seg.slice(cut).trim();
      }
      const sp = SPELLS.exec(own);
      const dr = /Danno\/resistenza: (\S+)/.exec(own);
      const effects: Json[] = [...(OPTION_EFFECTS[`${id}/${m[1]}`] ?? [])];
      if (sp) effects.push(...spellEffects(sp[1]!));
      if (dr) {
        const t = DRAGON_DAMAGE[dr[1]!];
        if (!t) throw new Error(`Tipo di danno sconosciuto: ${dr[1]}`);
        effects.push({ op: "resistance", types: [t] });
      }
      const opt = { id: m[1], name: { it: name }, description: sp ? own.slice(0, sp.index).trim() : own, effects };
      name = next;
      return opt;
    });
    return { id, label: { it: label }, count: 1, options };
  });
}

const species = heads.map((h, hi) => {
  const [, it, en, id] = h.m!;
  const block = norm(lines.slice(h.i + 1, hi + 1 < heads.length ? heads[hi + 1]!.i : end).join(" ").replace(/Tratto Livello Effetto/g, ""));
  const tv = /^Taglia: (.+?) Velocità: (\d+) ft (.*)$/.exec(block);
  if (!tv) throw new Error(`${id}: taglia/velocità non trovate`);
  const sizes = tv[1]!.replace(/ \(a scelta\)/, "").split(" o ").map((s) => SIZE[s]!);
  if (sizes.some((s) => !s)) throw new Error(`${id}: taglia sconosciuta "${tv[1]}"`);
  const [traitsText, ...ch] = tv[3]!.split("Scelta: ");
  const cs = choices(ch.map((c) => "Scelta: " + c).join(""));
  if (sizes.length > 1) cs.unshift({ id: "size", label: { it: "Taglia" }, count: 1, options: sizes.map((s) => ({ id: s, name: { it: s } })) });
  if (!SPECIES_EFFECTS[id!]) throw new Error(`Specie senza regole: ${id}`);
  return {
    id, name: { it, en }, sizes, speed: Number(tv[2]), traits: traits(traitsText!),
    effects: SPECIES_EFFECTS[id!], choices: cs,
  };
});

fixSpellModes(species, "species", LEVELS);
writeFileSync(`${OUT}/species.json`, JSON.stringify({ kind: "species", entries: species }, null, 1) + "\n");
console.log(`species           ${species.length}`);
