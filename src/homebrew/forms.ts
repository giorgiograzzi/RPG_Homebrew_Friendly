import type { HbData, HbKind, Opt } from "../engine/homebrew";
import type { ComplexKind } from "./complex";
import type { Ruleset } from "../engine/ruleset";
import it from "../i18n/it.json";

const F = it.homebrew.f;
const O = it.homebrew.opts;
const fromMap = (m: Record<string, string>): Opt[] => Object.entries(m).map(([id, label]) => ({ id, label }));

// Un campo del modulo. Il modulo tiene tutto come testo/liste/booleani (`Draft`) e lo converte in dati solo al salvataggio.
export type Draft = Record<string, string | boolean | string[]>;
export interface FieldSpec {
  key: string; label: string; help?: string;
  type: "text" | "long" | "number" | "select" | "multi" | "bool";
  options?: (rs: Ruleset) => Opt[];
  show?: (d: Draft) => boolean;
}

const f = (key: string, label: string, type: FieldSpec["type"], extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, type, ...extra });
const terms = (m: Map<string, { id: string; name: { it: string } }>) => [...m.values()].map((x) => ({ id: x.id, label: x.name.it }));

// Cariche degli oggetti magici (armi, armature, oggetti): massimo, quando si ricaricano, quante tornano
const CHARGE_FIELDS: FieldSpec[] = [
  f("chargesMax", F.chargesMax, "number", { help: F.chargesMaxHelp }),
  f("chargesRecharge", F.chargesRecharge, "select", { options: () => fromMap(it.homebrew.cx.rechargeOpts), show: (d) => num(d.chargesMax) > 0 }),
  f("chargesRegain", F.chargesRegain, "text", { help: F.chargesRegainHelp, show: (d) => num(d.chargesMax) > 0 && d.chargesRecharge !== "none" }),
];
const CHARGES_DRAFT = { chargesMax: "", chargesRecharge: "dawn", chargesRegain: "" };

export type FlatKind = Exclude<HbKind, ComplexKind>;
export const FIELDS: Record<FlatKind, FieldSpec[]> = {
  weapons: [
    f("name", F.name, "text"), f("description", F.description, "long"),
    f("category", F.weaponCategory, "select", { options: () => fromMap(O.weaponCategory) }),
    f("wkind", F.weaponKind, "select", { options: () => fromMap(O.weaponKind) }),
    f("damage", F.damage, "text", { help: F.damageHelp }),
    f("damageType", F.damageType, "select", { options: (rs) => terms(rs.damageTypes) }),
    f("properties", F.properties, "multi", { options: (rs) => terms(rs.weaponProperties) }),
    f("versatileDamage", F.versatile, "text", { help: F.versatileHelp }),
    f("rangeNormal", F.rangeNormal, "number"), f("rangeLong", F.rangeLong, "number"),
    f("mastery", F.mastery, "select", { options: (rs) => terms(rs.masteries) }),
    f("attunement", F.attunement, "bool"), ...CHARGE_FIELDS,
    f("weight", F.weight, "number"), f("costGp", F.cost, "number", { help: F.costHelp }),
  ],
  armors: [
    f("name", F.name, "text"), f("description", F.description, "long"),
    f("category", F.armorCategory, "select", { options: () => fromMap(O.armorCategory) }),
    f("baseAc", F.baseAc, "number", { help: F.baseAcHelp }),
    f("dexCap", F.dexCap, "number", { help: F.dexCapHelp }),
    f("strRequired", F.strRequired, "number"), f("donMinutes", F.donMinutes, "number"),
    f("stealthDisadvantage", F.stealth, "bool"), f("attunement", F.attunement, "bool"), ...CHARGE_FIELDS,
    f("weight", F.weight, "number"), f("costGp", F.cost, "number", { help: F.costHelp }),
  ],
  items: [
    f("name", F.name, "text"), f("description", F.description, "long"),
    f("category", F.itemCategory, "text", { help: F.itemCategoryHelp }),
    f("attunement", F.attunement, "bool"), ...CHARGE_FIELDS,
    f("weight", F.weight, "number"), f("costGp", F.cost, "number", { help: F.costHelp }),
  ],
  feats: [
    f("name", F.name, "text"), f("description", F.description, "long"),
    f("category", F.featCategory, "select", { options: () => fromMap(O.featCategory) }),
    f("minLevel", F.minLevel, "number"),
    f("repeatable", F.repeatable, "bool"),
  ],
  spells: [
    f("name", F.name, "text"), f("description", F.description, "long"),
    f("level", F.level, "select", { options: () => Array.from({ length: 10 }, (_, i) => ({ id: String(i), label: i === 0 ? it.homebrew.presets.cantripShort : `${i}°` })) }),
    f("school", F.school, "select", { options: () => fromMap(O.school) }),
    f("classes", F.classes, "multi", { help: F.classesHelp, options: (rs) => [...fromMap(O.classes), ...[...rs.classes.values()].filter((c) => c.origin === "homebrew" && c.caster !== "none").map((c) => ({ id: c.spellList ?? c.id, label: `${c.name.it} · Homebrew` }))] }),
    f("castUnit", F.castUnit, "select", { options: () => fromMap(O.castUnit) }), f("castAmount", F.castAmount, "number"),
    f("range", F.range, "text", { help: F.rangeHelp }),
    f("comp", F.components, "multi", { options: () => fromMap(O.components) }),
    f("material", F.material, "text", { show: (d) => (d.comp as string[]).includes("m") }),
    f("duration", F.duration, "text"),
    f("concentration", F.concentration, "bool"), f("ritual", F.ritual, "bool"),
    f("resolution", F.resolution, "select", { options: () => fromMap(O.resolution) }),
    f("summary", F.summary, "text", { help: F.summaryHelp }),
    f("higherLevels", F.higher, "long"),
  ],
  languages: [
    f("name", F.name, "text"), f("description", F.description, "long"),
    f("rarity", F.rarity, "select", { options: () => fromMap(O.rarity), help: F.rarityHelp }),
  ],
  damageTypes: [f("name", F.name, "text"), f("description", F.description, "long")],
  conditions: [
    f("name", F.name, "text"), f("description", F.description, "long", { help: F.conditionHelp }),
    f("requiresSource", F.requiresSource, "bool"),
  ],
};

