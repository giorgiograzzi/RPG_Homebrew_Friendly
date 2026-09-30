import type { Armor, Weapon } from "../types";
import { parseCondition, type Ability, type Cmp, type Condition } from "../schema";

// Stato del personaggio visto dalle condizioni degli effetti
export interface CondCtx {
  totalLevel: number;
  classLevels: Record<string, number>;
  scores: Record<Ability, number>;
  bodyArmor?: Armor;
  shield?: Armor;
  equipped: Set<string>; // id e categorie degli oggetti indossati/impugnati
  weapon?: Weapon; // arma considerata (attacchi); assente = condizioni sull'arma false
  twoHanded?: boolean; // l'arma considerata è impugnata a due mani
  otherWeapon?: boolean; // nell'altra mano c'è un'altra arma
  armorTraining?: Set<string>; // addestramento in armature (prerequisiti dei talenti)
  features: Set<string>;
  feats: Set<string>;
  activeStates?: Record<string, string[]>; // privilegi attivati (state.active): id → scelte fatte all'attivazione
  attackAbility?: Ability; // caratteristica usata dall'attacco considerato
  classSaves?: Set<Ability>; // TS della classe di partenza
}

const cmp = (a: number, op: Cmp, b: number) =>
  op === ">=" ? a >= b : op === "<=" ? a <= b : op === "==" ? a === b : op === ">" ? a > b : a < b;

export function evalCondition(c: Condition, x: CondCtx): boolean {
  switch (c.t) {
    case "and": return c.items.every((i) => evalCondition(i, x));
    case "or": return c.items.some((i) => evalCondition(i, x));
    case "not": return !evalCondition(c.item, x);
    case "wearingArmor":
      return c.value === "none" ? !x.bodyArmor : c.value === "any" ? !!x.bodyArmor : x.bodyArmor?.category === c.value;
    case "shield": return !!x.shield;
    case "twoHanded": return !!x.twoHanded;
    case "otherWeapon": return !!x.otherWeapon;
    case "trained": return !!x.armorTraining?.has(c.value);
    case "equipped": return x.equipped.has(c.value);
    case "usingWeapon": return x.weapon?.id === c.value;
    case "weaponProperty": return !!x.weapon?.properties.includes(c.value);
    case "attackType": return x.weapon?.kind === c.value;
    case "hasFeature": return x.features.has(c.value);
    case "hasFeat": return x.feats.has(c.value);
    case "active": return !!x.activeStates?.[c.value];
    case "attackAbility": return x.attackAbility === c.value;
    case "saveProficient": return !!x.classSaves?.has(c.value);
    case "level": return cmp(x.totalLevel, c.cmp, c.n);
    case "classLevel": return cmp(x.classLevels[c.key ?? ""] ?? 0, c.cmp, c.n);
    case "ability": return cmp(x.scores[c.key as Ability] ?? 0, c.cmp, c.n);
  }
}

export const holds = (when: string | undefined, x: CondCtx) =>
  when === undefined || evalCondition(parseCondition(when), x);
