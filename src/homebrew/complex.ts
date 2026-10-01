import { buildEffect, readEffect, slugify, type EffectPreset, type HbData, type HbKind, type ParamValues } from "../engine/homebrew";
import type { Ruleset } from "../engine/ruleset";
import type { Effect } from "../engine/types";

// Bozze dei contenuti complessi (specie, background, classi, sottoclassi): il modulo tiene testo e liste, e le converte in dati
// dello stesso schema dei dati ufficiali solo al salvataggio. Tutto ciò che il modulo non sa modificare (campi rari, effetti
// avanzati copiati da una voce ufficiale) sta in `keep` e torna intatto nei dati: duplicare e modificare una voce ufficiale non perde nulla.
export const COMPLEX_KINDS = ["species", "backgrounds", "classes", "subclasses"] as const;
export type ComplexKind = (typeof COMPLEX_KINDS)[number];
export const isComplex = (k: HbKind): k is ComplexKind => (COMPLEX_KINDS as readonly string[]).includes(k);

export interface EffectRow { preset: EffectPreset; values: ParamValues }
export interface OptionDraft { id: string; name: string; description: string; rows: EffectRow[] }
export interface ChoiceDraft { id: string; label: string; count: string; options: OptionDraft[] }
export interface FeatureDraft {
  id: string; name: string; description: string; level: string;
  rows: EffectRow[]; advanced: unknown[]; // effetti non modificabili dal modulo, conservati
  usesOn: boolean; uses: string; recharge: string;
  activatable: boolean; duration: string; resource: string; // resource: risorsa dell'attivazione quando gli usi non si modificano da qui
  choices: ChoiceDraft[]; advancedChoices: unknown[];
  keep: Record<string, unknown>;
}
export interface SetDraft { gp: string; items: { item: string; qty: string }[] }
export interface ColumnDraft { name: string; values: string[] }

