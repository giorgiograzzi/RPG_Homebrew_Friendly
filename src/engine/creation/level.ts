import { fixedHp } from "../compute/constants";
import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { validateDecisions } from "./decisions";
import type { DecisionResult } from "./types";

// Passo 0 della creazione: il livello di partenza (file 02 §6 "Partire a livello più alto"). Un personaggio creato al livello N ha i PX minimi
// del livello N e tutti i privilegi, i talenti (ASI) e le scelte dei livelli 1..N.
export const MIN_LEVEL = 1, MAX_START_LEVEL = 20;

export const xpThreshold = (rs: Ruleset, level: number): number | undefined => rs.creation.get("creation")?.xpThresholds?.[level - 1];
export const levelBand = (rs: Ruleset, level: number) => rs.creation.get("creation")?.startingLevels.find((b) => level >= b.minLevel && level <= b.maxLevel);

// Cambia il livello di partenza. Se il livello scende, le scelte dei livelli persi (e quelle non più valide) vengono annullate a cascata:
// `removed` le elenca perché l'interfaccia possa chiedere conferma prima di usare `character`.
export function setStartLevel(ch: Character, rs: Ruleset, level: number): DecisionResult {
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_START_LEVEL) return { ok: false, errors: [`Il livello va da ${MIN_LEVEL} a ${MAX_START_LEVEL}`], character: ch, removed: [] };
  const xp = xpThreshold(rs, level);
  let next: Character = { ...ch, startLevel: level, ...(xp !== undefined ? { xp } : {}) };
  // il tiro delle monete dipende dalla fascia di livello: se la fascia cambia, va rifatto
  if (levelBand(rs, level) !== levelBand(rs, ch.startLevel ?? ch.classes[0]?.level ?? 1)) { const { startingGold: _g, ...rest } = next; void _g; next = rest; }
  if (next.classes[0]) next = { ...next, classes: [{ ...next.classes[0], level, hpRolls: next.classes[0].hpRolls.slice(0, level) }, ...next.classes.slice(1)] };
  const v = validateDecisions(next, rs);
  return { ok: true, errors: [], character: v.character, removed: v.removed };
}

// PF ai livelli 2..N: valore fisso ("avg") oppure tiri del dado. Il 1° livello è sempre il massimo del dado (lo fa il calcolo).
export function setHpMode(ch: Character, rs: Ruleset, mode: "avg" | "roll", rng: () => number = Math.random): Character {
  const first = ch.classes[0];
  const def = first && rs.classes.get(first.classId);
  if (!first || !def) return ch;
  const rolls: (number | "avg")[] = Array.from({ length: first.level }, (_, i) => (i === 0 ? def.hitDie : mode === "avg" ? "avg" : 1 + Math.floor(rng() * def.hitDie)));
  return { ...ch, classes: [{ ...first, hpRolls: rolls }, ...ch.classes.slice(1)] };
}
export const hpIsRolled = (ch: Character): boolean => !!ch.classes[0]?.hpRolls.slice(1).some((r) => typeof r === "number");
export const hpPerLevelAvg = (die: number) => fixedHp(die);

// Monete della fascia di livello: mo fisse + (dado × moltiplicatore). Restituisce il totale tirato; senza il tiro valgono solo le fisse.
export function rollStartingGold(ch: Character, rs: Ruleset, rng: () => number = Math.random): Character {
  const level = ch.startLevel ?? ch.classes[0]?.level ?? 1;
  const band = levelBand(rs, level);
  if (!band) return ch;
  let gold = band.gold;
  if (band.goldDice) {
    const sum = Array.from({ length: band.goldDice.count }, () => 1 + Math.floor(rng() * band.goldDice!.sides)).reduce((a, b) => a + b, 0);
    gold += sum * band.goldDice.multiplier;
  }
  return { ...ch, startingGold: gold };
}
// Monete di partenza per il livello: quelle tirate, altrimenti solo la parte fissa
export const levelStartingGold = (ch: Character, rs: Ruleset): number => ch.startingGold ?? levelBand(rs, ch.startLevel ?? ch.classes[0]?.level ?? 1)?.gold ?? 0;
