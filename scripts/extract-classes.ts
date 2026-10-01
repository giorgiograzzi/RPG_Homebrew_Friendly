// Step 2d — Classi e sottoclassi. I dati stanno in scripts/lib/classes-*.ts; qui si VERIFICANO contro i due PDF
// (tratti, equipaggiamento, tabella dei livelli, intestazioni dei privilegi) e si scrivono classes.json e subclasses.json.
import { readFileSync } from "node:fs";
import { CLASSES } from "./lib/classes-index";
import { verifyClass } from "./lib/class-verify";
import { SLOT_COL, type FeatureDef, type ItemDef, type Table } from "./lib/class-types";
import { writeKind, type Entry, type Lang } from "./lib/srd";

const skillNames = Object.fromEntries((["it", "en"] as Lang[]).map((l) => [l, Object.fromEntries((JSON.parse(readFileSync(`data/srd/${l}/skills.json`, "utf8")) as { entries: { id: string; name: string }[] }).entries.map((e) => [e.id, e.name]))])) as Record<Lang, Record<string, string>>;
// "$skill:athletics" → nome della lingua del file; si risolve prima della localizzazione ({ it, en } → stringa)
const resolve = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(resolve);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.it === "string" && typeof o.en === "string" && o.it.startsWith("$skill:")) return { it: skillNames.it[o.it.slice(7)] ?? o.it, en: skillNames.en[o.en.slice(7)] ?? o.en };
    return Object.fromEntries(Object.entries(o).map(([a, b]) => [a, resolve(b)]));
  }
  return v;
};

const errors: string[] = [];
const feature = (x: FeatureDef, t: Table): Entry => {
  const b = x.build?.(t) ?? {};
  const { row: _r, tableOnly: _t, build: _b, effects, choices, usage, activation, ...rest } = x;
  return { ...rest, ...(b.effects ?? effects ? { effects: b.effects ?? effects } : {}), ...(b.choices ?? choices ? { choices: b.choices ?? choices } : {}),
    ...(b.usage ?? usage ? { usage: b.usage ?? usage } : {}), ...(b.activation ?? activation ? { activation: b.activation ?? activation } : {}), origin: "srd" } as unknown as Entry;
};
const eqSet = (e: { gp: number; items: ItemDef[] }) => ({ items: e.items.map((i) => ({ item: i.item, qty: i.qty ?? 1 })), gp: e.gp });

const classes: Entry[] = [], subclasses: Entry[] = [];
for (const d of CLASSES) {
  const { table, errors: errs } = await verifyClass(d);
  errors.push(...errs);
  const skillsChoice = { id: `${d.id}_skills`, label: { it: "Abilità di classe", en: "Class skills" }, count: d.skills.count,
    ...(d.skills.from === "any" ? { source: "skills" } : { options: (d.skills.from).map((s) => ({ id: s, name: { it: `$skill:${s}`, en: `$skill:${s}` }, effects: [{ op: "grantSkillProficiency", skills: [s] }] })) }) };
  // slot incantesimo: colonne slot_N della tabella → spellSlots[livello][livello dell'incantesimo]; il resto resta nella tabella
  const slotKeys = Object.keys(table).filter((k) => SLOT_COL.test(k)).sort();
  const spellSlots = slotKeys.length ? Array.from({ length: 20 }, (_, i) => { const row = slotKeys.map((k) => Number(table[k]![i])); while (row.length && row.at(-1) === 0) row.pop(); return row; }) : undefined;
  const classTable = Object.fromEntries(Object.entries(table).filter(([k]) => !SLOT_COL.test(k)));
  const spellChoices = d.caster ? [
    ...(classTable.cantrips ? [{ id: `${d.id}_cantrips`, label: { it: "Trucchetti", en: "Cantrips" }, count: 1, countFrom: "cantrips", source: `cantrips:${d.caster.list}` }] : []),
    { id: `${d.id}_prepared`, label: { it: "Incantesimi preparati", en: "Prepared spells" }, count: 1, countFrom: "prepared", source: `spells:${d.caster.list}` },
  ] : [];
  const toolsChoice = d.toolChoice ? { id: `${d.id}_tools`, label: { it: "Strumento", en: "Tool" }, count: d.toolChoice.count, source: d.toolChoice.source } : undefined;
  classes.push(resolve({
    id: d.id, name: d.name, description: d.description, hitDie: d.hitDie, primaryAbility: d.primary, saves: d.saves,
    skillChoices: { count: d.skills.count, from: d.skills.from }, armorTraining: d.armor, weaponProficiency: d.weapons,
    ...(d.tools ? { toolProficiency: d.tools } : {}), caster: d.caster?.type ?? "none",
    ...(d.caster ? { spellAbility: d.caster.ability, spellList: d.caster.list } : {}), ...(spellSlots ? { spellSlots } : {}),
    multiclass: { weapons: d.multiclass.weapons ?? [], armor: d.multiclass.armor ?? [], skills: d.multiclass.skills ?? 0, toolChoices: d.multiclass.toolChoices ?? 0, tools: d.multiclass.tools ?? [] },
    equipment: Object.fromEntries(Object.entries(d.equipment).map(([k, v]) => [k, eqSet(v)])),
    choices: [skillsChoice, ...(toolsChoice ? [toolsChoice] : []), ...spellChoices],
    features: d.features.map((x) => feature(x, table)), table: classTable, subclassLevel: 3,
  }) as Entry);
  subclasses.push(resolve({ id: d.subclass.id, classId: d.id, name: d.subclass.name, description: d.subclass.description, features: d.subclass.features.map((x) => feature(x, table)) }) as Entry);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
writeKind("classes", classes);
writeKind("subclasses", subclasses);
