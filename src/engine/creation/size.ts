import type { Ruleset } from "../ruleset";
import type { Character } from "../types";

// Taglia del personaggio: se la specie ne ammette più di una (Umano, Tiefling: Media o Piccola) vale quella scelta, altrimenti l'unica.
export const SIZE_KEY = "size";
export function characterSize(ch: Character, rs: Ruleset): string | undefined {
  const sizes = rs.species.get(ch.speciesId)?.sizes ?? [];
  const picked = ch.decisions[SIZE_KEY]?.[0];
  return picked && sizes.includes(picked as never) ? picked : sizes[0];
}
