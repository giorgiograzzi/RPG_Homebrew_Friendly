import type { Derived } from "../compute/types";
import type { Character } from "../types";
import { applyHealing } from "./hp";

// Dadi Vita spesi: il contatore è uno solo (`hitDiceUsed`); si spendono partendo dal dado più grande
export function hitDiceList(d: Pick<Derived, "hp">): number[] {
  return [...d.hp.hitDice].sort((a, b) => b.die - a.die).flatMap((x) => Array<number>(x.total).fill(x.die));
}
export const nextHitDie = (ch: Character, d: Pick<Derived, "hp">): number | undefined => hitDiceList(d)[ch.state.hitDiceUsed];

// Riposo breve: spendi un Dado Vita, tiri il dado e recuperi PF pari al tiro + mod Cos (minimo 0)
export function spendHitDie(ch: Character, d: Pick<Derived, "hp" | "mods">, roll: number): { character: Character; healed: number } | null {
  if (!nextHitDie(ch, d)) return null;
  const healed = Math.max(0, roll + d.mods.con.value);
  const spent: Character = { ...ch, state: { ...ch.state, hitDiceUsed: ch.state.hitDiceUsed + 1 } };
  return { character: applyHealing(spent, d.hp.max.value, healed), healed };
}

// Un riposo termina gli stati attivi (Ira, Forma selvatica...), la Concentrazione e ripristina gli slot del Patto
const noActive = (s: Character["state"]): Character["state"] => { const { active: _a, concentration: _c, pactUsed: _p, ...rest } = s; void _a; void _c; void _p; return rest; };
const without = <T,>(o: Record<string, T>, keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const rechargeOn = (d: Pick<Derived, "resources">, when: string[]) => Object.entries(d.resources).filter(([, r]) => !r.regain && when.includes(r.recharge)).map(([id]) => id);

// Riposo breve: si ricaricano le risorse "short_rest" e gli slot del Patto (Warlock)
export function shortRest(ch: Character, d: Pick<Derived, "resources" | "spellSlots">): Character {
  // gli slot del Patto (Warlock) tornano con un riposo breve; gli altri slot solo con il lungo
  return { ...ch, state: { ...noActive(ch.state), resourcesUsed: without(ch.state.resourcesUsed, rechargeOn(d, ["short_rest"])), pactUsed: undefined } };
}

// Riposo lungo: PF al massimo, PF temporanei a zero, metà dei Dadi Vita (minimo 1), tutte le risorse e gli slot,
// -1 livello di Esaurimento, salvezze contro morte azzerate, via lo stato di privo di sensi da 0 PF
export function longRest(ch: Character, d: Pick<Derived, "hp" | "resources">): Character {
  const total = d.hp.hitDice.reduce((n, x) => n + x.total, 0);
  const restored = Math.max(1, Math.floor(total / 2));
  const src = { ...(ch.state.conditionSources ?? {}) };
  const wasDown = src.unconscious === "0 PF";
  if (wasDown) delete src.unconscious;
  return {
    ...ch,
    state: {
      ...noActive(ch.state), hp: d.hp.max.value, tempHp: 0, hitDiceUsed: Math.max(0, ch.state.hitDiceUsed - restored),
      resourcesUsed: without(ch.state.resourcesUsed, rechargeOn(d, ["short_rest", "long_rest", "dawn"])), slotsUsed: {},
      exhaustion: Math.max(0, ch.state.exhaustion - 1), deathSaves: { successes: 0, failures: 0 },
      conditions: wasDown ? ch.state.conditions.filter((c) => c !== "unconscious") : ch.state.conditions, conditionSources: src,
    },
  };
}
