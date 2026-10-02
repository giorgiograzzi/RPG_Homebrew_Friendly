import { fixedHp } from "../compute/constants";
import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { validateDecisions } from "./decisions";
import type { DecisionResult } from "./types";
import { tr } from "../../i18n/tr";

// Passo 0 della creazione: il livello di partenza (file 02 §6 "Partire a livello più alto"). Un personaggio creato al livello N ha i PX minimi
// del livello N e tutti i privilegi, i talenti (ASI) e le scelte dei livelli 1..N.
export const MIN_LEVEL = 1, MAX_START_LEVEL = 20;

export const xpThreshold = (rs: Ruleset, level: number): number | undefined => rs.creation.get("creation")?.xpThresholds?.[level - 1];
export const levelBand = (rs: Ruleset, level: number) => rs.creation.get("creation")?.startingLevels.find((b) => level >= b.minLevel && level <= b.maxLevel);

// Cambia il livello di partenza. Se il livello scende, le scelte dei livelli persi (e quelle non più valide) vengono annullate a cascata:
// `removed` le elenca perché l'interfaccia possa chiedere conferma prima di usare `character`.
export function setStartLevel(ch: Character, rs: Ruleset, level: number): DecisionResult {
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_START_LEVEL) return { ok: false, errors: [tr(`Il livello va da ${MIN_LEVEL} a ${MAX_START_LEVEL}`, `The level ranges from ${MIN_LEVEL} to ${MAX_START_LEVEL}`)], character: ch, removed: [] };
  const xp = xpThreshold(rs, level);
  let next: Character = { ...ch, startLevel: level, ...(xp !== undefined ? { xp } : {}) };
  // il tiro delle monete dipende dalla fascia di livello: se la fascia cambia, va rifatto
  if (levelBand(rs, level) !== levelBand(rs, ch.startLevel ?? ch.classes[0]?.level ?? 1)) { const { startingGold: _g, ...rest } = next; void _g; next = rest; }
  if (next.classes[0]) {
    // con una seconda classe i livelli si ripartiscono: la seconda tiene i suoi (al massimo livello-1), la prima il resto
    const second = next.classes[1] && level >= 2 ? { ...next.classes[1], level: Math.min(next.classes[1].level, level - 1) } : undefined;
    next = { ...next, classes: [{ ...next.classes[0], level: level - (second?.level ?? 0), hpRolls: next.classes[0].hpRolls.slice(0, level - (second?.level ?? 0)) }, ...(second ? [{ ...second, hpRolls: second.hpRolls.slice(0, second.level) }] : [])] };
  }
  const v = validateDecisions(next, rs);
  return { ok: true, errors: [], character: v.character, removed: v.removed };
}

// Seconda classe alla creazione (multiclasse): `classId` null la toglie. `level` = livelli della seconda classe; la prima ha il resto.
// I requisiti del multiclasse (13 nelle caratteristiche primarie) si controllano nel passo "Classe" di creationProgress, perché i punteggi si scelgono dopo.
export function setSecondClass(ch: Character, rs: Ruleset, classId: string | null, level = 1): DecisionResult {
  const first = ch.classes[0];
  const total = ch.startLevel ?? first?.level ?? 1;
  if (!first) return { ok: false, errors: [tr("Scegli prima la classe", "Choose the class first")], character: ch, removed: [] };
  if (!classId) {
    const next = { ...ch, classes: [{ ...first, level: total, hpRolls: first.hpRolls.slice(0, total) }] };
    const v = validateDecisions(next, rs);
    return { ok: true, errors: [], character: v.character, removed: v.removed };
  }
  if (!rs.classes.has(classId) || classId === first.classId) return { ok: false, errors: [tr("Scegli una classe diversa dalla prima", "Choose a class different from the first")], character: ch, removed: [] };
  if (total < 2) return { ok: false, errors: [tr("Servono almeno 2 livelli per due classi", "You need at least 2 levels for two classes")], character: ch, removed: [] };
  const l2 = Math.max(1, Math.min(total - 1, Math.round(level)));
  const keep = ch.classes[1]?.classId === classId ? ch.classes[1] : undefined;
  const next: Character = { ...ch, classes: [{ ...first, level: total - l2, hpRolls: first.hpRolls.slice(0, total - l2) }, { classId, level: l2, hpRolls: keep?.hpRolls.slice(0, l2) ?? [], ...(keep?.subclassId ? { subclassId: keep.subclassId } : {}) }] };
  const v = validateDecisions(next, rs);
  return { ok: true, errors: [], character: v.character, removed: v.removed };
}

// PF ai livelli 2..N: valore fisso ("avg") oppure tiri del dado. Il 1° livello è sempre il massimo del dado (lo fa il calcolo).
export function setHpMode(ch: Character, rs: Ruleset, mode: "avg" | "roll", rng: () => number = Math.random): Character {
  if (!ch.classes[0] || !rs.classes.get(ch.classes[0].classId)) return ch;
  return { ...ch, classes: ch.classes.map((cl, ci) => {
    const die = rs.classes.get(cl.classId)?.hitDie ?? 8;
    // il 1° livello della prima classe è il massimo del dado; gli altri livelli (anche della seconda classe) valore fisso o tiro
    const rolls: (number | "avg")[] = Array.from({ length: cl.level }, (_, i) => (ci === 0 && i === 0 ? die : mode === "avg" ? "avg" : 1 + Math.floor(rng() * die)));
    return { ...cl, hpRolls: rolls };
  }) };
}
export const hpIsRolled = (ch: Character): boolean => ch.classes.some((c, ci) => c.hpRolls.slice(ci === 0 ? 1 : 0).some((r) => typeof r === "number"));
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
