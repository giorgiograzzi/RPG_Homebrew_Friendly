import type { Choice } from "../schema";
import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { holds } from "../compute/condition-eval";
import { buildCtx, type Ctx } from "../compute/context";
import { evalValue } from "../compute/formula-eval";
import type { StepId } from "./types";

// Uno slot = una scelta reale presente nei dati per questo personaggio (livelli e condizioni `when` inclusi)
export interface Slot { key: string; choice: Choice; owner: string; step: StepId; classId?: string; classLevel?: number; subclassId?: string; featId?: string }

type Holder = { name: { it: string }; choices: Choice[] };
type Base = { prefix: string; owner: string; step: StepId; classId?: string; classLevel?: number; subclassId?: string; featId?: string };

// Elenca le scelte del personaggio nell'ordine in cui vanno poste: specie, background, classi (privilegi per livello, sottoclasse),
// poi le scelte interne dei talenti concessi da una scelta ("<scelta>/<sotto-scelta>") e dei talenti già acquisiti.
export function collectSlots(ch: Character, rs: Ruleset, ctx: Ctx = buildCtx(ch, rs)): Slot[] {
  const out: Slot[] = [];
  const total = ctx.level;
  const addChoices = (h: Holder, b: Base) => {
    for (const c of h.choices) {
      if (c.when && !holds(c.when, ctx)) continue;
      const key = b.prefix + c.id;
      const step: StepId = c.source?.startsWith("languages") ? "languages" : b.step;
      out.push({ key, choice: c, owner: b.owner, step, ...(b.classId ? { classId: b.classId } : {}), ...(b.classLevel ? { classLevel: b.classLevel } : {}),
        ...(b.subclassId ? { subclassId: b.subclassId } : {}), ...(b.featId ? { featId: b.featId } : {}) });
      // talento scelto: le sue scelte interne stanno sotto la chiave di questa scelta
      if (c.source?.startsWith("feats")) for (const fid of ch.decisions[key] ?? []) {
        const f = rs.feats.get(fid);
        if (f) addChoices(f, { ...b, prefix: `${key}/`, owner: f.name.it, featId: fid });
      }
    }
  };
  const leveled = (list: { level: number; name: { it: string }; choices: Choice[] }[], lvl: number, b: Base) => {
    for (const f of list) if (f.level <= lvl) addChoices(f, { ...b, owner: `${b.owner}: ${f.name.it}` });
  };

  const sp = rs.species.get(ch.speciesId);
  if (sp) { const b: Base = { prefix: "", owner: sp.name.it, step: "species" }; addChoices(sp, b); leveled(sp.traits, total, b); }
  const bg = rs.backgrounds.get(ch.backgroundId);
  if (bg) {
    addChoices(bg, { prefix: "", owner: bg.name.it, step: "background" });
    const f = rs.feats.get(bg.feat);
    if (f) addChoices(f, { prefix: "", owner: f.name.it, step: "background", featId: f.id });
  }
  for (const [ci, cl] of ch.classes.entries()) {
    const def = rs.classes.get(cl.classId);
    if (!def) continue;
    const b: Base = { prefix: "", owner: def.name.it, step: "class", classId: cl.classId, classLevel: cl.level };
    // classe aggiunta dopo la prima (multiclasse): abilità e strumenti a scelta secondo la riga "Ottieni" (spesso nessuno)
    const mc = def.multiclass;
    const choices = ci === 0 || !mc ? def.choices : def.choices.flatMap((c) => {
      if (c.id === `${def.id}_skills`) return mc.skills > 0 ? [{ ...c, count: mc.skills }] : [];
      if (c.id.startsWith(`${def.id}_tools`)) return mc.toolChoices > 0 && c.id === `${def.id}_tools` ? [{ ...c, count: mc.toolChoices }] : [];
      return [c];
    });
    addChoices({ name: def.name, choices }, b);
    leveled(def.features, cl.level, b);
    const sub = cl.subclassId ? rs.subclasses.get(cl.subclassId) : undefined;
    if (sub && cl.level >= def.subclassLevel) {
      const sb: Base = { ...b, owner: sub.name.it, subclassId: sub.id };
      addChoices(sub, sb);
      leveled(sub.features, cl.level, sb);
    }
  }
  ch.feats.forEach((f) => { const def = rs.feats.get(f.featId); if (def) addChoices(def, { prefix: "", owner: def.name.it, step: "class", featId: f.featId }); });
  return out;
}

// Quante opzioni scegliere: numero fisso, colonna della tabella di classe/sottoclasse al livello di classe, oppure formula.
// I trucchetti contano anche gli extra (Ordine divino Taumaturgo, Mago naturale).
export function resolveCount(slot: Slot, rs: Ruleset, ctx: Ctx): number {
  const c = slot.choice;
  let n = c.count;
  if (c.countFormula) n = evalValue(c.countFormula, ctx);
  else if (c.countFrom) {
    const lv = slot.classLevel ?? ctx.level;
    const cls = slot.classId ? rs.classes.get(slot.classId) : undefined;
    const sub = slot.subclassId ? rs.subclasses.get(slot.subclassId) : undefined;
    const col = sub?.table[c.countFrom] ?? cls?.table[c.countFrom];
    n = Number(col?.[lv - 1] ?? 0);
    if (c.countFrom === "cantrips") for (const e of ctx.active) if (e.effect.op === "extraCantrips" && e.classId === slot.classId) n += e.effect.count;
  }
  return Math.max(0, n);
}
