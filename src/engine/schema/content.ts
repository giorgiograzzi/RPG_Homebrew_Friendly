import { z } from "zod";
import { choiceSchema, optionSchema } from "./choice";
import { condition, effectSchema, value } from "./effect";
import {
  ability, armorTraining, damageType, id, recharge, REGAIN, SCHEMA_VERSION, skill, text,
} from "./primitives";

// Campi comuni a ogni voce dei dati
const base = {
  id,
  name: text,
  description: z.string().default(""),
  origin: z.enum(["srd", "private", "homebrew"]).default("private"),
  needsReview: z.boolean().default(false), // dubbio da verificare sul manuale (DATA_TODO.md)
  effects: z.array(effectSchema).default([]),
  choices: z.array(choiceSchema).default([]),
};

// Usi limitati di un privilegio o talento (anche solo a parole): diventa una risorsa con lo stesso id del privilegio.
// uses: numero, formula ("pb", "max(1, mod:wis)") o tabella per livello; recharge: riposo che ricarica gli usi.
export const usageSchema = z.object({
  uses: z.union([value, z.object({ table: z.array(z.number()).length(20) })]),
  recharge: z.enum(["short_rest", "long_rest", "dawn", "none"]),
  partialShortRest: z.number().int().optional(),
});
// Privilegio che si attiva (Ira, Forma selvatica...): finché è attivo valgono gli effetti con `when: "active:<id>"` e quelli
// dell'opzione scelta all'attivazione (salvata in Character.state.active). Attivare consuma un uso di `resource`.
export const activationSchema = z.object({
  resource: id.optional(), // risorsa di cui si consuma 1 uso
  requires: condition.optional(), // per poterlo attivare (Ira: non con armatura pesante)
  label: text.optional(), // nome della scelta all'attivazione ("Aspetto")
  options: z.array(optionSchema).optional(), // scelta all'attivazione: se ci sono, se ne sceglie una
  duration: z.string().optional(), // solo testo ("1 minuto")
});
const play = { usage: usageSchema.optional(), activation: activationSchema.optional() };

export const featureSchema = z.object({
  ...base, ...play, level: z.number().int().min(1).max(20).default(1),
});

export const speciesSchema = z.object({
  ...base,
  sizes: z.array(z.enum(["tiny", "small", "medium", "large"])).min(1),
  speed: z.number().int().default(30),
  traits: z.array(featureSchema).default([]), // con livello di sblocco (1/3/5)
});

// Equipaggiamento iniziale: opzione A/B/C = oggetti + monete (mo). "$tool" = lo strumento scelto.
export const equipmentSet = z.object({
  items: z.array(z.object({ item: z.string(), qty: z.number().int().min(1).default(1), note: z.string().optional() })).default([]),
  gp: z.number().default(0),
});

export const backgroundSchema = z.object({
  ...base,
  abilityOptions: z.tuple([ability, ability, ability]), // le 3 caratteristiche aumentabili
  skills: z.array(skill).length(2),
  tool: z.string(), // id, oppure gruppo a scelta: "artisan" | "gaming" | "musical"
  feat: id,
  featConfig: z.record(z.string(), z.string()).optional(), // es. { list: "cleric" } per Iniziato alla magia
  equipment: z.partialRecord(z.enum(["A", "B", "C"]), equipmentSet),
});

export const featSchema = z.object({
  ...base, ...play,
  category: z.enum(["origin", "general", "fighting_style", "epic_boon"]),
  prerequisites: z.array(condition).default([]), // condizioni, tutte da soddisfare
  repeatable: z.boolean().default(false),
  abilityIncrease: z.array(ability).optional(), // "+1 a una tra ..."
});

export const subclassSchema = z.object({
  ...base, classId: id, features: z.array(featureSchema).default([]),
  // Tabelle proprie della sottoclasse (dadi di superiorità, terzo incantatore...): 20 valori, 0/"" prima del 3° livello
  table: z.record(z.string(), z.array(z.union([z.number(), z.string()])).length(20)).default({}),
  caster: z.enum(["none", "third"]).default("none"),
  spellAbility: ability.optional(),
  spellList: id.optional(),
  spellSlots: z.array(z.array(z.number().int())).length(20).optional(),
});

