import { ABILITIES, type Ability, type Choice } from "../schema";
import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { buildCtx } from "../compute/context";
import { lookupItem } from "../equipment/loadout";
import { asiProblems, asiScores, parseAsi } from "./asi";
import { optionStates } from "./options";
import { collectSlots, resolveCount, type Slot } from "./slots";
import { STEPS, type OptionState, type Question, type StepId } from "./types";

const AB_IT: Record<Ability, string> = { str: "Forza", dex: "Destrezza", con: "Costituzione", int: "Intelligenza", wis: "Saggezza", cha: "Carisma" };
// Le voci homebrew si riconoscono nell'elenco dalla dicitura accanto al nome
const badge = (d: { name: { it: string }; origin?: string }) => (d.origin === "homebrew" ? `${d.name.it} · Homebrew` : d.name.it);
const stepIndex = (s: StepId) => STEPS.indexOf(s);
const mkChoice = (id: string, label: string, count: number, source: string): Choice => ({ id, label: { it: label }, count, source, distinct: true });

interface Draft { q: Omit<Question, "options" | "complete" | "selected">; slot?: Slot; fixedOptions?: (ch: Character) => OptionState[]; selectedFrom?: (ch: Character) => string[]; asiKey?: string }

const equipmentName = (rs: Ruleset, set: { items: { item: string; qty: number }[]; gp: number }) =>
  [...set.items.map((i) => `${i.qty > 1 ? `${i.qty}× ` : ""}${i.item.startsWith("$") ? "strumento a scelta" : lookupItem(rs, i.item)?.def.name.it ?? i.item}`), ...(set.gp ? [`${set.gp} mo`] : [])].join(", ");

