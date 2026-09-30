import type { Ruleset } from "../ruleset";
import { effectSchema, ABILITIES, SKILLS, type Effect } from "../schema";
import it from "../../i18n/it.json";

// Catalogo degli effetti predefiniti per i talenti homebrew: ogni voce è una `op` del motore con i suoi parametri.
// I parametri hanno lo stesso nome dei campi dell'effetto, così si può leggere un effetto già salvato e rimostrarlo nel modulo.
export type OptionSet = "abilities" | "skills" | "damageTypes" | "senses" | "modes" | "attackTypes" | "spells" | "spellModes";
export type ParamSpec = { key: string; label: string } & (
  | { type: "number"; def: number; min?: number; max?: number }
  | { type: "bool"; def: boolean }
  | { type: "select"; options: OptionSet; def?: string; optional?: boolean; wrap?: boolean } // wrap: nell'effetto è una lista con un solo valore
  | { type: "multi"; options: OptionSet }
);
export interface EffectPreset { op: Effect["op"]; label: string; help: string; params: ParamSpec[] }

const AB = it.wizard.abilities as Record<string, string>;
const n = (key: string, label: string, def = 1, min?: number, max?: number): ParamSpec => ({ key, label, type: "number", def, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) });
const H = it.homebrew.presets;

export const EFFECT_PRESETS: EffectPreset[] = [
  { op: "acBonus", label: H.acBonus, help: H.acBonusHelp, params: [n("value", H.bonus)] },
  { op: "initiativeBonus", label: H.initiativeBonus, help: "", params: [n("value", H.bonus)] },
  { op: "speedBonus", label: H.speedBonus, help: H.speedBonusHelp, params: [n("value", H.feet, 10)] },
  { op: "setSpeed", label: H.setSpeed, help: H.setSpeedHelp, params: [{ key: "mode", label: H.mode, type: "select", options: "modes", def: "fly" }, n("value", H.feet, 30, 0)] },
  { op: "hpMaxBonus", label: H.hpMaxBonus, help: "", params: [n("value", H.bonus, 5)] },
  { op: "hpMaxPerLevel", label: H.hpMaxPerLevel, help: H.hpMaxPerLevelHelp, params: [n("value", H.bonus)] },
  { op: "attackBonus", label: H.attackBonus, help: "", params: [n("value", H.bonus), { key: "attackType", label: H.attackType, type: "select", options: "attackTypes", def: "any" }] },
  { op: "damageBonus", label: H.damageBonus, help: "", params: [n("value", H.bonus), { key: "attackType", label: H.attackType, type: "select", options: "attackTypes", def: "any" }] },
  { op: "saveBonus", label: H.saveBonus, help: H.saveBonusHelp, params: [n("value", H.bonus), { key: "ability", label: H.ability, type: "select", options: "abilities", optional: true }] },
  { op: "checkBonus", label: H.checkBonus, help: H.checkBonusHelp, params: [n("value", H.bonus), { key: "skills", label: H.skills, type: "multi", options: "skills" }] },
  { op: "grantSkillProficiency", label: H.skillProf, help: "", params: [{ key: "skills", label: H.skills, type: "multi", options: "skills" }, { key: "expertise", label: H.expertise, type: "bool", def: false }] },
  { op: "grantSaveProficiency", label: H.saveProf, help: "", params: [{ key: "abilities", label: H.ability, type: "multi", options: "abilities" }] },
  { op: "saveAdvantage", label: H.saveAdv, help: H.saveAdvHelp, params: [{ key: "abilities", label: H.ability, type: "multi", options: "abilities" }] },
  { op: "abilityScoreIncrease", label: H.asi, help: H.asiHelp, params: [{ key: "abilities", label: H.ability, type: "select", options: "abilities", def: "str", wrap: true }, n("amount", H.bonus), n("cap", H.cap, 20, 1, 30)] },
  { op: "resistance", label: H.resistance, help: "", params: [{ key: "types", label: H.damageTypes, type: "multi", options: "damageTypes" }] },
  { op: "sense", label: H.sense, help: "", params: [{ key: "kind", label: H.senseKind, type: "select", options: "senses", def: "darkvision" }, n("range", H.feet, 60, 0)] },
  { op: "critRange", label: H.critRange, help: H.critRangeHelp, params: [n("min", H.critMin, 19, 2, 20)] },
  { op: "grantSpell", label: H.grantSpell, help: H.grantSpellHelp, params: [{ key: "spell", label: H.spell, type: "select", options: "spells" }, { key: "mode", label: H.spellMode, type: "select", options: "spellModes", def: "alwaysPrepared" }, { key: "ability", label: H.ability, type: "select", options: "abilities", optional: true }] },
];

