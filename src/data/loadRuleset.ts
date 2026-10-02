import { buildRuleset } from "../engine/ruleset";
import { lang as currentLang, type Lang } from "../i18n";

// Dati SRD di entrambe le lingue (stanno nel bundle e nella cache offline: si può cambiare lingua senza rete).
// data/homebrew/ contiene pacchetti di esempio (altro formato): non sono dati di gioco.
const files = import.meta.glob("../../data/srd/*/*.json", { eager: true, import: "default" });

export const filesFor = (lang: Lang): unknown[] => Object.entries(files).filter(([path]) => path.includes(`/srd/${lang}/`)).map(([, v]) => v);
export const loadRuleset = (lang: Lang = currentLang) => buildRuleset(filesFor(lang));

// Pacchetti homebrew di esempio (data/homebrew/*.json): si importano dalla schermata Homebrew
export const examplePacks = import.meta.glob("../../data/homebrew/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