// Tutte le domande di creazione del personaggio, nell'ordine ufficiale dei passi. Le opzioni di ciascuna tengono conto solo di
// ciò che viene PRIMA (dati fissi e domande precedenti): due scelte in conflitto si risolvono a favore della prima.
export function allQuestions(ch: Character, rs: Ruleset): Question[] {
  const ctx = buildCtx(ch, rs);
  const slots = collectSlots(ch, rs, ctx);
  const drafts: Draft[] = [];
  const first = ch.classes[0];

  // -- classe e sottoclasse
  drafts.push({ q: { key: "pick:class", step: "class", owner: "Classe", label: "Classe", kind: "choice", count: 1 },
    fixedOptions: () => [...rs.classes.values()].map((c) => ({ id: c.id, name: badge(c), enabled: true, selected: false })), selectedFrom: () => (first ? [first.classId] : []) });
  for (const cl of ch.classes) {
    const def = rs.classes.get(cl.classId);
    if (def && cl.level >= def.subclassLevel) drafts.push({
      q: { key: `subclass:${cl.classId}`, step: "class", owner: def.name.it, label: "Sottoclasse", kind: "choice", count: 1, classId: cl.classId },
      fixedOptions: () => [...rs.subclasses.values()].filter((s) => s.classId === cl.classId).map((s) => ({ id: s.id, name: badge(s), enabled: true, selected: false })),
      selectedFrom: () => (cl.subclassId ? [cl.subclassId] : []),
    });
  }
  const bySteps = (step: StepId) => slots.filter((s) => s.step === step);
  const addSlots = (step: StepId) => {
    for (const s of bySteps(step)) {
      const n = resolveCount(s, rs, ctx);
      if (n === 0) continue;
      drafts.push({ q: { key: s.key, step, owner: s.owner, label: s.choice.label.it, kind: "choice", count: n, choice: s.choice,
        ...(s.choice.group ? { group: s.choice.group } : {}), ...(s.classId ? { classId: s.classId } : {}) }, slot: s });
      // aumento di caratteristica del talento scelto
      if (s.choice.source?.startsWith("feats")) for (const fid of ch.decisions[s.key] ?? []) {
        const f = rs.feats.get(fid);
        if (f && (f.abilityIncrease || f.id === "ability_score_improvement")) {
          const all = f.id === "ability_score_improvement";
          drafts.push({ q: { key: `${s.key}/asi`, step, owner: f.name.it, label: "Aumento di caratteristica", kind: "abilityIncrease", count: all ? 2 : 1,
            asi: { allowed: all ? [...ABILITIES] : f.abilityIncrease!, mode: all ? "asi" : "plus1", cap: f.category === "epic_boon" ? 30 : 20 } }, asiKey: `${s.key}/asi` });
        }
      }
    }
  };
  addSlots("class");

  // -- origine
  drafts.push({ q: { key: "pick:background", step: "background", owner: "Background", label: "Background", kind: "choice", count: 1 },
    fixedOptions: () => [...rs.backgrounds.values()].map((b) => ({ id: b.id, name: badge(b), enabled: true, selected: false })), selectedFrom: () => (ch.backgroundId ? [ch.backgroundId] : []) });
  const bg = rs.backgrounds.get(ch.backgroundId);
  if (bg) drafts.push({ q: { key: "background/asi", step: "background", owner: bg.name.it, label: "Aumenti di caratteristica (+2/+1 oppure +1/+1/+1)", kind: "abilityIncrease", count: 3,
    asi: { allowed: [...bg.abilityOptions], mode: "background", cap: 20 } }, asiKey: "background/asi" });
  addSlots("background");
  drafts.push({ q: { key: "pick:species", step: "species", owner: "Specie", label: "Specie", kind: "choice", count: 1 },
    fixedOptions: () => [...rs.species.values()].map((s) => ({ id: s.id, name: badge(s), enabled: true, selected: false })), selectedFrom: () => (ch.speciesId ? [ch.speciesId] : []) });
  addSlots("species");

  // -- linguaggi: Comune + 2 a scelta (i rari solo se una regola li concede), poi quelli dei privilegi
  drafts.push({ q: { key: "languages", step: "languages", owner: "Linguaggi", label: "Linguaggi (oltre al Comune)", kind: "choice", count: 2, choice: mkChoice("languages", "Linguaggi", 2, "languages:standard") },
    slot: { key: "languages", choice: mkChoice("languages", "Linguaggi", 2, "languages:standard"), owner: "Linguaggi", step: "languages" } });
  addSlots("languages");

  // -- allineamento e dettagli
  const rules = rs.creation.get("creation");
  drafts.push({ q: { key: "alignment", step: "alignment", owner: "Allineamento", label: "Allineamento", kind: "choice", count: 1 },
    fixedOptions: () => (rules?.alignments ?? []).map((a) => ({ id: a.id, name: a.name.it, enabled: true, selected: false })) });
  addSlots("details");
  const cdef = first && rs.classes.get(first.classId);
  if (cdef) drafts.push({ q: { key: "equipment:class", step: "details", owner: cdef.name.it, label: "Equipaggiamento di classe", kind: "choice", count: 1, classId: cdef.id },
    fixedOptions: () => Object.entries(cdef.equipment).map(([k, set]) => ({ id: k, name: `${k}: ${equipmentName(rs, set!)}`, enabled: true, selected: false })) });
  if (bg) drafts.push({ q: { key: "equipment:background", step: "details", owner: bg.name.it, label: "Equipaggiamento del background", kind: "choice", count: 1 },
    fixedOptions: () => Object.entries(bg.equipment).map(([k, set]) => ({ id: k, name: `${k}: ${equipmentName(rs, set!)}`, enabled: true, selected: false })) });

  // ordine per passo (stabile)
  drafts.sort((a, b) => stepIndex(a.q.step) - stepIndex(b.q.step));
  // il libro degli incantesimi (Mago) si sceglie prima degli incantesimi da preparare, che escono dal libro
  for (const book of drafts.filter((d) => d.q.key.endsWith("_spellbook"))) {
    const prep = drafts.findIndex((d) => d.q.key === book.q.key.replace(/_spellbook$/, "_prepared"));
    const at = drafts.indexOf(book);
    if (prep >= 0 && at > prep) { drafts.splice(at, 1); drafts.splice(prep, 0, book); }
  }

  // -- valutazione in ordine
  const asiOf = (c: Character, key: string) => c.asi.filter((a) => a.key === key).map((a) => `${a.ability}+${a.amount}`);
  const selectedOf = (d: Draft): string[] => d.selectedFrom ? d.selectedFrom(ch) : d.asiKey ? asiOf(ch, d.asiKey) : ch.decisions[d.q.key] ?? [];
  const out: Question[] = [];
  drafts.forEach((d, i) => {
    // personaggio senza le decisioni di questa domanda e delle successive
    const later = drafts.slice(i).map((x) => x.q.key);
    const stripped: Character = {
      ...ch, decisions: Object.fromEntries(Object.entries(ch.decisions).filter(([k]) => !later.some((l) => k === l || k.startsWith(`${l}/`)))),
      // cronologia degli aumenti: il background viene per primo (si applica alla creazione), poi quelli di livello in ordine.
      // Le altre domande lo contano sempre; il background stesso non conta nessun aumento di livello.
      asi: ch.asi.filter((a) => !a.key || (a.key === "background/asi" ? d.asiKey !== "background/asi"
        : d.asiKey !== "background/asi" && !drafts.slice(i).some((x) => x.asiKey === a.key))),
    };
    const selected = selectedOf(d);
    let options: OptionState[];
    let asiOk = true;
    if (d.q.kind === "abilityIncrease") {
      const sc = asiScores(stripped);
      // gli aumenti scelti devono rispettare le regole della fonte (caratteristiche ammesse, forma +2/+1, tetto)
      asiOk = selected.length > 0 && asiProblems(d.q.asi!, parseAsi(selected), sc).length === 0;
      const cap = d.q.asi!.cap;
      options = ABILITIES.map((a) => {
        const base: OptionState = { id: a, name: AB_IT[a], enabled: true, selected: selected.some((s) => s.startsWith(`${a}+`)) };
        if (!d.q.asi!.allowed.includes(a)) return { ...base, enabled: false, disabledReason: "Non consentita da questa fonte" };
        if (sc[a] + 1 > cap) return { ...base, enabled: false, disabledReason: `Supererebbe il massimo (${cap})` };
        return base;
      });
    } else if (d.fixedOptions) options = d.fixedOptions(stripped).map((o) => ({ ...o, selected: selected.includes(o.id) }));
    else options = optionStates(d.slot!, stripped, rs, selected);
    const valid = d.q.kind === "abilityIncrease"
      ? asiOk
      : selected.length === d.q.count && selected.every((s) => options.find((o) => o.id === s)?.enabled);
    out.push({ ...d.q, selected, options, complete: valid });
  });

  // scelte alternative (gruppo): se ne è già stata fatta una, le altre sono disattivate
  for (const q of out) {
    if (!q.group || q.selected.length) continue;
    const other = out.find((o) => o !== q && o.group === q.group && o.selected.length > 0);
    if (other) { q.disabled = true; q.disabledReason = `Hai già scelto: ${other.label}`; q.complete = true; }
  }
  return out;
}

// Domande di un passo, con le opzioni attive/disattivate e il motivo del blocco
export function availableOptions(stepId: StepId, ch: Character, rs: Ruleset): Question[] {
  return allQuestions(ch, rs).filter((q) => q.step === stepId);
}
