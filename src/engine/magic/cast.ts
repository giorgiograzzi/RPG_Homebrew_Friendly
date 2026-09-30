import type { Derived } from "../compute";
import { toggleSlot, useResource } from "../play/state";
import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { spellbook } from "./spellbook";

// Lancio degli incantesimi (regole di lancio del file 04 §1):
//  - i trucchetti si lanciano a volontà; un incantesimo di 1°+ spende uno slot di livello pari o superiore (livelli superiori: si applica la voce dell'incantesimo);
//  - gli slot del Patto sono tutti dello stesso livello; i lanci gratuiti (specie, talenti, privilegi) usano il loro contatore, al livello più basso;
//  - un rituale (+10 minuti) non spende slot e non si potenzia; serve averlo preparato (il Mago: qualunque rituale del libro);
//  - una sola Concentrazione alla volta: lanciarne un'altra termina la prima.
export type CastVia = { kind: "slot"; level: number } | { kind: "pact" } | { kind: "free"; resourceId: string } | { kind: "ritual" } | { kind: "cantrip" };
export interface CastResult { ok: boolean; errors: string[]; character: Character; notes: string[]; level: number }

export function castSpell(ch: Character, rs: Ruleset, d: Derived, spellId: string, via: CastVia): CastResult {
  const fail = (e: string): CastResult => ({ ok: false, errors: [e], character: ch, notes: [], level: 0 });
  const entry = spellbook(ch, rs, d).find((e) => e.id === spellId);
  if (!entry) return fail("Incantesimo non nel tuo elenco");
  const sp = entry.spell;
  if (d.spellcastingBlocked) return fail("Non puoi lanciare incantesimi ora (armatura senza addestramento, Ira, azioni bloccate…)");
  if (d.conditions.dead) return fail("Il personaggio è morto");
  const notes: string[] = [];
  let next = ch, level = sp.level;

  switch (via.kind) {
    case "cantrip":
      if (sp.level !== 0) return fail("Non è un trucchetto");
      if (!entry.castable) return fail("Il trucchetto non è tra quelli che conosci");
      break;
    case "slot": {
      if (sp.level === 0) return fail("I trucchetti non usano slot");
      if (!entry.castable) return fail("Non è preparato: serve prepararlo per lanciarlo con uno slot");
      if (via.level < sp.level || via.level > 9) return fail(`Serve uno slot di ${sp.level}° livello o superiore`);
      const total = d.spellSlots.slots[via.level - 1] ?? 0;
      if (!total || (d.spellSlots.remaining[via.level - 1] ?? 0) <= 0) return fail(`Nessuno slot di ${via.level}° livello disponibile`);
      next = toggleSlot(ch, via.level, total, 1); level = via.level;
      notes.push("Regola 2024: in un turno puoi spendere un solo slot per lanciare un incantesimo (trucchetti e lanci gratuiti non contano)");
      break;
    }
    case "pact": {
      const p = d.spellSlots.pact;
      if (!p) return fail("Non hai slot del Patto");
      if (!entry.castable || sp.level === 0) return fail("Non si può lanciare con uno slot del Patto");
      if (p.level < sp.level) return fail(`Gli slot del Patto sono di ${p.level}° livello: l'incantesimo è di ${sp.level}°`);
      if (p.remaining <= 0) return fail("Nessuno slot del Patto rimasto");
      next = { ...ch, state: { ...ch.state, pactUsed: (ch.state.pactUsed ?? 0) + 1 } }; level = p.level;
      notes.push("Regola 2024: in un turno puoi spendere un solo slot per lanciare un incantesimo");
      break;
    }
    case "free": {
      const src = entry.sources.find((s) => s.free?.resourceId === via.resourceId);
      if (!src?.free) return fail("Lancio gratuito non disponibile");
      if (src.free.remaining <= 0) return fail("Nessun lancio gratuito rimasto");
      next = useResource(ch, via.resourceId, src.free.max, 1);
      notes.push("Lancio gratuito: al livello più basso dell'incantesimo, con la caratteristica di quella fonte");
      break;
    }
    case "ritual":
      if (!sp.ritual) return fail("Non è un rituale");
      if (!entry.ritualOk) return fail("Per lanciarlo come rituale deve essere preparato (il Mago: nel libro)");
      notes.push("Rituale: +10 minuti al tempo di lancio, nessuno slot, non si può potenziare");
      break;
  }

  if (level > sp.level && sp.higherLevels) notes.push(`Livello superiore (${level}°): ${sp.higherLevels}`);
  if (sp.components.m && (sp.components.materialCost || sp.components.material)) {
    notes.push(`Materiale: ${sp.components.material ?? "componente"}${sp.components.materialCost ? ` (${sp.components.materialCost} mo, va posseduto davvero)` : ""}${sp.components.materialConsumed ? " — si consuma col lancio" : ""}`);
  }
  if (sp.concentration) {
    const prev = ch.state.concentration;
    if (prev && prev !== sp.id) notes.unshift(`Termina la Concentrazione su ${rs.spells.get(prev)?.name.it ?? prev}`);
    next = { ...next, state: { ...next.state, concentration: sp.id } };
  }
  return { ok: true, errors: [], character: next, notes, level };
}

export function endConcentration(ch: Character): Character {
  const { concentration: _c, ...rest } = ch.state; void _c;
  return { ...ch, state: rest };
}

// Subendo danni: TS Costituzione con CD = 10 o metà del danno (il più alto), massimo 30 (file 04 §1)
export const concentrationDc = (damage: number): number => Math.min(30, Math.max(10, Math.floor(damage / 2)));

// La Concentrazione termina se sei Incapacitato o muori
export const concentrationBroken = (d: Pick<Derived, "conditions">): boolean => d.conditions.dead || d.conditions.active.includes("incapacitated");
