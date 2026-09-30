import type { Ctx } from "./context";
import { evalValue } from "./formula-eval";
import type { GrantedSpell } from "./types";

// Incantesimi concessi dagli effetti attivi. La caratteristica è (in ordine) quella dell'effetto
// (fissa o da una scelta, es. spell_ability) oppure la caratteristica da incantatore della classe
// proprietaria (domini, circoli...). CD = 8 + mod + competenza; attacco = mod + competenza.
export function computeGrantedSpells(x: Ctx): GrantedSpell[] {
  const out: GrantedSpell[] = [];
  for (const { effect: e, label, classId } of x.active) {
    if (e.op !== "grantSpell") continue;
    const ability = e.ability ?? (classId ? x.rs.classes.get(classId)?.spellAbility : undefined);
    out.push({
      spell: e.spell, mode: e.mode, source: label,
      ...(ability ? { ability, dc: 8 + x.mods[ability] + x.pb, attack: x.mods[ability] + x.pb } : {}),
      ...(e.freeCast ? { freeCast: { uses: evalValue(e.freeCast.uses, x), recharge: e.freeCast.recharge } } : {}),
    });
  }
  return out;
}
