import type { Ability } from "../schema";
import { ABILITIES } from "../schema";
import type { Armor, Character, Weapon } from "../types";
import type { Ruleset } from "../ruleset";
import { holds, type CondCtx } from "./condition-eval";
import { collectEffects, type Collected, type Entry } from "./collect";
import { abilityMod, type FormulaCtx } from "./formula-eval";
import { tr } from "../../i18n/tr";

export const proficiencyByLevel = (lvl: number) => 2 + Math.floor((Math.max(1, lvl) - 1) / 4);

// Tutto ciò che serve per valutare formule e condizioni, con punteggi già calcolati
export interface Ctx extends CondCtx, FormulaCtx {
  ch: Character;
  rs: Ruleset;
  collected: Collected;
  active: Entry[]; // effetti la cui condizione `when` è vera
  mods: Record<Ability, number>;
  parts: Record<Ability, { label: string; value: number }[]>; // fonti dei punteggi
}

export function classLevelsOf(ch: Character): Record<string, number> {
  const r: Record<string, number> = {};
  for (const c of ch.classes) r[c.classId] = (r[c.classId] ?? 0) + c.level;
  return r;
}

// Armatura e scudo indossati (stato `worn` nell'inventario)
export function wornGear(ch: Character, rs: Ruleset) {
  let body: Armor | undefined, shield: Armor | undefined;
  const equipped = new Set<string>();
  for (const it of ch.inventory) {
    if (it.state !== "worn" && it.state !== "wielded") continue;
    equipped.add(it.itemId);
    const a = rs.armors.get(it.itemId);
    if (a) {
      equipped.add(a.category);
      if (a.category === "shield") shield = a; else body = a;
    }
    const w = rs.weapons.get(it.itemId);
    if (w) { equipped.add(w.category); equipped.add(w.kind); }
  }
  return { body, shield, equipped };
}

// Punteggi finali = base + aumenti scelti + effetti abilityScoreIncrease, con tetto.
// Le condizioni degli aumenti si valutano sui punteggi base (evita circolarità).
export function finalScores(ch: Character, collected: Collected, cond: CondCtx) {
  const cap: Record<string, number> = {};
  const parts: Ctx["parts"] = { str: [], dex: [], con: [], int: [], wis: [], cha: [] };
  for (const a of ABILITIES) parts[a].push({ label: tr("Base", "Base"), value: ch.baseScores[a] });
  for (const s of ch.asi) {
    parts[s.ability].push({ label: s.source, value: s.amount });
    cap[s.ability] = Math.max(cap[s.ability] ?? 20, s.cap ?? 20);
  }
  for (const { effect, label } of collected.entries) {
    if (effect.op !== "abilityScoreIncrease" || !holds(effect.when, cond)) continue;
    for (const a of effect.abilities) {
      parts[a].push({ label, value: effect.amount });
      cap[a] = Math.max(cap[a] ?? 20, effect.cap);
    }
  }
  const scores = {} as Record<Ability, number>;
  for (const a of ABILITIES) {
    const sum = parts[a].reduce((n, p) => n + p.value, 0);
    // Un base già oltre il tetto non si riduce: il tetto vale sugli aumenti
    scores[a] = Math.max(ch.baseScores[a], Math.min(sum, cap[a] ?? 20));
  }
  return { scores, parts };
}

// weapon + hand: contesto di un attacco (arma considerata, impugnata a due mani?, altra arma nell'altra mano?)
export function buildCtx(ch: Character, rs: Ruleset, weapon?: Weapon, hand?: { twoHanded?: boolean; otherWeapon?: boolean; ability?: Ability }): Ctx {
  const totalLevel = ch.classes.reduce((n, c) => n + c.level, 0);
  const classLevels = classLevelsOf(ch);
  const collected = collectEffects(ch, rs);
  const gear = wornGear(ch, rs);
  const base: CondCtx = {
    totalLevel, classLevels, scores: ch.baseScores, equipped: gear.equipped,
    features: collected.features, feats: collected.feats, activeStates: ch.state.active ?? {},
    ...(hand?.ability ? { attackAbility: hand.ability } : {}),
    classSaves: new Set(ch.classes[0] ? rs.classes.get(ch.classes[0].classId)?.saves ?? [] : []),
    ...(gear.body ? { bodyArmor: gear.body } : {}), ...(gear.shield ? { shield: gear.shield } : {}),
    ...(weapon ? { weapon } : {}), ...(hand?.twoHanded ? { twoHanded: true } : {}), ...(hand?.otherWeapon ? { otherWeapon: true } : {}),
  };
  const { scores, parts } = finalScores(ch, collected, base);
  const mods = {} as Record<Ability, number>;
  for (const a of ABILITIES) mods[a] = abilityMod(scores[a]);
  const full: CondCtx = { ...base, scores };
  const active = collected.entries.filter((e) => holds(e.effect.when, full));
  return {
    ...full, ch, rs, collected, active, mods, parts,
    pb: proficiencyByLevel(totalLevel), level: totalLevel,
  };
}
