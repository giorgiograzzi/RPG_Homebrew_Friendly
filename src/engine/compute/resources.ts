import { evalValue } from "./formula-eval";
import type { Ctx } from "./context";
import type { Derived } from "./types";

// Risorse con ricarica: usi = numero, formula ("pb", "mod:cha") o tabella per livello.
// La tabella usa il livello della classe proprietaria (o il totale se non di classe).
export function computeResources(x: Ctx): Derived["resources"] {
  const out: Derived["resources"] = {};
  for (const { effect: e, label, classId } of x.active) {
    if (e.op !== "resource") continue;
    const lv = classId ? x.classLevels[classId] ?? 0 : x.level;
    const raw = typeof e.uses === "object" && "table" in e.uses ? e.uses.table[Math.max(1, lv) - 1] ?? 0 : evalValue(e.uses as number | string, x);
    const max = Math.max(0, raw); // un modificatore negativo non dà usi negativi
    const prev = out[e.resourceId];
    if (prev && prev.max.value >= max) continue;
    const used = Math.min(x.ch.state.resourcesUsed[e.resourceId] ?? 0, max);
    out[e.resourceId] = {
      max: { value: max, sources: [{ label, value: max }] },
      used, remaining: max - used, recharge: e.recharge, ...(e.regain ? { regain: e.regain } : {}),
    };
  }
  // Lanci gratuiti di incantesimi (specie, talenti, privilegi): un contatore per incantesimo, id `spell:<incantesimo>`
  for (const { effect: e, label } of x.active) {
    if (e.op !== "grantSpell" || !e.freeCast) continue;
    const id = `spell:${e.spell}`;
    const max = Math.max(0, evalValue(e.freeCast.uses, x));
    if ((out[id]?.max.value ?? -1) >= max) continue;
    const used = Math.min(x.ch.state.resourcesUsed[id] ?? 0, max);
    const name = x.rs.spells.get(e.spell)?.name.it ?? e.spell;
    out[id] = { max: { value: max, sources: [{ label: `${label} — ${name}`, value: max }] }, used, remaining: max - used, recharge: e.freeCast.recharge };
  }
  return out;
}
