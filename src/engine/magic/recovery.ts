import type { Derived } from "../compute";
import { useResource } from "../play/state";
import type { Character } from "../types";

// Recuperi di slot (file 04 §1, "Recupero degli slot e delle risorse magiche")
export interface Recovery { ok: boolean; errors: string[]; character: Character }
const fail = (ch: Character, e: string): Recovery => ({ ok: false, errors: [e], character: ch });

// Recupero arcano (Mago 1°) e Recupero naturale (Circolo della Terra 6°): slot per un totale di livelli ≤ metà del livello di classe
// (per eccesso), nessuno slot di 6° o più. 1 volta per Riposo Lungo, dopo un Riposo Breve.
export function recoverSlots(ch: Character, d: Pick<Derived, "spellSlots" | "resources">, resourceId: "arcane_recovery" | "natural_recovery", classLevel: number, levels: number[]): Recovery {
  const r = d.resources[resourceId];
  if (!r || r.remaining <= 0) return fail(ch, "Nessun uso rimasto fino al prossimo Riposo Lungo");
  if (!levels.length) return fail(ch, "Scegli gli slot da recuperare");
  const limit = Math.ceil(classLevel / 2);
  const total = levels.reduce((n, l) => n + l, 0);
  if (levels.some((l) => l < 1 || l > 5)) return fail(ch, "Solo slot fino al 5° livello");
  if (total > limit) return fail(ch, `Il totale dei livelli è ${total}: il massimo è ${limit} (metà del livello di classe, per eccesso)`);
  const used = { ...ch.state.slotsUsed };
  for (const l of levels) {
    const have = used[l] ?? 0;
    const asked = levels.filter((x) => x === l).length;
    if (asked > have) return fail(ch, `Non hai abbastanza slot di ${l}° livello spesi`);
  }
  for (const l of levels) { used[l] = (used[l] ?? 0) - 1; if (used[l] === 0) delete used[l]; }
  return { ok: true, errors: [], character: useResource({ ...ch, state: { ...ch.state, slotsUsed: used } }, resourceId, r.max.value, 1) };
}
export const recoveryLimit = (classLevel: number) => Math.ceil(classLevel / 2);

// Astuzia magica (Warlock 2°): rito di 1 minuto, 1 volta per Riposo Lungo: recupera metà degli slot del Patto (per eccesso); al 20° tutti
export function magicalCunning(ch: Character, d: Pick<Derived, "spellSlots" | "resources">, warlockLevel: number): Recovery {
  const r = d.resources.magical_cunning;
  const p = d.spellSlots.pact;
  if (!r || r.remaining <= 0) return fail(ch, "Nessun uso rimasto fino al prossimo Riposo Lungo");
  if (!p || p.used <= 0) return fail(ch, "Non hai slot del Patto spesi");
  const back = warlockLevel >= 20 ? p.used : Math.min(p.used, Math.ceil(p.count / 2));
  const c: Character = { ...ch, state: { ...ch.state, pactUsed: p.used - back || undefined } };
  return { ok: true, errors: [], character: useResource(c, "magical_cunning", r.max.value, 1) };
}