export const classSchema = z.object({
  ...base,
  hitDie: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
  primaryAbility: z.array(ability),
  saves: z.tuple([ability, ability]),
  skillChoices: z.object({ count: z.number().int(), from: z.array(skill).or(z.literal("any")) }),
  armorTraining: z.array(armorTraining),
  weaponProficiency: z.array(z.string()),
  toolProficiency: z.array(z.string()).default([]), // strumenti iniziali fissi (solo 1ª classe)
  caster: z.enum(["none", "full", "half", "third", "pact"]).default("none"),
  spellAbility: ability.optional(),
  spellList: id.optional(), // lista di incantesimi della classe (es. "cleric")
  spellSlots: z.array(z.array(z.number().int())).length(20).optional(), // per livello di classe: slot di 1°, 2°, ...
  pactSlots: z.array(z.object({ count: z.number().int(), level: z.number().int() })).length(20).optional(), // Warlock
  multiclassRequirement: z.string().optional(),
  // Competenze che dà un livello in questa classe se NON è la prima (file 01, riga "Ottieni"): armi, armature, abilità e strumenti a scelta
  multiclass: z.object({
    weapons: z.array(z.string()).default([]), armor: z.array(armorTraining).default([]),
    skills: z.number().int().default(0), toolChoices: z.number().int().default(0), tools: z.array(z.string()).default([]),
  }).optional(),
  equipment: z.partialRecord(z.enum(["A", "B", "C"]), equipmentSet),
  features: z.array(featureSchema),
  // Colonne della tabella 1-20 (rages, dadi, cantrips, prepared...); 20 valori ciascuna
  table: z.record(z.string(), z.array(z.union([z.number(), z.string()])).length(20)).default({}),
  subclassLevel: z.number().int().default(3),
});

// Cariche di un oggetto magico: massimo, quando si ricaricano e quante tornano (assente = tutte; dadi o numero = si tira a mano)
export const chargesSchema = z.object({ max: z.number().int().min(1).max(99), recharge, regain: z.string().regex(REGAIN, "deve essere un numero o dei dadi, per esempio 2 o 1d6+1").optional() });
const weaponProps = z.array(z.string()); // light, finesse, heavy, thrown, versatile...
export const weaponSchema = z.object({
  ...base,
  category: z.enum(["simple", "martial"]),
  kind: z.enum(["melee", "ranged"]),
  damage: z.string().regex(/^(\d+d\d+|\d+)$/), // "1d8"; fisso "1" (Cerbottana)
  damageType,
  properties: weaponProps,
  versatileDamage: z.string().optional(),
  range: z.object({ normal: z.number(), long: z.number() }).optional(),
  mastery: id,
  ammunition: id.optional(), // id dell'oggetto munizione (frecce, quadrelli...)
  twoHandedUnlessMounted: z.boolean().default(false), // Lancia da cavaliere: a due mani solo se non in sella
  attunement: z.boolean().default(false), // arma magica che richiede sintonia
  charges: chargesSchema.optional(),
  weight: z.number().default(0),
  cost: z.number().default(0), // in monete di rame (1 mo = 100 mr)
});

export const armorSchema = z.object({
  ...base,
  category: z.enum(["light", "medium", "heavy", "shield"]),
  baseAc: z.number().int(), // scudo: bonus
  dexCap: z.number().int().nullable().default(null), // null = nessun limite (leggera); 0 = pesante
  strRequired: z.number().int().default(0),
  donMinutes: z.number().default(0), // tempo per indossare (0 = 1 azione, es. scudo)
  doffMinutes: z.number().default(0),
  stealthDisadvantage: z.boolean().default(false),
  attunement: z.boolean().default(false), // armatura magica che richiede sintonia
  charges: chargesSchema.optional(),
  weight: z.number().default(0),
  cost: z.number().default(0),
});

