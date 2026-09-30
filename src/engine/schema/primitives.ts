import { z } from "zod";

// Id stabili in inglese snake_case, uguali a quelli dei PDF (es. "greatsword")
export const id = z.string().regex(/^[a-z][a-z0-9_]*$/, "id snake_case inglese");

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export const ability = z.enum(ABILITIES);
export type Ability = z.infer<typeof ability>;

export const SKILLS = [
  "acrobatics", "animal_handling", "arcana", "athletics", "deception", "history",
  "insight", "intimidation", "investigation", "medicine", "nature", "perception",
  "performance", "persuasion", "religion", "sleight_of_hand", "stealth", "survival",
] as const;
export const skill = z.enum(SKILLS);

export const armorTraining = z.enum(["light", "medium", "heavy", "shield"]);
export const senseKind = z.enum(["darkvision", "blindsight", "truesight"]);
// Dadi o numero: "1d6+1", "2d4", "3"
export const REGAIN = /^(\d+d\d+([+-]\d+)?|\d+)$/;
export const recharge = z.enum(["short_rest", "long_rest", "dawn", "none"]);
export const damageType = z.string().regex(/^[a-z_]+$/); // acid, fire, necrotic...

// Testo localizzato: l'italiano è obbligatorio, l'inglese è il riferimento stabile.
// I file in data/srd/<lingua>/ hanno una stringa semplice nella lingua del file: qui diventa { it, en } con lo stesso testo.
export const text = z.preprocess(
  (v) => (typeof v === "string" ? { it: v, en: v } : v),
  z.object({ it: z.string(), en: z.string().optional() }),
);

export const SCHEMA_VERSION = 1;
