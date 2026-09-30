import type { Choice } from "./schema";
import type { Ruleset } from "./ruleset";
import type { Spell } from "./types";

type Filter = NonNullable<Choice["filter"]>;

// Incantesimi che soddisfano il filtro di una scelta (livello, scuola, rituale, liste di classe).
// `classFrom` (Iniziato alla magia) prende la lista dalla decisione già presa: se manca, nessun risultato.
export function spellsMatching(rs: Ruleset, filter: Filter | undefined, decisions: Record<string, string[]> = {}, list?: string): Spell[] {
  // `list` (source `spells:wizard`) è obbligatoria; `classes` / `classFrom` ammettono una tra più liste
  const anyOf = [...(filter?.classes ?? [])];
  if (filter?.classFrom) {
    const picked = decisions[filter.classFrom]?.[0];
    if (!picked) return [];
    anyOf.push(picked);
  }
  return [...rs.spells.values()].filter((sp) =>
    (filter?.level === undefined || sp.level === filter.level) &&
    (!filter?.schools || filter.schools.includes(sp.school)) &&
    (filter?.ritual === undefined || sp.ritual === filter.ritual) &&
    (!list || sp.classes.includes(list as never)) &&
    (anyOf.length === 0 || anyOf.some((c) => sp.classes.includes(c as never))),
  );
}

// Candidati di una scelta di incantesimi: `cantrips:<lista>` (livello 0), `spells:<lista>` (livello 1+),
// `freespells` / `alwaysspells` (tutti, ristretti dal filtro). Le altre sorgenti non sono di incantesimi.
export function spellChoiceCandidates(rs: Ruleset, choice: Choice, decisions: Record<string, string[]> = {}): Spell[] {
  if (!choice.source) return [];
  const [kind, list] = choice.source.split(":");
  if (kind === "cantrips") return spellsMatching(rs, { ...choice.filter, level: 0 }, decisions, list);
  if (kind === "spells") return spellsMatching(rs, choice.filter, decisions, list).filter((sp) => sp.level >= 1);
  if (kind === "freespells" || kind === "alwaysspells") return spellsMatching(rs, choice.filter, decisions);
  return [];
}
