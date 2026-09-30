import { CHARACTER_SCHEMA_VERSION } from "./schema";
import type { Character } from "./types";

// Personaggio vuoto di partenza per la creazione (nessuna classe, specie o background scelti)
export function emptyCharacter(id: string): Character {
  return {
    schemaVersion: CHARACTER_SCHEMA_VERSION, id, name: "", classes: [], speciesId: "", backgroundId: "",
    baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    decisions: {}, asi: [], feats: [], inventory: [], coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    state: { hp: 0, tempHp: 0, hitDiceUsed: 0, deathSaves: { successes: 0, failures: 0 }, resourcesUsed: {}, slotsUsed: {}, conditions: [], exhaustion: 0, inspiration: false },
    overrides: {}, notes: "", editing: true,
  };
}
