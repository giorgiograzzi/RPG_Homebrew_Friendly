import { z } from "zod";
import { ability, id } from "./primitives";

// Formato del personaggio salvato. Valida ciò che arriva da disco o da un file importato.
export const CHARACTER_SCHEMA_VERSION = 1;

const int = z.number().int();
const scores = z.object({ str: int, dex: int, con: int, int: int, wis: int, cha: int });

export const characterSchema = z.object({
  schemaVersion: int.min(1),
  id: z.string().min(1),
  name: z.string(),
  classes: z.array(z.object({
    classId: id, level: int.min(1).max(20), subclassId: id.optional(),
    hpRolls: z.array(z.union([int, z.literal("avg")])),
  })),
  speciesId: z.string(),
  backgroundId: z.string(),
  baseScores: scores,
  decisions: z.record(z.string(), z.array(z.string())),
  asi: z.array(z.object({ source: z.string(), ability, amount: int, cap: int.optional(), key: z.string().optional() })),
  feats: z.array(z.object({ featId: z.string(), choices: z.record(z.string(), z.array(z.string())).optional() })),
  inventory: z.array(z.object({
    itemId: z.string(), qty: int.min(0), state: z.enum(["stowed", "wielded", "worn", "dropped"]),
    attuned: z.boolean().optional(), grip: z.enum(["one", "two"]).optional(),
  })),
  coins: z.object({ cp: int, sp: int, ep: int, gp: int, pp: int }),
  state: z.object({
    hp: int, tempHp: int, hitDiceUsed: int,
    deathSaves: z.object({ successes: int, failures: int }),
    resourcesUsed: z.record(z.string(), int),
    slotsUsed: z.record(z.string(), int), // le chiavi (livello dell'incantesimo) in JSON sono stringhe
    conditions: z.array(z.string()), exhaustion: int, inspiration: z.boolean(),
    conditionSources: z.record(z.string(), z.string()).optional(),
    mounted: z.boolean().optional(),
    pactUsed: int.optional(), concentration: z.string().optional(),
    active: z.record(z.string(), z.array(z.string())).optional(), // privilegi attivati (Ira...): id → scelte fatte all'attivazione
  }),
  overrides: z.record(z.string(), z.number()),
  notes: z.string(),
  xp: int.min(0).optional(),
  startLevel: int.min(1).max(20).optional(), startingGold: int.min(0).optional(),
  editing: z.boolean().optional(), created: z.boolean().optional(),
  creation: z.object({ method: z.enum(["array", "roll", "pointbuy", "manual"]), rolls: z.array(int).optional() }).optional(),
  pactWeapon: z.string().optional(),
  extraSpells: z.array(z.string()).optional(),
});
