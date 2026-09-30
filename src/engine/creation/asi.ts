import { ABILITIES, type Ability } from "../schema";
import type { Character } from "../types";
import type { Question } from "./types";

export interface AsiPick { ability: Ability; amount: number }

// Aumenti di caratteristica di una fonte (spec: file 02 §3c e 03 §3a/§3e).
//  - background: +2/+1 su due delle 3 caratteristiche del background, oppure +1/+1/+1 sulle tre;
//  - Aumento dei punteggi di caratteristica: +2 a una oppure +1 a due;
//  - altri talenti: +1 a una tra quelle elencate. Tetto 20 (30 per i Doni epici).
export function asiProblems(spec: NonNullable<Question["asi"]>, picks: AsiPick[], scoresBefore: Record<Ability, number>): string[] {
  const errs: string[] = [];
  const abil = picks.map((p) => p.ability);
  if (new Set(abil).size !== abil.length) errs.push("Ogni caratteristica può ricevere un solo aumento da questa fonte");
  for (const p of picks) {
    if (!spec.allowed.includes(p.ability)) errs.push(`${p.ability}: non consentita da questa fonte`);
    if (![1, 2].includes(p.amount)) errs.push(`${p.ability}: l'aumento è +1 o +2`);
    if (scoresBefore[p.ability] + p.amount > spec.cap) errs.push(`${p.ability}: supererebbe il massimo (${spec.cap})`);
  }
  const amounts = picks.map((p) => p.amount).sort().join();
  if (spec.mode === "background" && amounts !== "1,2" && amounts !== "1,1,1") errs.push("Background: +2 a una e +1 a un'altra, oppure +1 a tutte e tre");
  if (spec.mode === "background" && amounts === "1,1,1" && new Set(abil).size !== spec.allowed.length) errs.push("Background: il +1/+1/+1 va sulle tre caratteristiche del background");
  if (spec.mode === "asi" && amounts !== "2" && amounts !== "1,1") errs.push("+2 a una caratteristica oppure +1 a due");
  if (spec.mode === "plus1" && amounts !== "1") errs.push("+1 a una delle caratteristiche elencate");
  return errs;
}

export const parseAsi = (selected: string[]): AsiPick[] => selected.map((s) => { const [a, n] = s.split("+"); return { ability: a as Ability, amount: Number(n) }; });

// Punteggi per il controllo del tetto degli aumenti: base + aumenti scelti (senza gli effetti dei privilegi, che vengono dopo
// nel tempo: es. il Campione primevo del Barbaro al 20° non deve invalidare l'aumento del background)
export function asiScores(ch: Character): Record<Ability, number> {
  const s = { ...ch.baseScores };
  for (const a of ch.asi) s[a.ability] += a.amount;
  return Object.fromEntries(ABILITIES.map((a) => [a, s[a]])) as Record<Ability, number>;
}
