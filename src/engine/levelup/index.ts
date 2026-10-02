import { computeCharacter } from "../compute";
import { fixedHp } from "../compute/constants";
import { allQuestions, classOptions, type Question } from "../creation";
import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { tr } from "../../i18n/tr";

// Avanzamento di livello (file 02 §7-§8): +1 Dado Vita e PF (tiro o valore fisso + mod Cos, minimo 1 per livello), privilegi del
// nuovo livello di classe, sottoclasse al livello indicato dalla classe, Aumento dei punteggi / Dono epico ai livelli previsti,
// bonus di competenza dal livello TOTALE. Il multiclasse chiede 13 nella caratteristica primaria della classe attuale E della nuova.
export const MAX_LEVEL = 20;
export const totalLevel = (ch: Character) => ch.classes.reduce((n, c) => n + c.level, 0);

export interface LevelUpOption { classId: string; name: string; isNew: boolean; level: number; enabled: boolean; reason?: string }

// Classi in cui si può prendere il prossimo livello: quelle che hai (fino al 20° in totale) e quelle nuove (multiclasse)
export function levelUpOptions(ch: Character, rs: Ruleset): LevelUpOption[] {
  if (!ch.classes.length) return [];
  if (totalLevel(ch) >= MAX_LEVEL) return [];
  return classOptions(ch, rs).map((o) => {
    const have = ch.classes.find((c) => c.classId === o.id);
    return { classId: o.id, name: o.name, isNew: !have, level: (have?.level ?? 0) + 1, enabled: o.enabled && (!have || have.level < MAX_LEVEL), ...(o.disabledReason ? { reason: o.disabledReason } : {}) };
  });
}

export type HpChoice = "avg" | number; // "avg" = valore fisso; un numero = risultato del dado (1..dado)
export const rollHitDie = (die: number, rng: () => number = Math.random) => 1 + Math.floor(rng() * die);

export interface LevelUpPreview {
  ok: boolean; errors: string[];
  character: Character; // con il livello applicato (le nuove scelte sono ancora da fare)
  classId: string; classLevel: number; total: number; isNew: boolean;
  hpDie: number; hpGain: number; hpMaxBefore: number; hpMaxAfter: number;
  pbBefore: number; pbAfter: number;
  features: { id: string; name: string; description: string; kind: "class" | "subclass" }[];
  subclassNow: boolean; // al livello in cui si sceglie la sottoclasse
  pending: Question[]; // scelte incomplete dopo il livello (sottoclasse, talento/Aumento punteggi, incantesimi, maestrie...)
}

export function levelUp(ch: Character, rs: Ruleset, classId: string, hp: HpChoice = "avg"): LevelUpPreview {
  const def = rs.classes.get(classId);
  const fail = (e: string): LevelUpPreview => ({ ok: false, errors: [e], character: ch, classId, classLevel: 0, total: totalLevel(ch), isNew: false, hpDie: 0, hpGain: 0,
    hpMaxBefore: 0, hpMaxAfter: 0, pbBefore: 0, pbAfter: 0, features: [], subclassNow: false, pending: [] });
  if (!def) return fail(`Classe sconosciuta: ${classId}`);
  if (!ch.classes.length) return fail(tr("Scegli prima la classe", "Choose the class first"));
  if (totalLevel(ch) >= MAX_LEVEL) return fail(tr("Livello massimo: 20", "Maximum level: 20"));
  const opt = levelUpOptions(ch, rs).find((o) => o.classId === classId);
  if (!opt?.enabled) return fail(opt?.reason ? tr(`Non puoi: ${opt.reason}`, `You can't: ${opt.reason}`) : tr("Non puoi prendere un livello in questa classe", "You can't take a level in this class"));
  if (hp !== "avg" && (!Number.isInteger(hp) || hp < 1 || hp > def.hitDie)) return fail(tr(`Il tiro va da 1 a ${def.hitDie}`, `The roll ranges from 1 to ${def.hitDie}`));

  const before = computeCharacter(ch, rs);
  const have = ch.classes.find((c) => c.classId === classId);
  const roll: number | "avg" = hp;
  // hpRolls[i] = livello i+1 della classe: si porta alla lunghezza del livello attuale prima di aggiungere il nuovo
  const padded = (have?.hpRolls ?? []).slice(0, have?.level ?? 0);
  while (padded.length < (have?.level ?? 0)) padded.push("avg");
  const classes = have
    ? ch.classes.map((c) => (c.classId === classId ? { ...c, level: c.level + 1, hpRolls: [...padded, roll] } : c))
    : [...ch.classes, { classId, level: 1, hpRolls: [roll] }];
  let next: Character = { ...ch, classes };
  const after = computeCharacter(next, rs);
  const gain = after.hp.max.value - before.hp.max.value;
  next = { ...next, state: { ...next.state, hp: ch.state.hp + gain } };
  const classLevel = (have?.level ?? 0) + 1;
  const sub = next.classes.find((c) => c.classId === classId)?.subclassId;
  const subDef = sub ? rs.subclasses.get(sub) : undefined;
  const features = [
    ...def.features.filter((f) => f.level === classLevel).map((f) => ({ id: f.id, name: f.name.it, description: f.description, kind: "class" as const })),
    ...(subDef && classLevel >= def.subclassLevel ? subDef.features.filter((f) => f.level === classLevel).map((f) => ({ id: f.id, name: f.name.it, description: f.description, kind: "subclass" as const })) : []),
  ];
  const pending = allQuestions(next, rs).filter((q) => !q.complete && !q.disabled);
  return {
    ok: true, errors: [], character: next, classId, classLevel, total: totalLevel(next), isNew: !have,
    hpDie: def.hitDie, hpGain: gain, hpMaxBefore: before.hp.max.value, hpMaxAfter: after.hp.max.value,
    pbBefore: before.proficiencyBonus.value, pbAfter: after.proficiencyBonus.value, features, subclassNow: classLevel === def.subclassLevel, pending,
  };
}

// Valore fisso per livello del dado (d6=4, d8=5, d10=6, d12=7)
export const fixedHpPerLevel = (die: number) => fixedHp(die);

// PX: livello raggiunto dai punti esperienza, e PX del prossimo livello (null al 20°)
export function levelFromXp(rs: Ruleset, xp: number): number {
  const t = rs.creation.get("creation")?.xpThresholds ?? [];
  let lv = 1;
  for (let i = 0; i < t.length; i++) if (xp >= t[i]!) lv = i + 1;
  return lv;
}
export function xpForLevel(rs: Ruleset, level: number): number | null {
  const t = rs.creation.get("creation")?.xpThresholds;
  return t && level >= 1 && level <= t.length ? t[level - 1]! : null;
}
