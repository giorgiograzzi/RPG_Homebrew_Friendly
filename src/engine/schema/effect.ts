import { z } from "zod";
import { isValidCondition } from "./condition";
import { isValidFormula } from "./formula";
import { ability, armorTraining, damageType, id, recharge, REGAIN, senseKind, skill } from "./primitives";

export const condition = z.string().refine(isValidCondition, "condizione non valida");
// Valore: numero fisso oppure formula (es. "pb", "max(1, mod:wis)")
export const value = z.union([z.number(), z.string().refine(isValidFormula, "formula non valida")]);

const when = { when: condition.optional() };
const e = <T extends string, S extends z.ZodRawShape>(op: T, shape: S) =>
  z.object({ op: z.literal(op), ...when, ...shape });

// Operazioni del file "Modificatori" §6, con nomi inglesi camelCase.
// Le scelte del giocatore si referenziano con "$choiceId" al posto del valore.
export const effectSchema = z.discriminatedUnion("op", [
  e("resistance", { types: z.array(damageType).min(1) }),
  e("sense", { kind: senseKind, range: value, additive: z.boolean().default(false) }), // additive: se hai già il senso, si somma (es. "Scurovisione 60 ft o +60")
  e("setSpeed", { mode: z.enum(["walk", "fly", "swim", "climb"]).default("walk"), value }),
  e("speedBonus", { value }),
  e("hpMaxPerLevel", { value, classId: id.optional() }),
  e("hpMaxBonus", { value }),
  e("acFormula", { formula: z.string().refine(isValidFormula), shieldAllowed: z.boolean() }),
  e("acBonus", { value }),
  e("attackBonus", { value, attackType: z.enum(["melee", "ranged", "any"]).default("any") }),
  e("damageBonus", { value, attackType: z.enum(["melee", "ranged", "any"]).default("any") }),
  e("initiativeBonus", { value }),
  e("saveBonus", { value, ability: ability.optional() }),
  e("checkBonus", { value, skills: z.array(skill).optional() }),
  e("critRange", { min: z.number().int().min(2).max(20) }),
  e("unarmedDie", { die: z.union([z.string().regex(/^\d*d\d+$/), z.number()]) }),
  e("extraCantrips", { count: z.number().int().min(1) }),
  e("grantSkillProficiency", {
    skills: z.array(skill).min(1), expertise: z.boolean().default(false),
    upgradeToExpertise: z.boolean().default(false), // se sei già competente, diventa Maestria (Mente acuta, Osservatore)
  }),
  e("grantSaveProficiency", { abilities: z.array(ability).min(1) }),
  e("grantWeaponProficiency", { weapons: z.array(z.string()).min(1) }), // id o categoria
  e("grantToolProficiency", { tools: z.array(z.string()).min(1) }),
  e("grantArmorTraining", { training: z.array(armorTraining).min(1) }),
  e("saveAdvantage", { abilities: z.array(ability).optional(), against: z.string().optional() }),
  e("abilityScoreIncrease", {
    abilities: z.array(ability).min(1), amount: z.number().int(), cap: z.number().int().default(20),
  }),
  e("grantSpell", {
    spell: id, mode: z.enum(["cantrip", "alwaysPrepared", "known"]), ability: ability.optional(),
    abilityFrom: id.optional(), // id di una scelta (options di caratteristiche) che fissa la caratteristica da incantatore
    freeCast: z.object({ uses: value, recharge }).optional(),
  }),
  e("grantFeature", { feature: id }),
  e("grantFeat", { feat: id, via: z.string().optional() }), // via: id della scelta che lo concede (le sue scelte interne hanno chiave "<via>/<scelta>")
  e("grantEquipment", { item: id, qty: z.number().int().min(1).default(1) }),
  // Vincoli: prerequisiti (dell'opzione) e restrizioni (esclusioni mentre la condizione vale)
  e("prerequisite", { requires: condition, reason: z.string().optional() }),
  e("restriction", { forbids: z.string(), reason: z.string().optional() }),
  // Risorse: usi = numero, formula ("pb") o tabella per livello
  e("resource", {
    resourceId: id,
    uses: z.union([value, z.object({ table: z.array(z.number()).length(20) })]),
    recharge,
    partialShortRest: z.number().int().optional(), // usi che tornano con Riposo Breve
    regain: z.string().regex(REGAIN, "deve essere un numero o dei dadi, per esempio 2 o 1d6+1").optional(), // cariche recuperate a ogni ricarica ("1d6+1", "2"); assente = tutte. Con `regain` la ricarica è manuale (si tira)
  }),
]);
export type Effect = z.infer<typeof effectSchema>;
