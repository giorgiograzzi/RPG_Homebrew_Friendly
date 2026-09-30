import { ABILITIES, type Ability } from "../schema";
import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { asiProblems, asiScores, parseAsi, type AsiPick } from "./asi";
import { validateDecisions } from "./decisions";
import { allQuestions } from "./questions";
import type { Removed } from "./types";

type Scores = Record<Ability, number>;
type Method = NonNullable<Character["creation"]>["method"];
const sorted = (a: number[]) => [...a].sort((x, y) => y - x).join();
const values = (s: Scores) => ABILITIES.map((a) => s[a]);
const rulesOf = (rs: Ruleset) => rs.creation.get("creation");

// Tiro casuale: 4d6 scartando il più basso, sei volte (i sei valori grezzi, da assegnare a mano)
export function rollAbilityScores(rng: () => number = Math.random): { rolls: number[]; dice: number[][] } {
  const dice = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(rng() * 6)));
  const rolls = dice.map((d) => { const s = [...d].sort((a, b) => a - b); return s[1]! + s[2]! + s[3]!; });
  return { rolls, dice };
}

export function pointBuyCost(rs: Ruleset, scores: Scores): { spent: number; remaining: number; errors: string[] } {
  const pb = rulesOf(rs)?.pointBuy;
  if (!pb) return { spent: 0, remaining: 0, errors: ["Regole di creazione non caricate"] };
  const errors: string[] = [];
  let spent = 0;
  for (const a of ABILITIES) {
    const c = pb.costs[String(scores[a])];
    if (c === undefined) errors.push(`${a}: con l'acquisto a punti i punteggi vanno da ${pb.min} a ${pb.max}`);
    else spent += c;
  }
  if (spent > pb.budget) errors.push(`Punti spesi: ${spent} su ${pb.budget}`);
  return { spent, remaining: pb.budget - spent, errors };
}

// Il punteggio base assegnato deve corrispondere al metodo scelto
export function scoreProblems(ch: Character, rs: Ruleset): string[] {
  const m = ch.creation?.method;
  const r = rulesOf(rs);
  if (!m) return ["Scegli un metodo per i punteggi"];
  const v = values(ch.baseScores);
  if (m === "array") return r && sorted(v) === sorted(r.standardArray) ? [] : [`Assegna i valori ${r?.standardArray.join(", ")} (uno per caratteristica)`];
  if (m === "roll") {
    const rolls = ch.creation?.rolls;
    if (!rolls || rolls.length !== 6) return ["Tira i dadi per i punteggi"];
    return sorted(v) === sorted(rolls) ? [] : [`Assegna i valori tirati: ${rolls.join(", ")}`];
  }
  if (m === "pointbuy") return pointBuyCost(rs, ch.baseScores).errors;
  return v.every((x) => x >= 1 && x <= 20) ? [] : ["I punteggi vanno da 1 a 20"];
}

export function setBaseScores(ch: Character, rs: Ruleset, method: Method, scores: Scores, rolls?: number[]): { ok: boolean; errors: string[]; character: Character; removed: Removed[] } {
  const next: Character = { ...ch, baseScores: { ...scores }, creation: { method, ...(rolls ? { rolls } : ch.creation?.rolls ? { rolls: ch.creation.rolls } : {}) } };
  const errors = scoreProblems(next, rs);
  if (errors.length) return { ok: false, errors, character: ch, removed: [] };
  // i punteggi cambiano: gli aumenti e i prerequisiti possono non essere più validi
  const v = validateDecisions(next, rs);
  return { ok: true, errors: [], character: v.character, removed: v.removed };
}

export function recommendedArray(rs: Ruleset, classId: string): Scores | undefined {
  return rulesOf(rs)?.recommendedArrays[classId] as Scores | undefined;
}

// Aumenti di caratteristica di una fonte: chiave della domanda ("background/asi" o "<scelta>/asi").
// Sostituisce quelli precedenti della stessa chiave; senza aumenti ("picks" vuoto) li toglie.
export function setAsi(ch: Character, rs: Ruleset, key: string, picks: AsiPick[]): { ok: boolean; errors: string[]; character: Character } {
  const q = allQuestions(ch, rs).find((x) => x.key === key && x.kind === "abilityIncrease");
  if (!q?.asi) return { ok: false, errors: [`Aumento di caratteristica non disponibile: ${key}`], character: ch };
  const without: Character = { ...ch, asi: ch.asi.filter((a) => a.key !== key) };
  if (!picks.length) return { ok: true, errors: [], character: without };
  // punteggi PRIMA di questo aumento, in ordine cronologico: il background per primo, poi quelli di livello (i successivi non contano)
  const qs = allQuestions(ch, rs);
  const later = new Set(qs.slice(qs.findIndex((x) => x.key === key)).filter((x) => x.kind === "abilityIncrease").map((x) => x.key));
  const chrono: Character = { ...without, asi: without.asi.filter((a) => !a.key || (key === "background/asi" ? false : a.key === "background/asi" || !later.has(a.key))) };
  const before = asiScores(chrono);
  const errors = asiProblems(q.asi, picks, before);
  if (errors.length) return { ok: false, errors, character: ch };
  const asi = [...without.asi, ...picks.map((p) => ({ source: q.owner, ability: p.ability, amount: p.amount, cap: q.asi!.cap, key }))];
  return { ok: true, errors: [], character: { ...without, asi } };
}

export { parseAsi };