const str = (s: unknown) => String(s ?? "").trim();
const num = (s: unknown) => Number(String(s ?? "").replace(",", "."));
export const slug = (name: string, fallback: string) => {
  const s = slugify(name) || fallback;
  return /^[a-z]/.test(s) ? s : `x_${s}`;
};
const stable = (x: unknown): string => JSON.stringify(x, (_, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as object).sort(([a], [b]) => a.localeCompare(b))) : v));
function unique(base: string, taken: Set<string>): string {
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}_${i}`;
  taken.add(id);
  return id;
}
function omit(o: object, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
}

// ---- privilegi / tratti ----
export const emptyFeature = (level = 1): FeatureDraft => ({
  id: "", name: "", description: "", level: String(level), rows: [], advanced: [], usesOn: false, uses: "1", recharge: "long_rest",
  activatable: false, duration: "", resource: "", choices: [], advancedChoices: [], keep: {},
});

// Effetti leggibili dal modulo (tornano identici se ricostruiti) e effetti avanzati, conservati così come sono
const readRows = (effects: Effect[], activeKey: string): { rows: EffectRow[]; advanced: unknown[] } => {
  const rows: EffectRow[] = [], advanced: unknown[] = [];
  for (const e of effects) {
    const { when, ...plain } = e as Effect & { when?: string };
    const r = when === undefined || when === activeKey ? readEffect(plain as Effect) : null;
    if (r && stable(buildEffect(r.preset, r.values)) === stable(plain)) rows.push(r);
    else advanced.push(e);
  }
  return { rows, advanced };
};

export function dataToFeature(d: Record<string, any>): FeatureDraft {
  const plainUses = !!d.usage && (typeof d.usage.uses === "number" || typeof d.usage.uses === "string");
  const simpleActivation = !!d.activation && !d.activation.options && !d.activation.requires && !d.activation.label;
  const { rows, advanced } = readRows((d.effects ?? []) as Effect[], simpleActivation ? `active:${d.id}` : "");
  const choices: ChoiceDraft[] = [], advancedChoices: unknown[] = [];
  for (const c of (d.choices ?? []) as Record<string, any>[]) {
    const read = ((c.options ?? []) as Record<string, any>[]).map((o) => ({ o, r: readRows((o.effects ?? []) as Effect[], "") }));
    const simple = c.options && !c.source && !c.countFrom && !c.countFormula && !c.filter && !c.group && !c.when && !c.abilityFrom && !c.ability
      && read.every(({ o, r }) => r.advanced.length === 0 && !o.requires && o.cost === undefined);
    if (simple) choices.push({ id: c.id, label: c.label.it, count: String(c.count ?? 1), options: read.map(({ o, r }) => ({ id: o.id, name: o.name.it, description: o.description ?? "", rows: r.rows })) });
    else advancedChoices.push(c);
  }
  return {
    id: d.id, name: d.name?.it ?? "", description: d.description ?? "", level: String(d.level ?? 1), rows, advanced,
    usesOn: plainUses, uses: plainUses ? String(d.usage.uses) : "1", recharge: plainUses ? d.usage.recharge : "long_rest",
    activatable: simpleActivation, duration: simpleActivation ? String(d.activation.duration ?? "") : "", resource: simpleActivation ? String(d.activation.resource ?? "") : "",
    choices, advancedChoices,
    keep: omit(d, ["id", "name", "description", "level", "effects", "choices", ...(plainUses ? ["usage"] : []), ...(simpleActivation ? ["activation"] : [])]),
  };
}

export function featureToData(f: FeatureDraft, ownerId: string, taken: Set<string>): Record<string, unknown> {
  const id = f.id || unique(`${ownerId}_${slug(f.name, "privilegio")}`, taken);
  if (f.id) taken.add(f.id);
  const when = f.activatable ? { when: `active:${id}` } : {};
  const effects = [...f.rows.map((r) => ({ ...(buildEffect(r.preset, r.values) as object), ...when })), ...f.advanced];
  const cTaken = new Set<string>(f.choices.map((c) => c.id).filter(Boolean));
  const choices = [
    ...f.choices.map((c, i) => {
      const oTaken = new Set<string>(c.options.map((o) => o.id).filter(Boolean));
      return {
        id: c.id || unique(`${id}_${slug(c.label, `scelta${i + 1}`)}`, cTaken), label: { it: str(c.label) || "Scelta" }, count: Math.max(1, Math.round(num(c.count) || 1)),
        options: c.options.map((o, k) => ({
          id: o.id || unique(slug(o.name, `opzione${k + 1}`), oTaken), name: { it: str(o.name) }, ...(str(o.description) ? { description: str(o.description) } : {}),
          effects: o.rows.map((r) => buildEffect(r.preset, r.values)),
        })),
      };
    }),
    ...f.advancedChoices,
  ];
  const usage = f.usesOn ? { uses: /^\d+$/.test(str(f.uses)) ? Number(str(f.uses)) : str(f.uses), recharge: f.recharge } : undefined;
  return {
    ...f.keep, id, name: { it: str(f.name) }, description: str(f.description), level: Math.round(num(f.level)) || 1,
    effects, choices, ...(usage ? { usage } : {}),
    ...(f.activatable ? { activation: { ...(f.usesOn ? { resource: id } : f.resource ? { resource: f.resource } : {}), ...(str(f.duration) ? { duration: str(f.duration) } : {}) } } : {}),
  };
}

// ---- equipaggiamento A/B ----
export const emptySet = (): SetDraft => ({ gp: "0", items: [] });
export function dataToSet(s: { items?: { item: string; qty?: number }[]; gp?: number } | undefined): SetDraft {
  return s ? { gp: String(s.gp ?? 0), items: (s.items ?? []).map((i) => ({ item: i.item, qty: String(i.qty ?? 1) })) } : emptySet();
}
const setToData = (s: SetDraft) => ({ items: s.items.filter((i) => i.item).map((i) => ({ item: i.item, qty: Math.max(1, Math.round(num(i.qty) || 1)) })), gp: num(s.gp) || 0 });
export function equipmentToData(sets: Record<string, SetDraft>, kept: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...kept };
  for (const [k, s] of Object.entries(sets)) { const d = setToData(s); if (d.items.length || d.gp) out[k] = d; else delete out[k]; }
  return out;
}

// ---- specie ----
export interface SpeciesDraft { name: string; description: string; sizes: string[]; speed: string; features: FeatureDraft[]; keep: Record<string, unknown> }
export const emptySpecies = (): SpeciesDraft => ({ name: "", description: "", sizes: ["medium"], speed: "30", features: [emptyFeature(1)], keep: {} });
export const speciesFromData = (d: Record<string, any>): SpeciesDraft => ({
  name: d.name.it, description: d.description ?? "", sizes: d.sizes ?? ["medium"], speed: String(d.speed ?? 30),
  features: (d.traits ?? []).map(dataToFeature), keep: omit(d, ["id", "name", "description", "sizes", "speed", "traits"]),
});
export function speciesToData(x: SpeciesDraft, id: string): HbData {
  const taken = new Set<string>();
  return {
    ...x.keep, id, name: { it: str(x.name) }, description: str(x.description), sizes: x.sizes, speed: Math.round(num(x.speed)) || 30,
    traits: x.features.filter((f) => str(f.name)).map((f) => featureToData(f, id, taken)),
  } as HbData;
}

// ---- background ----
export interface BackgroundDraft {
  name: string; description: string; abilities: string[]; skills: string[]; tool: string; feat: string;
  sets: Record<"A" | "B", SetDraft>; keep: Record<string, unknown>; keepEquipment: Record<string, unknown>;
}
export const emptyBackground = (rs: Ruleset): BackgroundDraft => ({
  name: "", description: "", abilities: ["str", "dex", "con"], skills: ["athletics", "perception"], tool: "artisan",
  feat: [...rs.feats.values()].find((f) => f.category === "origin")?.id ?? "", sets: { A: emptySet(), B: emptySet() }, keep: {}, keepEquipment: {},
});
export const backgroundFromData = (d: Record<string, any>): BackgroundDraft => ({
  name: d.name.it, description: d.description ?? "", abilities: [...d.abilityOptions], skills: [...d.skills], tool: d.tool, feat: d.feat,
  sets: { A: dataToSet(d.equipment?.A), B: dataToSet(d.equipment?.B) }, keepEquipment: omit(d.equipment ?? {}, ["A", "B"]),
  keep: omit(d, ["id", "name", "description", "abilityOptions", "skills", "tool", "feat", "equipment"]),
});
export const backgroundToData = (x: BackgroundDraft, id: string): HbData => ({
  ...x.keep, id, name: { it: str(x.name) }, description: str(x.description), abilityOptions: x.abilities, skills: x.skills, tool: x.tool, feat: x.feat,
  equipment: equipmentToData(x.sets, x.keepEquipment),
}) as HbData;

// ---- classe ----
export interface ClassDraft {
  name: string; description: string; hitDie: string; primary: string[]; saves: string[];
  skillCount: string; skillFrom: string[]; armor: string[]; weapons: string[];
  caster: string; spellAbility: string; spellList: string; slotsFrom: string; subclassLevel: string;
  columns: ColumnDraft[]; features: FeatureDraft[]; sets: Record<"A" | "B", SetDraft>; keepEquipment: Record<string, unknown>;
  keepChoices: unknown[]; keep: Record<string, unknown>;
}
export const emptyClass = (): ClassDraft => ({
  name: "", description: "", hitDie: "8", primary: ["str"], saves: ["str", "con"], skillCount: "2", skillFrom: [], armor: ["light"], weapons: ["simple"],
  caster: "none", spellAbility: "", spellList: "", slotsFrom: "", subclassLevel: "3", columns: [], features: [emptyFeature(1)],
  sets: { A: emptySet(), B: emptySet() }, keepEquipment: {}, keepChoices: [], keep: {},
});
// Scelte che il modulo genera da solo (abilità, trucchetti, incantesimi preparati): le altre si conservano
const GENERATED = (id: string) => [`${id}_skills`, `${id}_cantrips`, `${id}_prepared`];
export function classFromData(d: Record<string, any>): ClassDraft {
  const cols = Object.entries((d.table ?? {}) as Record<string, (number | string)[]>).map(([name, values]) => ({ name, values: values.map(String) }));
  return {
    name: d.name.it, description: d.description ?? "", hitDie: String(d.hitDie), primary: [...d.primaryAbility], saves: [...d.saves],
    skillCount: String(d.skillChoices?.count ?? 2), skillFrom: d.skillChoices?.from === "any" ? [] : [...(d.skillChoices?.from ?? [])],
    armor: [...(d.armorTraining ?? [])], weapons: [...(d.weaponProficiency ?? [])], caster: d.caster ?? "none", spellAbility: d.spellAbility ?? "", spellList: d.spellList && d.spellList !== d.id ? d.spellList : "",
    slotsFrom: d.spellSlots || d.pactSlots ? "keep" : "", subclassLevel: String(d.subclassLevel ?? 3), columns: cols,
    features: (d.features ?? []).map(dataToFeature), sets: { A: dataToSet(d.equipment?.A), B: dataToSet(d.equipment?.B) },
    keepEquipment: omit(d.equipment ?? {}, ["A", "B"]), keepChoices: (d.choices ?? []).filter((c: { id: string }) => !GENERATED(d.id).includes(c.id)),
    keep: omit(d, ["id", "name", "description", "hitDie", "primaryAbility", "saves", "skillChoices", "armorTraining", "weaponProficiency", "caster", "spellAbility",
      "spellList", "spellSlots", "pactSlots", "subclassLevel", "table", "features", "equipment", "choices"]),
  };
}
export const isCaster = (c: string) => c !== "none";
// Colonne che una classe incantatrice deve avere (da lì arrivano il numero di trucchetti e di incantesimi preparati)
export const CASTER_COLUMNS = ["trucchetti", "preparati"];
// Le colonne scritte in italiano nell'editor hanno un id inglese nei dati (come le classi SRD)
const COLUMN_ID: Record<string, string> = { trucchetti: "cantrips", preparati: "prepared" };

// Elenco delle tabelle di slot su cui modellare la classe: classi (e sottoclassi) del ruleset con slot o slot del patto
export function slotSources(rs: Ruleset, caster: string): { id: string; label: string }[] {
  if (caster === "pact") return [...rs.classes.values()].filter((c) => c.pactSlots).map((c) => ({ id: `class:${c.id}`, label: c.name.it }));
  if (caster === "third") return [...rs.subclasses.values()].filter((s) => s.spellSlots).map((s) => ({ id: `sub:${s.id}`, label: s.name.it }));
  return [...rs.classes.values()].filter((c) => c.spellSlots && c.caster === caster).map((c) => ({ id: `class:${c.id}`, label: c.name.it }));
}

export function classToData(x: ClassDraft, id: string, rs: Ruleset, previous?: Record<string, any>): HbData {
  const taken = new Set<string>();
  const cols: Record<string, (number | string)[]> = {};
  for (const c of x.columns) {
    if (!str(c.name)) continue;
    cols[COLUMN_ID[slug(c.name, "colonna")] ?? slug(c.name, "colonna")] = Array.from({ length: 20 }, (_, i) => { const v = str(c.values[i]); return v === "" ? 0 : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v; });
  }
  const count = Math.max(1, Math.round(num(x.skillCount) || 2));
  const generated: unknown[] = [x.skillFrom.length === 0
    ? { id: `${id}_skills`, label: { it: "Abilità" }, count, source: "skills" }
    : { id: `${id}_skills`, label: { it: "Abilità" }, count, options: x.skillFrom.map((s) => ({ id: s, name: { it: rs.skills.get(s)?.name.it ?? s }, effects: [{ op: "grantSkillProficiency", skills: [s] }] })) }];
  let slots: Record<string, unknown> = {};
  const list = x.spellList || id; // lista di incantesimi: una propria (id della classe) oppure quella di una classe ufficiale
  if (isCaster(x.caster)) {
    if (cols["cantrips"]) generated.push({ id: `${id}_cantrips`, label: { it: "Trucchetti" }, count: 1, countFrom: "cantrips", source: `cantrips:${list}` });
    generated.push({ id: `${id}_prepared`, label: { it: "Incantesimi preparati" }, count: 1, countFrom: "prepared", source: `spells:${list}` });
    if (x.slotsFrom === "keep" && previous) slots = { ...(previous.spellSlots ? { spellSlots: previous.spellSlots } : {}), ...(previous.pactSlots ? { pactSlots: previous.pactSlots } : {}) };
    else if (x.slotsFrom.startsWith("class:")) { const c = rs.classes.get(x.slotsFrom.slice(6)); slots = x.caster === "pact" ? { pactSlots: c?.pactSlots } : { spellSlots: c?.spellSlots }; }
    else if (x.slotsFrom.startsWith("sub:")) slots = { spellSlots: rs.subclasses.get(x.slotsFrom.slice(4))?.spellSlots };
  }
  return {
    ...x.keep, id, name: { it: str(x.name) }, description: str(x.description), hitDie: Number(x.hitDie), primaryAbility: x.primary, saves: x.saves,
    skillChoices: { count, from: x.skillFrom.length === 0 ? "any" : x.skillFrom }, armorTraining: x.armor, weaponProficiency: x.weapons,
    caster: x.caster, ...(isCaster(x.caster) ? { spellAbility: x.spellAbility, spellList: list } : {}), ...slots,
    subclassLevel: Math.round(num(x.subclassLevel)) || 3, table: cols,
    features: x.features.filter((f) => str(f.name)).map((f) => featureToData(f, id, taken)).sort((a, b) => Number(a.level) - Number(b.level)),
    equipment: equipmentToData(x.sets, x.keepEquipment), choices: [...generated, ...x.keepChoices],
  } as HbData;
}

// ---- sottoclasse ----
export interface SubclassDraft { name: string; description: string; classId: string; features: FeatureDraft[]; keep: Record<string, unknown> }
export const emptySubclass = (classId = ""): SubclassDraft => ({ name: "", description: "", classId, features: [emptyFeature(3)], keep: {} });
export const subclassFromData = (d: Record<string, any>): SubclassDraft => ({
  name: d.name.it, description: d.description ?? "", classId: d.classId, features: (d.features ?? []).map(dataToFeature),
  keep: omit(d, ["id", "name", "description", "classId", "features"]),
});
export function subclassToData(x: SubclassDraft, id: string): HbData {
  const taken = new Set<string>();
  return {
    ...x.keep, id, name: { it: str(x.name) }, description: str(x.description), classId: x.classId,
    features: x.features.filter((f) => str(f.name)).map((f) => featureToData(f, id, taken)).sort((a, b) => Number(a.level) - Number(b.level)),
  } as HbData;
}
