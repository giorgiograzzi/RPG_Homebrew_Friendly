import { addItem } from "../engine/equipment";
import type { HbEntry } from "../engine/homebrew";
import type { Character } from "../engine/types";

// Ha già il personaggio questa voce?
// Solo questi tipi si danno a un personaggio già creato; specie, classi ecc. si scelgono nella creazione
export const GIVE_KINDS: HbEntry["kind"][] = ["feats", "spells", "weapons", "armors", "items"];
export const canGiveKind = (e: HbEntry) => GIVE_KINDS.includes(e.kind);

export function has(ch: Character, e: HbEntry): boolean {
  const id = e.data.id;
  if (e.kind === "feats") return ch.feats.some((f) => f.featId === id);
  if (e.kind === "spells") return (ch.extraSpells ?? []).includes(id);
  return ch.inventory.some((x) => x.itemId === id);
}
export function give(ch: Character, e: HbEntry): Character {
  const id = e.data.id;
  if (e.kind === "feats") return { ...ch, feats: [...ch.feats, { featId: id }] };
  if (e.kind === "spells") return { ...ch, extraSpells: [...(ch.extraSpells ?? []), id] };
  return addItem(ch, id, 1);
}
export function take(ch: Character, e: HbEntry): Character {
  const id = e.data.id;
  if (e.kind === "feats") return { ...ch, feats: ch.feats.filter((f) => f.featId !== id) };
  if (e.kind === "spells") return { ...ch, extraSpells: (ch.extraSpells ?? []).filter((x) => x !== id), state: { ...ch.state, concentration: ch.state.concentration === id ? undefined : ch.state.concentration } };
  return { ...ch, inventory: ch.inventory.filter((x) => x.itemId !== id) };
}
