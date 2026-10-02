import type { z } from "zod";
import type {
  armorSchema, backgroundSchema, classSchema, featSchema, itemSchema, speciesSchema,
  conditionDefSchema, spellSchema, subclassSchema, termSchema, toolSchema, weaponSchema,
} from "./schema";
import type { Ability } from "./schema";

export type { Effect, Choice, Option, Condition, Formula } from "./schema";
export type Species = z.infer<typeof speciesSchema>;
export type Background = z.infer<typeof backgroundSchema>;
export type ClassDef = z.infer<typeof classSchema>;
export type Subclass = z.infer<typeof subclassSchema>;
export type Feat = z.infer<typeof featSchema>;
export type Weapon = z.infer<typeof weaponSchema>;
export type Armor = z.infer<typeof armorSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Spell = z.infer<typeof spellSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type ConditionDef = z.infer<typeof conditionDefSchema>;
export type Term = z.infer<typeof termSchema>;

export type EquipState = "stowed" | "wielded" | "worn" | "dropped";

export const DETAIL_FIELDS = ["player", "age", "height", "weight", "appearance", "personality", "ideals", "bonds", "flaws", "backstory"] as const;
export type DetailField = (typeof DETAIL_FIELDS)[number];
export type CharacterDetails = Partial<Record<DetailField, string>>;

// Il personaggio salva SOLO scelte e stato di gioco; ogni numero è derivato (compute/).
export interface Character {
  schemaVersion: number;
  id: string;
  name: string;
  classes: { classId: string; level: number; subclassId?: string; hpRolls: (number | "avg")[] }[];
  speciesId: string;
  backgroundId: string;
  baseScores: Record<Ability, number>; // prima degli aumenti
  decisions: Record<string, string[]>; // choiceId → opzioni scelte (id univoci per scelta)
  asi: { source: string; ability: Ability; amount: number; cap?: number; key?: string }[]; // key: "background" oppure la scelta del talento che li dà (per sostituirli) // cap: 20 (default), 30 Doni epici // aumenti scelti (background, ASI di livello)
  feats: { featId: string; choices?: Record<string, string[]> }[];
  // grip: impugnatura a una o due mani (armi Versatili); attuned: sintonizzato (max 3)
  inventory: { itemId: string; qty: number; state: EquipState; attuned?: boolean; grip?: "one" | "two" }[];
  // Come sono stati generati i punteggi (creazione): array standard, tiro 4d6 (rolls = i 6 valori grezzi), acquisto a punti o manuale
  creation?: { method: "array" | "roll" | "pointbuy" | "manual"; rolls?: number[] };
  extraSpells?: string[]; // incantesimi aggiunti a mano (homebrew): compaiono nel libro come "concessi"
  pactWeapon?: string; // Warlock con Patto della Lama: id dell'arma del patto (usa Carisma)
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number };
  state: {
    hp: number; tempHp: number; hitDiceUsed: number;
    deathSaves: { successes: number; failures: number };
    resourcesUsed: Record<string, number>;
    slotsUsed: Record<number, number>;
    conditions: string[]; exhaustion: number; inspiration: boolean; // conditions: id (Esaurimento: livello in `exhaustion`)
    conditionSources?: Record<string, string>; // chi causa Affascinato / Spaventato / Afferrato
    mounted?: boolean; // in sella (Lancia da cavaliere)
    pactUsed?: number; // slot del Patto (Warlock) spesi
    concentration?: string; // id dell'incantesimo di cui si mantiene la Concentrazione
    active?: Record<string, string[]>; // privilegi attivati (Ira, Forma selvatica...): id → scelte fatte all'attivazione
  };
  overrides: Record<string, number>; // valori forzati a mano, visibili e rimovibili
  notes: string;
  details?: CharacterDetails; // nome del giocatore, aspetto, personalità, storia (tutti facoltativi)
  // true = creazione in corso o riaperta per modifiche (livello, scelte): la scheda giocabile non si apre; false = creazione chiusa.
  // Assente nei salvataggi vecchi: allora vale "chiusa" se la prima classe ha i PF per livello.
  startLevel?: number; // livello scelto al passo 0 della creazione (vale per la classe di partenza)
  startingGold?: number; // mo iniziali per il livello di partenza (fisse + dado), tirate al passo 0
  editing?: boolean;
  created?: boolean; // la creazione è già stata chiusa almeno una volta (equipaggiamento e monete iniziali assegnati)
  xp?: number; // punti esperienza (opzionale: molti gruppi salgono di livello a discrezione del DM)
}

// Un valore calcolato con le sue fonti ("da dove viene")
export interface Sourced<T = number> {
  value: T;
  sources: { label: string; value: number | string }[];
}
