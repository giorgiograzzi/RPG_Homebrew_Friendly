import type { Ability } from "../engine/schema";
import it from "../i18n/it.json";

export const AB = it.wizard.abilities as Record<Ability, string>;
export const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const num = (v: string): number => { const n = Math.floor(Number(v.replace(",", "."))); return Number.isFinite(n) ? n : 0; };
