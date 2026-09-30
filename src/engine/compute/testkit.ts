import { buildRuleset, type Ruleset } from "../ruleset";
import type { Character } from "../types";

const t = (it: string) => ({ it });
const feat = (id: string, effects: unknown[] = [], extra: object = {}) =>
  ({ id, name: t(id), category: "general", effects, ...extra });

// tempi indossa/togli come nei dati veri: leggera 1/1 min, media 5/1, pesante 10/5, scudo 1 azione (0/0)
const TIMES: Record<string, [number, number]> = { light: [1, 1], medium: [5, 1], heavy: [10, 5], shield: [0, 0] };
const armor = (id: string, category: string, baseAc: number, dexCap: number | null, extra: object = {}) =>
  ({ id, name: t(id), category, baseAc, dexCap, donMinutes: TIMES[category]![0], doffMinutes: TIMES[category]![1], ...extra });

const cond = (id: string, name: string, effects: object[], extra: object = {}) =>
  ({ id, name: t(name), description: `${name}: riassunto`, effects, ...extra });
// Condizioni di prova con la stessa forma dei dati veri (scritte a mano, parole nostre)
const TEST_CONDITIONS = [
  cond("poisoned", "Avvelenato", [{ type: "own_attack_rolls", mode: "disadvantage" }, { type: "own_ability_checks", mode: "disadvantage" }]),
  cond("incapacitated", "Incapacitato", [{ type: "no_actions", blocks: ["action", "bonus_action", "reaction"] }, { type: "break_concentration" }, { type: "cant_speak" }, { type: "initiative_mode", mode: "disadvantage", when: "incapacitated_when_rolling_initiative" }]),
  cond("paralyzed", "Paralizzato", [{ type: "speed_zero" }, { type: "auto_fail_saving_throw", abilities: ["str", "dex"] }, { type: "attack_rolls_against_self", mode: "advantage" }, { type: "auto_critical_hit_against_self", attackerWithinFt: 5 }], { grantsConditions: ["incapacitated"] }),
  cond("petrified", "Pietrificato", [{ type: "speed_zero" }, { type: "damage_resistance", damageTypes: "all" }, { type: "condition_immunity", conditions: ["poisoned"] }], { grantsConditions: ["incapacitated"] }),
  cond("restrained", "Trattenuto", [{ type: "speed_zero" }, { type: "own_attack_rolls", mode: "disadvantage" }, { type: "saving_throw_mode", abilities: ["dex"], mode: "disadvantage" }]),
  cond("frightened", "Spaventato", [{ type: "own_attack_rolls", mode: "disadvantage", when: "source_in_line_of_sight" }, { type: "own_ability_checks", mode: "disadvantage", when: "source_in_line_of_sight" }], { requiresSource: true }),
  cond("invisible", "Invisibile", [{ type: "initiative_mode", mode: "advantage", when: "invisible_when_rolling_initiative" }, { type: "own_attack_rolls", mode: "advantage", unless: "target_can_see_you" }]),
  cond("exhaustion", "Esaurimento", [{ type: "d20_test_modifier", formula: "-2 * exhaustion_level" }, { type: "speed_modifier", formula: "-5 * exhaustion_level" }, { type: "death_at_level", level: 6 }], { stackable: true }),
];

const sp = (id: string, level: number, school: string, classes: string[], extra: object = {}) => ({
  id, name: t(id), level, school, classes, castingTime: { unit: "action" }, range: "60 ft",
  components: { v: true, s: true, m: false }, duration: "Istantanea", resolution: "none", summary: "riassunto", ...extra,
});
// Mini catalogo di prova (parole nostre)
const TEST_SPELLS = [
  sp("spark", 0, "evocation", ["wizard", "sorcerer"]), sp("comfort", 0, "abjuration", ["cleric", "bard"]),
  sp("charm", 1, "enchantment", ["bard", "wizard"]), sp("ward", 1, "abjuration", ["cleric", "wizard"]),
  sp("omen", 1, "divination", ["cleric", "bard"], { ritual: true }), sp("bolt", 3, "evocation", ["wizard"]),
];

