import type { RollMode } from "../compute/types";

export type Rng = () => number;
const die = (sides: number, rng: Rng) => 1 + Math.floor(rng() * sides);

export interface D20Roll { dice: number[]; natural: number; kept: number; total: number; mode: RollMode; crit: boolean; fumble: boolean }

// Tiro di d20 con Vantaggio (si tiene il più alto) o Svantaggio (il più basso)
export function rollD20(bonus: number, mode: RollMode = "normal", rng: Rng = Math.random): D20Roll {
  const dice = mode === "normal" ? [die(20, rng)] : [die(20, rng), die(20, rng)];
  const kept = mode === "advantage" ? Math.max(...dice) : mode === "disadvantage" ? Math.min(...dice) : dice[0]!;
  return { dice, natural: kept, kept, total: kept + bonus, mode, crit: kept === 20, fumble: kept === 1 };
}

export interface DiceRoll { rolls: number[]; bonus: number; total: number; expr: string }

// "2d6 + 3", "1d8", "d20", "5": somma di dadi e costanti (segni + e -). Null se non riconosciuta.
export function rollExpr(expr: string, rng: Rng = Math.random, opts: { crit?: boolean } = {}): DiceRoll | null {
  const terms = expr.replace(/\s+/g, "").match(/[+-]?[^+-]+/g);
  if (!terms) return null;
  const rolls: number[] = [];
  let bonus = 0;
  for (const t of terms) {
    const sign = t.startsWith("-") ? -1 : 1;
    const body = t.replace(/^[+-]/, "");
    const m = /^(\d*)d(\d+)$/i.exec(body);
    if (m) {
      const n = (m[1] ? Number(m[1]) : 1) * (opts.crit ? 2 : 1), sides = Number(m[2]);
      if (!sides || n > 100) return null;
      for (let i = 0; i < n; i++) rolls.push(sign * die(sides, rng));
    } else if (/^\d+$/.test(body)) bonus += sign * Number(body);
    else return null;
  }
  return { rolls, bonus, total: rolls.reduce((a, b) => a + b, 0) + bonus, expr };
}
