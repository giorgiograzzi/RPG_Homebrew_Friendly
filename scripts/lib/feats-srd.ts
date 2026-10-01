// Talenti dell'SRD 5.2.1 (step 2b): elenco, categorie, prerequisiti ed effetti numerici letti dal motore.
// L'elenco e i prerequisiti sono VERIFICATI contro i due PDF da extract-origins.ts (nomi, categoria, testo del prerequisito).
// Gli effetti sono gli stessi che il motore già sa applicare (id noti: alert, archery, defense, great_weapon_fighting,
// two_weapon_fighting, ability_score_improvement, boon_of_truesight...). Le parti solo descrittive stanno in `description`.
type Json = Record<string, unknown>;
const B = (it: string, en: string) => ({ it, en });
const ALL = ["str", "dex", "con", "int", "wis", "cha"];
const pick = (id: string, label: { it: string; en: string }, source: string, count = 1): Json => ({ id, label, count, source });

export type Category = "origin" | "general" | "fighting_style" | "epic_boon";
export interface FeatDef {
  id: string; en: string; it: string; category: Category;
  prereq: string[];            // condizioni del motore
  prereqEn: string; prereqIt: string; // testo del prerequisito nei due PDF ("" se non ce n'è), per la verifica
  repeatable?: boolean; abilityIncrease?: string[];
  effects?: Json[]; choices?: Json[];
}

const FS = { prereq: ["hasFeature:fighting_style"], prereqEn: "Fighting Style Feature", prereqIt: "privilegio Stile di combattimento" };
const EPIC = { prereq: ["level>=19"], prereqEn: "Level 19+", prereqIt: "19º livello o superiore" };

export const FEATS: FeatDef[] = [
  // Origini
  { id: "alert", en: "Alert", it: "Allerta", category: "origin", prereq: [], prereqEn: "", prereqIt: "", effects: [{ op: "initiativeBonus", value: "pb" }] },
  {
    id: "magic_initiate", en: "Magic Initiate", it: "Iniziato alla magia", category: "origin", prereq: [], prereqEn: "", prereqIt: "", repeatable: true,
    choices: [
      { id: "magic_initiate_list", label: B("Lista", "Spell list"), count: 1, options: [["cleric", "Chierico", "Cleric"], ["druid", "Druido", "Druid"], ["wizard", "Mago", "Wizard"]].map(([id, it, en]) => ({ id, name: B(it!, en!) })) },
      { id: "magic_initiate_ability", label: B("Caratteristica da incantatore", "Spellcasting ability"), count: 1, options: [["int", "Intelligenza", "Intelligence"], ["wis", "Saggezza", "Wisdom"], ["cha", "Carisma", "Charisma"]].map(([id, it, en]) => ({ id, name: B(it!, en!) })) },
      { ...pick("magic_initiate_cantrips", B("Trucchetti", "Cantrips"), "cantrips", 2), abilityFrom: "magic_initiate_ability", filter: { level: 0, classFrom: "magic_initiate_list" } },
      { ...pick("magic_initiate_spell", B("Incantesimo di 1° livello", "1st-level spell"), "freespells"), abilityFrom: "magic_initiate_ability", filter: { level: 1, classFrom: "magic_initiate_list" } },
    ],
  },
  { id: "savage_attacker", en: "Savage Attacker", it: "Aggressore selvaggio", category: "origin", prereq: [], prereqEn: "", prereqIt: "" },
  { id: "skilled", en: "Skilled", it: "Abile", category: "origin", prereq: [], prereqEn: "", prereqIt: "", repeatable: true, choices: [pick("skilled_picks", B("3 abilità o strumenti", "3 skills or tools"), "skillsTools", 3)] },
  // Generali
  { id: "ability_score_improvement", en: "Ability Score Improvement", it: "Aumento dei punteggi di caratteristica", category: "general", prereq: ["level>=4"], prereqEn: "Level 4+", prereqIt: "4º livello o superiore", repeatable: true },
  { id: "grappler", en: "Grappler", it: "Lottatore", category: "general", prereq: ["level>=4", "ability:str>=13 || ability:dex>=13"], prereqEn: "Level 4+, Strength or Dexterity 13+", prereqIt: "4º livello o superiore, Forza o Destrezza 13 o superiore", abilityIncrease: ["str", "dex"] },
  // Stili di combattimento
  { id: "archery", en: "Archery", it: "Tiro", category: "fighting_style", ...FS, effects: [{ op: "attackBonus", value: 2, attackType: "ranged" }] },
  { id: "defense", en: "Defense", it: "Difesa", category: "fighting_style", ...FS, effects: [{ op: "acBonus", value: 1, when: "wearingArmor:any" }] },
  { id: "great_weapon_fighting", en: "Great Weapon Fighting", it: "Combattere con armi possenti", category: "fighting_style", ...FS },
  { id: "two_weapon_fighting", en: "Two-Weapon Fighting", it: "Combattere con due armi", category: "fighting_style", ...FS },
  // Doni epici (+1 a una caratteristica, fino a 30)
  { id: "boon_of_combat_prowess", en: "Boon of Combat Prowess", it: "Dono delle abilità di combattimento", category: "epic_boon", ...EPIC, abilityIncrease: ALL },
  { id: "boon_of_dimensional_travel", en: "Boon of Dimensional Travel", it: "Dono del viaggio dimensionale", category: "epic_boon", ...EPIC, abilityIncrease: ALL },
  { id: "boon_of_fate", en: "Boon of Fate", it: "Dono del fato", category: "epic_boon", ...EPIC, abilityIncrease: ALL },
  { id: "boon_of_irresistible_offense", en: "Boon of Irresistible Offense", it: "Dono dell'offensiva irresistibile", category: "epic_boon", ...EPIC, abilityIncrease: ["str", "dex"] },
  {
    id: "boon_of_spell_recall", en: "Boon of Spell Recall", it: "Dono del richiamo degli incantesimi", category: "epic_boon", prereq: ["level>=19", "hasFeature:spellcasting"],
    prereqEn: "Level 19+, Spellcasting Feature", prereqIt: "19º livello o superiore, privilegio Incantesimi", abilityIncrease: ["int", "wis", "cha"],
  },
  { id: "boon_of_the_night_spirit", en: "Boon of the Night Spirit", it: "Dono dello spirito notturno", category: "epic_boon", ...EPIC, abilityIncrease: ALL },
  { id: "boon_of_truesight", en: "Boon of Truesight", it: "Dono della vista pura", category: "epic_boon", ...EPIC, abilityIncrease: ALL, effects: [{ op: "sense", kind: "truesight", range: 60 }] },
];

// Quanti talenti per categoria ci sono nel PDF (verificato dall'estrattore sulle intestazioni "… Talento <categoria>")
export const FEAT_COUNTS: Record<Category, number> = { origin: 4, general: 2, fighting_style: 4, epic_boon: 7 };
