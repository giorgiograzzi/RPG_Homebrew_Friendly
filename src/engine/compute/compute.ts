import type { Character } from "../types";
import type { Ruleset } from "../ruleset";
import { computeScores } from "./abilities";
import { computeAc } from "./ac";
import { applyConditionSpeed, resolveConditions } from "./conditions";
import { buildCtx } from "./context";
import { evalValue } from "./formula-eval";
import { computeHp } from "./hp";
import { computeProfs } from "./proficiencies";
import { computeResources } from "./resources";
import { computeGrantedSpells } from "./spells";
import { computeSlots } from "./slots";
import { attacksPerAction, computeAttacks } from "./attacks";
import { analyzeLoadout } from "../equipment/loadout";
import { computeRolls, untrainedArmor } from "./rolls";
import { sum, withOverride } from "./sourced";
import { computeResistances, computeSenses, computeSpeed } from "./speed";
import type { Derived } from "./types";

// Valori forzati a mano (Character.overrides): ac, hp.max, initiative, speed.walk, passivePerception
export function computeCharacter(ch: Character, rs: Ruleset): Derived {
  const x = buildCtx(ch, rs);
  const profs = computeProfs(x);
  const notes: string[] = [];
  const warnings: string[] = [];
  const { scores, mods } = computeScores(x);
  const cs = resolveConditions(x.ch, x.rs);
  const { saves, skills } = computeRolls(x, profs, notes, cs);

  const initiative = sum([
    { label: "Mod Des", value: x.mods.dex },
    ...(cs.d20Penalty ? [{ label: "Esaurimento", value: cs.d20Penalty }] : []),
    ...x.active.flatMap(({ effect: e, label }) => (e.op === "initiativeBonus" ? [{ label, value: evalValue(e.value, x) }] : [])),
  ]);
  const perc = skills.perception;
  const percMode = perc.mode;
  const passive = sum([
    { label: "Base", value: 10 },
    { label: "Percezione", value: perc.bonus.value - cs.d20Penalty }, // la Percezione passiva non è un Tiro D20: niente Esaurimento
    { label: percMode === "advantage" ? "Vantaggio" : "Svantaggio", value: percMode === "advantage" ? 5 : percMode === "disadvantage" ? -5 : 0 },
  ]);

  const ac = computeAc(x, profs, warnings);
  const speed = applyConditionSpeed(computeSpeed(x), cs);
  const hp = computeHp(x);
  const o = ch.overrides;
  const spellcasting = ch.classes.flatMap((c) => {
    const cdef = rs.classes.get(c.classId);
    const sdef = c.subclassId && cdef && c.level >= cdef.subclassLevel ? rs.subclasses.get(c.subclassId) : undefined;
    const ability = cdef?.spellAbility ?? (sdef?.caster === "third" ? sdef.spellAbility : undefined);
    if (!ability) return [];
    const m = x.mods[ability];
    return [{
      classId: c.classId, ability,
      dc: sum([{ label: "Base", value: 8 }, { label: `Mod ${ability}`, value: m }, { label: "Competenza", value: x.pb }]),
      attack: sum([{ label: `Mod ${ability}`, value: m }, { label: "Competenza", value: x.pb }]),
    }];
  });

  return {
    level: x.level,
    proficiencyBonus: { value: x.pb, sources: [{ label: `Livello totale ${x.level}`, value: x.pb }] },
    scores, mods, saves, skills,
    initiative: withOverride(initiative, o.initiative),
    passivePerception: withOverride(passive, o.passivePerception),
    hp: { ...hp, max: withOverride(hp.max, o["hp.max"]) },
    ac: { ...withOverride(ac, o.ac), formula: ac.formula },
    speed: { ...speed, walk: withOverride(speed.walk, o["speed.walk"]) },
    senses: computeSenses(x),
    resistances: cs.resistAll.length ? [...new Set([...computeResistances(x), "all"])].sort() : computeResistances(x),
    resources: computeResources(x),
    spellcasting,
    grantedSpells: computeGrantedSpells(x),
    spellSlots: computeSlots(ch, rs),
    attacksPerAction: attacksPerAction(x),
    attacks: computeAttacks(x, profs, cs, untrainedArmor(x, profs)),
    loadout: (() => {
      const l = analyzeLoadout(ch, rs);
      return { handsUsed: l.handsUsed, handsMax: l.handsMax, ...(l.body ? { body: l.body.name.it } : {}), ...(l.shield ? { shield: l.shield.name.it } : {}),
        attuned: l.attuned, weight: l.weight, capacity: x.scores.str * 15, problems: l.problems };
    })(),
    carryCapacity: x.scores.str * 15,
    proficiencies: { weapons: [...profs.weapons], tools: [...profs.tools], armor: [...profs.armor] },
    languages: [...x.collected.languages],
    features: [...x.collected.features].sort(),
    feats: [...x.collected.feats].sort(),
    featureList: x.collected.info.map((f) => ({ ...f, active: !!ch.state.active?.[f.id], picked: ch.state.active?.[f.id] ?? [] })),
    notes, warnings,
    // niente incantesimi: armatura senza addestramento, azioni bloccate, o uno stato attivo che li vieta (Ira)
    spellcastingBlocked: untrainedArmor(x, profs) || cs.cannot.includes("compiere azione")
      || x.active.some(({ effect: e }) => e.op === "restriction" && e.forbids === "spellcasting"),
    conditions: cs,
  };
}