// Oggetto magico dell'SRD: tipo, rarità (più voci se varia con il bonus, es. +1/+2/+3; nessuna se "varia"), a chi si applica e chi può sintonizzarsi
export const magicInfoSchema = z.object({
  type: z.enum(["armor", "weapon", "wondrous", "potion", "ring", "rod", "scroll", "staff", "wand"]),
  rarity: z.array(z.object({ rarity: z.enum(["common", "uncommon", "rare", "very_rare", "legendary", "artifact"]), note: z.string().optional() })).default([]),
  varies: z.boolean().default(false), // la rarità dipende dall'esemplare (pozioni di guarigione, pergamene...)
  appliesTo: z.string().optional(), // "Qualsiasi armatura media o pesante"
  attunementBy: z.string().optional(), // sintonia riservata ("un incantatore")
});

export const itemSchema = z.object({
  ...base,
  magic: magicInfoSchema.optional(),
  category: z.string(),
  weight: z.number().default(0), // libbre (l'app mostra i kg in italiano: 1 lb = 0,5 kg come nell'SRD IT)
  cost: z.number().default(0),
  amount: z.number().int().optional(), // munizioni: pezzi per confezione (peso e costo sono della confezione)
  attunement: z.boolean().default(false),
  charges: chargesSchema.optional(),
  contents: z.array(z.object({ item: id, qty: z.number().int().min(1) })).optional(), // dotazioni
});

export const toolSchema = z.object({
  ...base,
  group: z.enum(["artisan", "other", "gaming", "musical"]),
  ability,
  weight: z.number().default(0),
  cost: z.number().default(0),
});

// Condizioni (regole dell'SRD). Gli effetti sono oggetti con `type` (vocabolario in ARCHITECTURE.md):
// il motore interpreta quelli che non dipendono da fonte o situazione, gli altri restano come testo.
export const CONDITION_EFFECT_TYPES = [
  "cant_see", "cant_hear", "cant_speak", "no_actions", "break_concentration", "unaware_of_surroundings", "concealed",
  "auto_fail_ability_check", "auto_fail_saving_throw", "saving_throw_mode", "own_ability_checks", "own_attack_rolls",
  "attack_rolls_against_self", "auto_critical_hit_against_self", "initiative_mode", "speed_zero", "speed_modifier",
  "d20_test_modifier", "death_at_level", "damage_resistance", "condition_immunity", "cant_harm_source",
  "social_advantage_for_source", "cant_move_closer_to_source", "movable_by_source", "movement_restriction",
  "drop_held_items", "remains_prone_after_end", "transformed_to_inanimate",
] as const;
export const conditionEffectSchema = z.object({
  type: z.enum(CONDITION_EFFECT_TYPES),
  mode: z.enum(["advantage", "disadvantage"]).optional(),
  when: z.string().optional(), // situazione (fonte in vista, attaccante entro 5 ft...): non calcolabile, resta testo
  unless: z.string().optional(),
  requires: z.enum(["sight", "hearing"]).optional(),
  abilities: z.array(ability).optional(),
  formula: z.string().optional(), // es. "-2 * exhaustion_level"
  level: z.number().int().optional(),
  attackerWithinFt: z.number().optional(),
  damageTypes: z.union([z.literal("all"), z.array(z.string())]).optional(),
  conditions: z.array(id).optional(),
}).catchall(z.unknown());

export const conditionDefSchema = z.object({
  id,
  name: text,
  description: z.string().default(""), // riassunto in italiano
  notes: z.string().default(""),
  origin: z.enum(["srd", "private", "homebrew"]).default("private"),
  needsReview: z.boolean().default(false),
  stackable: z.boolean().default(false), // solo Esaurimento
  requiresSource: z.boolean().default(false), // serve tracciare chi causa la condizione (Affascinato, Spaventato, Afferrato)
  grantsConditions: z.array(id).default([]), // condizioni incluse (risolte ricorsivamente)
  levels: z.object({ min: z.number().int(), max: z.number().int(), deathAt: z.number().int().optional() }).optional(),
  effects: z.array(conditionEffectSchema).default([]),
  removal: z.object({ on: z.string(), levelsRemoved: z.number().int(), endsAtLevel: z.number().int() }).optional(),
  endConditions: z.array(z.string()).default([]),
  escape: z.object({ action: z.boolean(), check: z.array(z.object({ ability, skill })), vs: z.string() }).optional(),
});

