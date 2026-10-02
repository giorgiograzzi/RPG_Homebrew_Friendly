import type { Derived } from "../compute";
import { toggleSlot, useResource } from "../play/state";
import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { spellbook } from "./spellbook";
import { tr } from "../../i18n/tr";

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
  if (!entry) return fail(tr("Incantesimo non nel tuo elenco", "Spell not in your list"));
  const sp = entry.spell;
  if (d.spellcastingBlocked) return fail(tr("Non puoi lanciare incantesimi ora (armatura senza addestramento, Ira, azioni bloccate…)", "You can't cast spells right now (untrained armor, Rage, blocked actions…)"));
  if (d.conditions.dead) return fail(tr("Il personaggio è morto", "The character is dead"));
  const notes: string[] = [];
  let next = ch, level = sp.level;

  switch (via.kind) {
    case "cantrip":
      if (sp.level !== 0) return fail(tr("Non è un trucchetto", "Not a cantrip"));
      if (!entry.castable) return fail(tr("Il trucchetto non è tra quelli che conosci", "That cantrip is not one you know"));
      break;
    case "slot": {
      if (sp.level === 0) return fail(tr("I trucchetti non usano slot", "Cantrips do not use slots"));
      if (!entry.castable) return fail(tr("Non è preparato: serve prepararlo per lanciarlo con uno slot", "Not prepared: prepare it to cast it with a slot"));
      if (via.level < sp.level || via.level > 9) return fail(tr(`Serve uno slot di ${sp.level}° livello o superiore`, `You need a level ${sp.level} slot or higher`));
      const total = d.spellSlots.slots[via.level - 1] ?? 0;
      if (!total || (d.spellSlots.remaining[via.level - 1] ?? 0) <= 0) return fail(tr(`Nessuno slot di ${via.level}° livello disponibile`, `No level ${via.level} slot available`));
      next = toggleSlot(ch, via.level, total, 1); level = via.level;
      notes.push(tr("Regola: in un turno puoi spendere un solo slot per lanciare un incantesimo (trucchetti e lanci gratuiti non contano)", "Rule: on a turn you can spend only one slot to cast a spell (cantrips and free casts do not count)"));
      break;
    }
    case "pact": {
      const p = d.spellSlots.pact;
      if (!p) return fail(tr("Non hai slot del Patto", "You have no Pact slots"));
      if (!entry.castable || sp.level === 0) return fail(tr("Non si può lanciare con uno slot del Patto", "It can't be cast with a Pact slot"));
      if (p.level < sp.level) return fail(tr(`Gli slot del Patto sono di ${p.level}° livello: l'incantesimo è di ${sp.level}°`, `Pact slots are level ${p.level}: the spell is level ${sp.level}`));
      if (p.remaining <= 0) return fail(tr("Nessuno slot del Patto rimasto", "No Pact slots left"));
      next = { ...ch, state: { ...ch.state, pactUsed: (ch.state.pactUsed ?? 0) + 1 } }; level = p.level;
      notes.push(tr("Regola: in un turno puoi spendere un solo slot per lanciare un incantesimo", "Rule: on a turn you can spend only one slot to cast a spell"));
      break;
    }
    case "free": {
      const src = entry.sources.find((s) => s.free?.resourceId === via.resourceId);
      if (!src?.free) return fail(tr("Lancio gratuito non disponibile", "Free cast not available"));
      if (src.free.remaining <= 0) return fail(tr("Nessun lancio gratuito rimasto", "No free casts left"));
      next = useResource(ch, via.resourceId, src.free.max, 1);
      notes.push(tr("Lancio gratuito: al livello più basso dell'incantesimo, con la caratteristica di quella fonte", "Free cast: at the spell's lowest level, using that source's ability"));
      break;
    }
    case "ritual":
      if (!sp.ritual) return fail(tr("Non è un rituale", "Not a ritual"));
      if (!entry.ritualOk) return fail(tr("Per lanciarlo come rituale deve essere preparato (il Mago: nel libro)", "To cast it as a ritual it must be prepared (Wizard: in the spellbook)"));
      notes.push(tr("Rituale: +10 minuti al tempo di lancio, nessuno slot, non si può potenziare", "Ritual: +10 minutes casting time, no slot, can't be upcast"));
      break;
  }

  if (level > sp.level && sp.higherLevels) notes.push(tr(`Livello superiore (${level}°): ${sp.higherLevels}`, `Higher level (${level}): ${sp.higherLevels}`));
  if (sp.components.m && (sp.components.materialCost || sp.components.material)) {
    notes.push(`Materiale: ${sp.components.material ?? "componente"}${sp.components.materialCost ? ` (${sp.components.materialCost} mo, va posseduto davvero)` : ""}${sp.components.materialConsumed ? " — si consuma col lancio" : ""}`);
  }
  if (sp.concentration) {
    const prev = ch.state.concentration;
    if (prev && prev !== sp.id) notes.unshift(tr(`Termina la Concentrazione su ${rs.spells.get(prev)?.name.it ?? prev}`, `Ends Concentration on ${rs.spells.get(prev)?.name.it ?? prev}`));
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
