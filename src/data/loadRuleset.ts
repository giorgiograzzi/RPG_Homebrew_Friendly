import { buildRuleset } from "../engine/ruleset";

// Legge tutti i JSON in /data (srd, private). Se una cartella è vuota o assente (es. private/ su un clone pubblico)
// la lista è semplicemente più corta. data/homebrew/ contiene pacchetti di esempio (altro formato): non sono dati di gioco.
const files = import.meta.glob(["../../data/**/*.json", "!../../data/homebrew/**"], { eager: true, import: "default" });

export const loadRuleset = () => buildRuleset(Object.values(files));

// Pacchetti homebrew di esempio (data/homebrew/*.json): si importano dalla schermata Homebrew
export const examplePacks = import.meta.glob("../../data/homebrew/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
