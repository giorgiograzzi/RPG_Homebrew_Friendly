import type { Derived } from "../compute";
import type { Ruleset } from "../ruleset";
import type { Ability } from "../schema";
import type { Character, Spell } from "../types";

// Registro degli incantesimi del personaggio: quelli scelti nelle classi (trucchetti, preparati, libro del Mago) e quelli concessi
// da specie, talenti e privilegi (sempre preparati, a volontà, lanci gratuiti). Ogni incantesimo ha le sue fonti.
export type SourceKind = "cantrip" | "prepared" | "always" | "book" | "granted";
export interface SpellSource {
  kind: SourceKind; label: string;
  ability?: Ability; dc?: number; attack?: number;
  free?: { resourceId: string; max: number; remaining: number; recharge: string }; // lancio gratuito (senza slot)
}
export interface SpellEntry {
  id: string; spell: Spell; sources: SpellSource[];
  castable: boolean; // si può lanciare (con slot, a volontà o gratis): non solo scritto nel libro
  ritualOk: boolean; // si può lanciare come rituale (preparato, oppure nel libro del Mago)
}

const KIND_ORDER: Record<SourceKind, number> = { always: 0, prepared: 1, granted: 2, cantrip: 3, book: 4 };

export function spellbook(ch: Character, rs: Ruleset, d: Pick<Derived, "grantedSpells" | "spellcasting" | "resources">): SpellEntry[] {
  const map = new Map<string, SpellSource[]>();
  const add = (id: string, s: SpellSource) => { map.set(id, [...(map.get(id) ?? []), s]); };
  // gli incantesimi scelti in una classe compaiono anche tra i `grantSpell` (mode "known"): qui si contano una volta sola, dalla scelta
  const fromClass = new Set<string>();
  const stats = (classId: string, ability?: Ability) => {
    const c = d.spellcasting.find((x) => x.classId === classId);
    return c ? { ability: c.ability, dc: c.dc.value, attack: c.attack.value } : ability ? { ability } : {};
  };

  // scelte di incantesimi delle classi e delle sottoclassi (trucchetti, preparati, libro)
  for (const cl of ch.classes) {
    const def = rs.classes.get(cl.classId);
    if (!def) continue;
    const sub = cl.subclassId && cl.level >= def.subclassLevel ? rs.subclasses.get(cl.subclassId) : undefined;
    const holders = [{ name: def.name.it, choices: [...def.choices, ...def.features.filter((f) => f.level <= cl.level).flatMap((f) => f.choices)] },
      ...(sub ? [{ name: sub.name.it, choices: [...sub.choices, ...sub.features.filter((f) => f.level <= cl.level).flatMap((f) => f.choices)] }] : [])];
    for (const h of holders) for (const c of h.choices) {
      const kind = c.source?.split(":")[0];
      if (kind !== "cantrips" && kind !== "spells") continue;
      const picked = ch.decisions[c.id] ?? [];
      const sk: SourceKind = kind === "cantrips" ? "cantrip" : /spellbook$/.test(c.id) ? "book" : "prepared";
      for (const id of picked) { add(id, { kind: sk, label: h.name, ...stats(cl.classId) }); fromClass.add(`${h.name}|${id}`); }
    }
  }
  // concessi da specie, talenti, privilegi, sottoclassi
  for (const g of d.grantedSpells) {
    if (g.mode === "known" && [...fromClass].some((k) => { const [name, id] = k.split("|"); return id === g.spell && (g.source === name || g.source.startsWith(`${name}:`)); })) continue;
    const r = d.resources[`spell:${g.spell}`];
    add(g.spell, {
      kind: g.mode === "alwaysPrepared" ? "always" : g.mode === "cantrip" ? "cantrip" : "granted", label: g.source,
      ...(g.ability ? { ability: g.ability } : {}), ...(g.dc !== undefined ? { dc: g.dc } : {}), ...(g.attack !== undefined ? { attack: g.attack } : {}),
      ...(g.freeCast && r ? { free: { resourceId: `spell:${g.spell}`, max: r.max.value, remaining: r.remaining, recharge: r.recharge } } : {}),
    });
  }

  // incantesimi aggiunti a mano (homebrew): lanciabili con la caratteristica della prima classe che lancia incantesimi
  for (const id of ch.extraSpells ?? []) {
    const c = d.spellcasting[0];
    add(id, { kind: "granted", label: "Homebrew", ...(c ? { ability: c.ability, dc: c.dc.value, attack: c.attack.value } : {}) });
  }

  const wizard = ch.classes.some((c) => c.classId === "wizard");
  const out: SpellEntry[] = [];
  for (const [id, sources] of map) {
    const spell = rs.spells.get(id);
    if (!spell) continue;
    const s = [...sources].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    const castable = s.some((x) => x.kind !== "book");
    const inBook = s.some((x) => x.kind === "book");
    out.push({ id, spell, sources: s, castable, ritualOk: spell.ritual && (castable || (wizard && inBook)) });
  }
  return out.sort((a, b) => a.spell.level - b.spell.level || a.spell.name.it.localeCompare(b.spell.name.it, "it"));
}

// Quando si cambiano gli incantesimi preparati e quale focus serve (file 04 §1, "Preparazione degli incantesimi")
export const PREPARATION: Record<string, { when: string; focus: string }> = {
  bard: { when: "1 incantesimo a ogni livello guadagnato", focus: "Strumento musicale" },
  cleric: { when: "Lista intera a ogni Riposo Lungo", focus: "Simbolo sacro" },
  druid: { when: "Lista intera a ogni Riposo Lungo", focus: "Focus druidico" },
  paladin: { when: "1 incantesimo a ogni Riposo Lungo", focus: "Simbolo sacro" },
  ranger: { when: "1 incantesimo a ogni Riposo Lungo", focus: "Focus druidico" },
  sorcerer: { when: "1 incantesimo a ogni livello guadagnato", focus: "Focus arcano" },
  warlock: { when: "1 incantesimo a ogni livello guadagnato", focus: "Focus arcano" },
  wizard: { when: "Lista intera a ogni Riposo Lungo (dal libro); 1 con Riposo Breve dal 5° (Memorizzare)", focus: "Focus arcano" },
};