const wp = (id: string, category: string, kind: string, damage: string, damageType: string, properties: string[], extra: object = {}) =>
  ({ id, name: t(id), category, kind, damage, damageType, properties, mastery: "nick", weight: 3, ...extra });
const TEST_WEAPONS = [
  wp("dagger", "simple", "melee", "1d4", "piercing", ["finesse", "light", "thrown"], { range: { normal: 20, long: 60 }, weight: 1 }),
  wp("handaxe", "simple", "melee", "1d6", "slashing", ["light", "thrown"], { range: { normal: 20, long: 60 } }),
  wp("longsword", "martial", "melee", "1d8", "slashing", ["versatile"], { versatileDamage: "1d10" }),
  wp("greatsword", "martial", "melee", "2d6", "slashing", ["heavy", "two_handed"], { weight: 6 }),
  wp("rapier", "martial", "melee", "1d8", "piercing", ["finesse"]),
  wp("lance", "martial", "melee", "1d10", "piercing", ["heavy", "reach", "two_handed"], { twoHandedUnlessMounted: true }),
  wp("shortbow", "simple", "ranged", "1d6", "piercing", ["ammunition", "two_handed"], { range: { normal: 80, long: 320 }, ammunition: "arrow" }),
];

// Dati minimi in memoria (i veri dati arrivano dagli step 4-7)
export function testRuleset(): Ruleset {
  const cls = (id: string, hitDie: number, extra: object = {}) => ({
    id, name: t(id), hitDie, primaryAbility: ["str"], saves: ["str", "con"],
    skillChoices: { count: 2, from: "any" }, armorTraining: ["light", "medium", "shield"],
    weaponProficiency: ["simple", "martial"], equipment: {}, features: [], ...extra,
  });
  return buildRuleset([
    { kind: "classes", entries: [
      cls("fighter", 10, { choices: [
        { id: "fighter_skills", label: t("Abilità"), count: 2, source: "skills" },
        { id: "fighter_expertise", label: t("Maestria"), source: "expertise" }], features: [{ id: "second_wind", name: t("Recupero"), level: 1, effects: [
        { op: "resource", resourceId: "second_wind", uses: { table: Array(20).fill(2) }, recharge: "short_rest" }] }] }),
      cls("barbarian", 12, { armorTraining: ["light", "medium", "shield"], effects: [
        { op: "acFormula", formula: "10 + mod:dex + mod:con", shieldAllowed: true, when: "wearingArmor:none" },
        { op: "speedBonus", value: 10, when: "level>=5 && !wearingArmor:heavy" }] }),
      cls("monk", 8, { saves: ["str", "dex"], armorTraining: [], effects: [
        { op: "acFormula", formula: "10 + mod:dex + mod:wis", shieldAllowed: false, when: "wearingArmor:none" }] }),
      cls("wizard", 6, { saves: ["int", "wis"], armorTraining: [], spellAbility: "int" }),
      cls("cleric", 8, { spellAbility: "wis", choices: [{ id: "divine_order", label: t("Ordine"), source: "orders" }] }),
      cls("sorcerer", 6, { saves: ["con", "cha"], spellAbility: "cha", effects: [
        { op: "hpMaxPerLevel", value: 1, classId: "sorcerer" }] }),
      cls("bard", 8, { features: [{ id: "jack_of_all_trades", name: t("Factotum"), level: 2 }] }),
    ] },
    { kind: "species", entries: [
      { id: "human", name: t("Umano"), sizes: ["medium"] },
      { id: "dwarf", name: t("Nano"), sizes: ["medium"], effects: [
        { op: "hpMaxPerLevel", value: 1 }, { op: "sense", kind: "darkvision", range: 120 }, { op: "resistance", types: ["poison"] }] },
      { id: "goliath", name: t("Goliath"), sizes: ["medium"], speed: 35, traits: [
        { id: "large_form", name: t("Forma grande"), level: 5, effects: [{ op: "speedBonus", value: 10 }] }] },
    ] },
    { kind: "backgrounds", entries: [{
      id: "soldier", name: t("Soldato"), abilityOptions: ["str", "dex", "con"],
      skills: ["athletics", "intimidation"], tool: "gaming_set", feat: "savage_attacker", equipment: {},
    }] },
    { kind: "feats", entries: [
      feat("savage_attacker", [], { category: "origin" }),
      feat("alert", [{ op: "initiativeBonus", value: "pb" }], { category: "origin" }),
      feat("tough", [{ op: "hpMaxPerLevel", value: 2 }]),
      feat("medium_armor_master", []),
      feat("defense", [{ op: "acBonus", value: 1, when: "wearingArmor:any" }], { category: "fighting_style" }),
      feat("steady", [{ op: "saveAdvantage", abilities: ["str"] }, { op: "saveAdvantage", abilities: ["wis"], against: "charmed" }]),
      feat("dueling", [{ op: "damageBonus", value: 2, attackType: "melee", when: "attackType:melee && !twoHanded && !otherWeapon" }], { category: "fighting_style" }),
      feat("archery", [{ op: "attackBonus", value: 2, attackType: "ranged" }], { category: "fighting_style" }),
      feat("great_weapon_fighting", [], { category: "fighting_style" }),
      feat("two_weapon_fighting", [], { category: "fighting_style" }),
      feat("epic_boon", [{ op: "abilityScoreIncrease", abilities: ["str"], amount: 2, cap: 30 }]),
      feat("fleet", [{ op: "speedBonus", value: 10 }]),
    ] },
    { kind: "conditions", entries: TEST_CONDITIONS },
    { kind: "creation", entries: [{
      id: "creation", standardArray: [15, 14, 13, 12, 10, 8],
      pointBuy: { budget: 27, min: 8, max: 15, costs: { "8": 0, "9": 1, "10": 2, "11": 3, "12": 4, "13": 5, "14": 7, "15": 9 } },
      recommendedArrays: { fighter: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 } },
      startingLevels: [{ minLevel: 5, maxLevel: 10, gold: 500, goldDice: { sides: 10, count: 1, multiplier: 25 }, magicItems: { common: 1, uncommon: 1, rare: 0, veryRare: 0 } }],
      alignments: [{ id: "true_neutral", name: t("Neutrale") }],
      xpThresholds: [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000],
    }] },
    { kind: "weapons", entries: TEST_WEAPONS },
    { kind: "items", entries: [{ id: "arrow", name: t("Frecce (20)"), category: "ammunition", weight: 1 }, { id: "ring", name: t("Anello"), category: "gear", attunement: true }, { id: "rope", name: t("Corda"), category: "gear", weight: 5 }] },
    { kind: "spells", entries: TEST_SPELLS },
    { kind: "armors", entries: [
      armor("leather", "light", 11, null),
      armor("scale_mail", "medium", 14, 2, { stealthDisadvantage: true }),
      armor("half_plate", "medium", 15, 2, { stealthDisadvantage: true }),
      armor("chain_mail", "heavy", 16, 0, { strRequired: 13, stealthDisadvantage: true }),
      armor("plate", "heavy", 18, 0, { strRequired: 15, stealthDisadvantage: true }),
      armor("shield", "shield", 2, null),
    ] },
  ]);
}

export function testCharacter(over: Partial<Character> = {}): Character {
  return {
    schemaVersion: 1, id: "c1", name: "Test",
    classes: [{ classId: "fighter", level: 1, hpRolls: [] }],
    speciesId: "human", backgroundId: "soldier",
    baseScores: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 },
    decisions: {}, asi: [], feats: [], inventory: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    state: {
      hp: 1, tempHp: 0, hitDiceUsed: 0, deathSaves: { successes: 0, failures: 0 },
      resourcesUsed: {}, slotsUsed: {}, conditions: [], exhaustion: 0, inspiration: false,
    },
    overrides: {}, notes: "", ...over,
  };
}
