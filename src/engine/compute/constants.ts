import type { Ability } from "../schema";
import type { Skill } from "./types";

export const SKILL_ABILITY: Record<Skill, Ability> = {
  acrobatics: "dex", animal_handling: "wis", arcana: "int", athletics: "str",
  deception: "cha", history: "int", insight: "wis", intimidation: "cha",
  investigation: "int", medicine: "wis", nature: "int", perception: "wis",
  performance: "cha", persuasion: "cha", religion: "int", sleight_of_hand: "dex",
  stealth: "dex", survival: "wis",
};

// File 02 §7: PX minimi per livello 1..20
export const XP_TABLE = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

// File 02 §5: valore fisso per Dado Vita (d6=4, d8=5, d10=6, d12=7)
export const fixedHp = (die: number) => die / 2 + 1;