export const emptyDraft = (kind: FlatKind): Draft => {
  switch (kind) {
    case "weapons": return { name: "", description: "", category: "simple", wkind: "melee", damage: "1d6", damageType: "slashing", properties: [], versatileDamage: "", rangeNormal: "", rangeLong: "", mastery: "", attunement: false, ...CHARGES_DRAFT, weight: "0", costGp: "0" };
    case "armors": return { name: "", description: "", category: "light", baseAc: "11", dexCap: "", strRequired: "0", donMinutes: "1", stealthDisadvantage: false, attunement: false, ...CHARGES_DRAFT, weight: "0", costGp: "0" };
    case "items": return { name: "", description: "", category: "Oggetto magico", attunement: false, ...CHARGES_DRAFT, weight: "0", costGp: "0" };
    case "feats": return { name: "", description: "", category: "general", minLevel: "", repeatable: false };
    case "languages": return { name: "", description: "", rarity: "standard" };
    case "damageTypes": return { name: "", description: "" };
    case "conditions": return { name: "", description: "", requiresSource: false };
    case "spells": return { name: "", description: "", level: "1", school: "evocation", classes: [], castUnit: "action", castAmount: "1", range: "Personale", comp: ["v", "s"], material: "", duration: "Istantanea", concentration: false, ritual: false, resolution: "none", summary: "", higherLevels: "" };
  }
};

const num = (s: unknown): number => Number(String(s ?? "").replace(",", "."));
const optNum = (s: unknown): number | undefined => (String(s ?? "").trim() === "" ? undefined : num(s));
const cp = (s: unknown): number => Math.round(num(s) * 100);
const str = (s: unknown) => String(s ?? "").trim();
// Cariche dal modulo: assenti se il massimo è vuoto o 0; senza ricarica non c'è "quante tornano"
const chargesOf = (d: Draft) => {
  const max = Math.floor(num(d.chargesMax));
  if (!(max > 0)) return {};
  const regain = d.chargesRecharge === "none" ? "" : str(d.chargesRegain);
  return { charges: { max, recharge: d.chargesRecharge, ...(regain ? { regain } : {}) } };
};
const opt = <T,>(k: string, v: T | undefined) => (v === undefined || v === "" ? {} : { [k]: v });

