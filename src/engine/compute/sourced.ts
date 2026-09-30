import type { Sourced } from "../types";

export type Part = { label: string; value: number };

// Somma di parti con etichetta: ogni numero sa da dove viene. Le parti a zero si omettono.
export function sum(parts: Part[]): Sourced {
  const kept = parts.filter((p, i) => i === 0 || p.value !== 0);
  return { value: kept.reduce((n, p) => n + p.value, 0), sources: kept.map((p) => ({ label: p.label, value: p.value })) };
}

export const withOverride = (s: Sourced, v: number | undefined): Sourced =>
  v === undefined ? s : { value: v, sources: [{ label: "Valore forzato a mano", value: v }, ...s.sources.map((x) => ({ ...x }))] };
