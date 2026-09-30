import { buildRuleset } from "../engine/ruleset";

// Provvisorio (fino allo step 3): legge solo i dati SRD in italiano; la scelta della lingua arriva con loadRuleset(lang).
// data/homebrew/ contiene pacchetti di esempio (altro formato): non sono dati di gioco.
const files = import.meta.glob("../../data/srd/it/*.json", { eager: true, import: "default" });

export const loadRuleset = () => buildRuleset(Object.values(files));

// Pacchetti homebrew di esempio (data/homebrew/*.json): si importano dalla schermata Homebrew
export const examplePacks = import.meta.glob("../../data/homebrew/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
