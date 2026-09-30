import type { Character } from "../types";
import type { Ruleset } from "../ruleset";
import type { Derived } from "./types";

export type CasterKind = "full" | "half" | "third";

// Livello da incantatore combinato (multiclasse, file 04 §2): livelli pieni + metà (per eccesso) di Paladino/Ranger
// + un terzo (per difetto) di Cavaliere mistico/Mistificatore arcano. Il Warlock ha slot del patto a parte.
export const casterLevelOf = (kind: CasterKind, level: number) => (kind === "full" ? level : kind === "half" ? Math.ceil(level / 2) : Math.floor(level / 3));

// Slot: con un solo incantatore vale la tabella della sua classe (o sottoclasse); con più classi si usa la tabella
// dell'incantatore completo sul livello combinato. Slot spesi da `state.slotsUsed` (chiave = livello dell'incantesimo); slot del Patto da `state.pactUsed`.
export function computeSlots(ch: Character, rs: Ruleset): Derived["spellSlots"] {
  const sources: { kind: CasterKind; level: number; own?: number[] }[] = [];
  let pact: { count: number; level: number } | undefined;
  for (const cl of ch.classes) {
    const def = rs.classes.get(cl.classId);
    if (!def) continue;
    const sub = cl.subclassId ? rs.subclasses.get(cl.subclassId) : undefined;
    if (def.caster === "pact") pact = def.pactSlots?.[cl.level - 1];
    else if (def.caster === "full" || def.caster === "half") sources.push({ kind: def.caster, level: cl.level, ...(def.spellSlots ? { own: def.spellSlots[cl.level - 1]! } : {}) });
    else if (sub?.caster === "third" && cl.level >= def.subclassLevel) sources.push({ kind: "third", level: cl.level, ...(sub.spellSlots ? { own: sub.spellSlots[cl.level - 1]! } : {}) });
  }
  const casterLevel = sources.reduce((n, s) => n + casterLevelOf(s.kind, s.level), 0);
  let slots: number[] = [];
  if (sources.length === 1) slots = sources[0]!.own ?? [];
  else if (sources.length > 1) slots = rs.slotTables.get("full_caster")?.slots[Math.min(20, casterLevel) - 1] ?? [];
  const used = slots.map((_, i) => Math.min(ch.state.slotsUsed[i + 1] ?? 0, slots[i]!));
  return { casterLevel, slots, used, remaining: slots.map((n, i) => n - used[i]!), ...(pact && pact.count > 0 ? { pact: { ...pact, used: Math.min(ch.state.pactUsed ?? 0, pact.count), remaining: pact.count - Math.min(ch.state.pactUsed ?? 0, pact.count) } } : {}) };
}