// Voce di glossario: abilità, linguaggi, taglie, danni, condizioni, proprietà, maestrie, monete
export const termSchema = z.object({
  id,
  name: text,
  description: z.string().default(""),
  origin: z.enum(["srd", "private", "homebrew"]).default("private"),
  needsReview: z.boolean().default(false),
  extra: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});

export const spellSchema = z.object({
  ...base,
  level: z.number().int().min(0).max(9),
  school: z.enum([
    "abjuration", "conjuration", "divination", "enchantment",
    "evocation", "illusion", "necromancy", "transmutation",
  ]),
  classes: z.array(id), // liste di classe (quelle ufficiali e la `spellList` delle classi homebrew)
  castingTime: z.object({
    unit: z.enum(["action", "bonus_action", "reaction", "minute", "hour"]),
    amount: z.number().default(1),
    trigger: z.string().optional(),
  }),
  range: z.string(),
  components: z.object({
    v: z.boolean(), s: z.boolean(), m: z.boolean(),
    material: z.string().optional(),
    materialCost: z.number().optional(), // in mo: blocca il lancio senza componente
    materialConsumed: z.boolean().default(false),
  }),
  duration: z.string(),
  concentration: z.boolean().default(false),
  ritual: z.boolean().default(false),
  resolution: z.enum([
    "save_str", "save_dex", "save_con", "save_int", "save_wis", "save_cha",
    "attack_melee", "attack_ranged", "none",
  ]),
  resolutionRaw: z.string().optional(), // testo originale ("TS Des / Cos", "TS vario"...) quando l'enum non basta
  summary: z.string(),
  higherLevels: z.string().optional(),
});

// Tabelle degli slot per il multiclasse (livello da incantatore combinato → slot di 1°, 2°, ...)
export const slotTableSchema = z.object({
  id, name: text, origin: z.enum(["srd", "private", "homebrew"]).default("private"),
  // righe per livello (1-20, per il terzo incantatore dal 3°): i livelli assenti hanno riga vuota
  slots: z.array(z.array(z.number().int())).length(20),
});

// Homebrew: come i dati, ma in un pacchetto .json versionato
export const homebrewPackSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  name: z.string(),
  weapons: z.array(weaponSchema).default([]),
  armors: z.array(armorSchema).default([]),
  items: z.array(itemSchema).default([]),
  feats: z.array(featSchema).default([]),
  spells: z.array(spellSchema).default([]),
  species: z.array(speciesSchema).default([]),
  backgrounds: z.array(backgroundSchema).default([]),
  classes: z.array(classSchema).default([]),
  subclasses: z.array(subclassSchema).default([]),
  languages: z.array(termSchema).default([]),
  damageTypes: z.array(termSchema).default([]),
  conditions: z.array(conditionDefSchema).default([]),
});

// Regole di creazione del personaggio (file "Regole_Creazione_Personaggio"): un solo record con id "creation"
export const creationRulesSchema = z.object({
  id,
  standardArray: z.array(z.number().int()).length(6),
  pointBuy: z.object({ budget: z.number().int(), min: z.number().int(), max: z.number().int(), costs: z.record(z.string(), z.number().int()) }),
  recommendedArrays: z.record(z.string(), z.record(ability, z.number().int())), // per classe
  // Partire a un livello più alto: monete e oggetti magici
  startingLevels: z.array(z.object({
    minLevel: z.number().int(), maxLevel: z.number().int(),
    gold: z.number().int(), // mo fisse
    goldDice: z.object({ sides: z.number().int(), count: z.number().int(), multiplier: z.number().int() }).optional(), // es. 1d10 × 25 mo
    magicItems: z.object({ common: z.number().int(), uncommon: z.number().int(), rare: z.number().int(), veryRare: z.number().int() }),
  })),
  alignments: z.array(z.object({ id, name: text })),
  xpThresholds: z.array(z.number().int()).length(20).optional(), // PX minimi per livello 1-20 (§7 del file 02)
});
