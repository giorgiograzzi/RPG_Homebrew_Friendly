import { ABILITIES, type Ability } from "../schema";
import type { Sourced } from "../types";
import type { Ctx } from "./context";
import { abilityMod } from "./formula-eval";
import { sum } from "./sourced";
import { tr } from "../../i18n/tr";

export function computeScores(x: Ctx) {
  const scores = {} as Record<Ability, Sourced>;
  const mods = {} as Record<Ability, Sourced>;
  for (const a of ABILITIES) {
    const s = sum(x.parts[a]);
    // il valore finale tiene conto del tetto (vedi finalScores): lo forziamo se differisce
    scores[a] = s.value === x.scores[a] ? s : { value: x.scores[a], sources: [...s.sources, { label: tr("Tetto massimo", "Maximum cap"), value: x.scores[a] - s.value }] };
    mods[a] = { value: abilityMod(x.scores[a]), sources: [{ label: tr(`Punteggio ${x.scores[a]}`, `Score ${x.scores[a]}`), value: abilityMod(x.scores[a]) }] };
  }
  return { scores, mods };
}
