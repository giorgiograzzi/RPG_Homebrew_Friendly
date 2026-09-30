import { useSyncExternalStore } from "react";
import { extendRuleset, type Ruleset } from "../engine/ruleset";
import { loadRuleset } from "./loadRuleset";

// Ruleset dell'app = dati di gioco + homebrew attivo. Si ricostruisce (senza rileggere i dati base) quando l'homebrew cambia.
let base: Ruleset | null = null;
let cached: Ruleset | null = null;
let homebrewFiles: unknown[] = [];
let version = 0;
const listeners = new Set<() => void>();

export const getRuleset = (): Ruleset => {
  base ??= loadRuleset();
  return (cached ??= homebrewFiles.length ? extendRuleset(base, homebrewFiles) : base);
};
// Chiamata dallo store quando l'homebrew cambia: i componenti che usano useRuleset si aggiornano
export function setHomebrewFiles(files: unknown[]) {
  homebrewFiles = files; cached = null; version++;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useRuleset = (): Ruleset => { useSyncExternalStore(subscribe, () => version); return getRuleset(); };