export const presetFor = (op: string): EffectPreset | undefined => EFFECT_PRESETS.find((p) => p.op === op);

export interface Opt { id: string; label: string }
export function optionSet(set: OptionSet, rs: Ruleset): Opt[] {
  switch (set) {
    case "abilities": return ABILITIES.map((a) => ({ id: a, label: AB[a] ?? a }));
    case "skills": return SKILLS.map((s) => ({ id: s, label: rs.skills.get(s)?.name.it ?? s }));
    case "damageTypes": return [...rs.damageTypes.values()].map((d) => ({ id: d.id, label: d.name.it }));
    case "senses": return [{ id: "darkvision", label: H.senses.darkvision }, { id: "blindsight", label: H.senses.blindsight }, { id: "truesight", label: H.senses.truesight }];
    case "modes": return [{ id: "walk", label: H.modes.walk }, { id: "fly", label: H.modes.fly }, { id: "swim", label: H.modes.swim }, { id: "climb", label: H.modes.climb }];
    case "attackTypes": return [{ id: "any", label: H.attackTypes.any }, { id: "melee", label: H.attackTypes.melee }, { id: "ranged", label: H.attackTypes.ranged }];
    case "spellModes": return [{ id: "alwaysPrepared", label: H.spellModes.alwaysPrepared }, { id: "cantrip", label: H.spellModes.cantrip }, { id: "known", label: H.spellModes.known }];
    case "spells": return [...rs.spells.values()].sort((a, b) => a.level - b.level || a.name.it.localeCompare(b.name.it, "it"))
      .map((s) => ({ id: s.id, label: `${s.name.it} (${s.level === 0 ? H.cantripShort : s.level + "°"})` }));
  }
}

export type ParamValues = Record<string, string | number | boolean | string[]>;

// Valori iniziali di un nuovo effetto
export function defaultValues(p: EffectPreset, rs: Ruleset): ParamValues {
  const v: ParamValues = {};
  for (const s of p.params) {
    if (s.type === "number" || s.type === "bool") v[s.key] = s.def;
    else if (s.type === "multi") v[s.key] = [];
    else v[s.key] = s.def ?? (s.optional ? "" : optionSet(s.options, rs)[0]?.id ?? "");
  }
  return v;
}

// Modulo → effetto del motore (i campi opzionali vuoti si omettono)
export function buildEffect(p: EffectPreset, v: ParamValues): unknown {
  const e: Record<string, unknown> = { op: p.op };
  for (const s of p.params) {
    const x = v[s.key];
    if (s.type === "select") {
      if (x === "" || x === undefined) continue;
      e[s.key] = s.wrap ? [x] : x;
    } else if (s.type === "multi") {
      if (Array.isArray(x) && x.length === 0 && (p.op === "saveAdvantage")) continue; // lista vuota = tutti i TS
      e[s.key] = x;
    } else e[s.key] = x;
  }
  return e;
}

// Effetto salvato → valori del modulo (per modificarlo)
export function readEffect(e: Effect): { preset: EffectPreset; values: ParamValues } | null {
  const preset = presetFor(e.op);
  if (!preset) return null;
  const src = e as unknown as Record<string, unknown>;
  const values: ParamValues = {};
  for (const s of preset.params) {
    const x = src[s.key];
    if (s.type === "select") values[s.key] = Array.isArray(x) ? String(x[0] ?? "") : x === undefined ? (s.def ?? "") : String(x);
    else if (s.type === "multi") values[s.key] = Array.isArray(x) ? x.map(String) : [];
    else if (s.type === "bool") values[s.key] = Boolean(x);
    else values[s.key] = typeof x === "number" ? x : s.def;
  }
  return { preset, values };
}

export function validEffect(p: EffectPreset, v: ParamValues): boolean {
  return effectSchema.safeParse(buildEffect(p, v)).success;
}

// Riga di testo che descrive un effetto ("Bonus alla CA: +1")
export function describeEffect(e: Effect, rs: Ruleset): string {
  const r = readEffect(e);
  if (!r) return e.op;
  const parts = r.preset.params.map((s) => {
    const x = r.values[s.key];
    if (s.type === "number") return s.key === "value" || s.key === "amount" ? (Number(x) > 0 ? `+${x}` : String(x)) : `${s.label} ${x}`;
    if (s.type === "bool") return x ? s.label : "";
    const labels = optionSet(s.options, rs);
    const pick = (id: string) => labels.find((o) => o.id === id)?.label ?? id;
    return Array.isArray(x) ? x.map(pick).join(", ") : x ? pick(String(x)) : "";
  }).filter(Boolean);
  return `${r.preset.label}: ${parts.join(" · ")}`;
}