// Modulo → dati (da validare con lo schema). `id` e `effects` arrivano da fuori.
export function draftToData(kind: FlatKind, d: Draft, id: string, effects: unknown[] = []): HbData {
  const base = { id, name: { it: str(d.name) }, description: str(d.description) };
  switch (kind) {
    case "weapons": {
      const n = optNum(d.rangeNormal), l = optNum(d.rangeLong);
      return { ...base, category: d.category, kind: d.wkind, damage: str(d.damage), damageType: d.damageType, properties: d.properties,
        ...opt("versatileDamage", str(d.versatileDamage)), ...(n !== undefined ? { range: { normal: n, long: l ?? n } } : {}),
        mastery: d.mastery, attunement: d.attunement, ...chargesOf(d), weight: num(d.weight), cost: cp(d.costGp), effects } as HbData;
    }
    case "armors": {
      const cap = optNum(d.dexCap);
      return { ...base, category: d.category, baseAc: num(d.baseAc), dexCap: cap ?? null, strRequired: num(d.strRequired), donMinutes: num(d.donMinutes),
        stealthDisadvantage: d.stealthDisadvantage, attunement: d.attunement, ...chargesOf(d), weight: num(d.weight), cost: cp(d.costGp), effects } as HbData;
    }
    case "items": return { ...base, category: str(d.category), attunement: d.attunement, ...chargesOf(d), weight: num(d.weight), cost: cp(d.costGp), effects } as HbData;
    case "feats": {
      const lv = optNum(d.minLevel);
      return { ...base, category: d.category, prerequisites: lv ? [`level>=${lv}`] : [], repeatable: d.repeatable, effects } as HbData;
    }
    case "languages": return { ...base, extra: { rarity: str(d.rarity) || "standard" } } as HbData;
    case "damageTypes": return { ...base } as HbData;
    case "conditions": return { ...base, requiresSource: d.requiresSource } as HbData;
    case "spells": {
      const comp = d.comp as string[];
      return { ...base, level: num(d.level), school: d.school, classes: d.classes,
        castingTime: { unit: d.castUnit, amount: num(d.castAmount) || 1 },
        range: str(d.range),
        components: { v: comp.includes("v"), s: comp.includes("s"), m: comp.includes("m"), ...(comp.includes("m") && str(d.material) ? { material: str(d.material) } : {}) },
        duration: str(d.duration), concentration: d.concentration, ritual: d.ritual, resolution: d.resolution, summary: str(d.summary),
        ...opt("higherLevels", str(d.higherLevels)) } as HbData;
    }
  }
}

// Dati salvati → modulo (per modificare)
export function dataToDraft(kind: FlatKind, x: HbData): Draft {
  const d = x as Record<string, any>;
  const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));
  const gp = (v: unknown) => String(Number(v ?? 0) / 100);
  const common = { name: x.name.it, description: s(d.description) };
  const chargesDraft = (o: Record<string, any>) => (o.charges ? { chargesMax: s(o.charges.max), chargesRecharge: o.charges.recharge ?? "dawn", chargesRegain: s(o.charges.regain) } : CHARGES_DRAFT);
  switch (kind) {
    case "weapons": return { ...common, category: d.category, wkind: d.kind, damage: d.damage, damageType: d.damageType, properties: d.properties ?? [], versatileDamage: s(d.versatileDamage),
      rangeNormal: s(d.range?.normal), rangeLong: s(d.range?.long), mastery: d.mastery, attunement: !!d.attunement, ...chargesDraft(d), weight: s(d.weight), costGp: gp(d.cost) };
    case "armors": return { ...common, category: d.category, baseAc: s(d.baseAc), dexCap: d.dexCap === null ? "" : s(d.dexCap), strRequired: s(d.strRequired), donMinutes: s(d.donMinutes),
      stealthDisadvantage: !!d.stealthDisadvantage, attunement: !!d.attunement, ...chargesDraft(d), weight: s(d.weight), costGp: gp(d.cost) };
    case "items": return { ...common, category: s(d.category), attunement: !!d.attunement, ...chargesDraft(d), weight: s(d.weight), costGp: gp(d.cost) };
    case "feats": return { ...common, category: d.category, minLevel: s(((d.prerequisites ?? []) as string[]).map((p) => /^level>=(\d+)$/.exec(p)?.[1]).find(Boolean)), repeatable: !!d.repeatable };
    case "languages": return { ...common, rarity: s(d.extra?.rarity) || "standard" };
    case "damageTypes": return { ...common };
    case "conditions": return { ...common, requiresSource: !!d.requiresSource };
    case "spells": return { ...common, level: s(d.level), school: d.school, classes: d.classes ?? [], castUnit: d.castingTime?.unit ?? "action", castAmount: s(d.castingTime?.amount ?? 1),
      range: s(d.range), comp: [d.components?.v && "v", d.components?.s && "s", d.components?.m && "m"].filter(Boolean) as string[], material: s(d.components?.material),
      duration: s(d.duration), concentration: !!d.concentration, ritual: !!d.ritual, resolution: d.resolution ?? "none", summary: s(d.summary), higherLevels: s(d.higherLevels) };
  }
}

// Valori che dipendono dai dati di gioco (la prima scelta disponibile) quando il modulo è nuovo
export function withDefaults(kind: FlatKind, d: Draft, rs: Ruleset): Draft {
  if (kind === "weapons" && !d.mastery) return { ...d, mastery: [...rs.masteries.keys()][0] ?? "" };
  return d;
}
