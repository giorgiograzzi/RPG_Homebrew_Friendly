import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { buildCtx } from "../compute/context";
import { evalCondition } from "../compute/condition-eval";
import { parseCondition } from "../schema";
import { describeCondition } from "./describe";
import { allQuestions } from "./questions";
import { scoreProblems } from "./scores";
import { STEPS, type OptionState, type StepId } from "./types";

export interface StepStatus { step: StepId; complete: boolean; missing: string[]; problems: string[] }

// Avanzamento dei 7 passi: cosa manca in ciascuno. Il passo "punteggi" chiede metodo valido e aumenti del background.
export function creationProgress(ch: Character, rs: Ruleset): { steps: StepStatus[]; next?: StepId; complete: boolean } {
  const qs = allQuestions(ch, rs);
  const steps: StepStatus[] = STEPS.map((step) => {
    const mine = qs.filter((q) => q.step === step);
    const missing = mine.filter((q) => !q.complete && !q.disabled).map((q) => q.key);
    const problems: string[] = [];
    if (step === "scores") problems.push(...scoreProblems(ch, rs));
    if (step === "details" && !ch.name.trim()) problems.push("Dai un nome al personaggio");
    if (step === "class" && !ch.classes.length) problems.push("Scegli una classe");
    // il livello (passo 0) parte da 1: non manca mai nulla
    return { step, complete: !missing.length && !problems.length, missing, problems };
  });
  const next = steps.find((s) => !s.complete)?.step;
  return { steps, ...(next ? { next } : {}), complete: !next };
}

// Classi aggiungibili (multiclasse): serve 13 nella caratteristica richiesta SIA dalla nuova classe SIA da quelle che hai già (file 02 §8)
export function classOptions(ch: Character, rs: Ruleset): OptionState[] {
  const ctx = buildCtx(ch, rs);
  const ok = (req: string | undefined) => !req || evalCondition(parseCondition(req), ctx);
  return [...rs.classes.values()].map((c) => {
    const o: OptionState = { id: c.id, name: c.name.it, enabled: true, selected: ch.classes.some((x) => x.classId === c.id) };
    if (!ch.classes.length || o.selected) return o;
    if (!ok(c.multiclassRequirement)) return { ...o, enabled: false, disabledReason: `Richiede ${describeCondition(c.multiclassRequirement!, rs)}` };
    const blocker = ch.classes.map((x) => rs.classes.get(x.classId)).find((x) => x && !ok(x.multiclassRequirement));
    if (blocker) return { ...o, enabled: false, disabledReason: `Per lasciare ${blocker.name.it} serve ${describeCondition(blocker.multiclassRequirement!, rs)}` };
    return o;
  });
}

// Punti Ferita per livello: "media" (valore fisso) o tiro; il primo livello della prima classe è sempre il massimo. Quelli già scelti restano.
export function fillHpRolls(ch: Character, rs: Ruleset, mode: "avg" | "roll", rng: () => number = Math.random): Character {
  return {
    ...ch,
    classes: ch.classes.map((cl, ci) => {
      const die = rs.classes.get(cl.classId)?.hitDie ?? 8;
      // i PF già scelti (a un livello precedente o in una modifica) restano; si riempiono solo i livelli mancanti
      return { ...cl, hpRolls: Array.from({ length: cl.level }, (_, i) => (ci === 0 && i === 0 ? die : cl.hpRolls[i] ?? (mode === "avg" ? "avg" as const : 1 + Math.floor(rng() * die)))) };
    }),
  };
}

