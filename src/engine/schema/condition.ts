// Condizioni sugli effetti: stringhe come "wearingArmor:none && !shield".
// Grammatica: or := and ('||' and)* ; and := not ('&&' not)* ; not := '!'? atom
//   wearingArmor:none|light|medium|heavy|any   shield   equipped:<id|categoria>
//   trained:light|medium|heavy|shield (addestramento nelle armature)
//   twoHanded (l'arma è impugnata a due mani)   otherWeapon (nell'altra mano c'è un'altra arma)
//   usingWeapon:<id> (l'arma dell'attacco è proprio questa: bonus di un'arma magica)
//   weaponProperty:<prop>   attackType:melee|ranged   hasFeature:<id>   hasFeat:<id>
//   active:<id> (privilegio attivato: Ira...)   attackAbility:<car> (caratteristica usata dall'attacco)
//   saveProficient:<car> (TS già di classe: la prima classe dà i TS)
//   level>=N   classLevel:<classe>>=N   ability:<car>>=N   (operatori: >= <= == > <)
import type { Ability } from "./primitives";
export type Cmp = ">=" | "<=" | "==" | ">" | "<";
export type Condition =
  | { t: "and" | "or"; items: Condition[] }
  | { t: "not"; item: Condition }
  | { t: "wearingArmor"; value: "none" | "light" | "medium" | "heavy" | "any" }
  | { t: "shield" }
  | { t: "twoHanded" }
  | { t: "otherWeapon" }
  | { t: "trained"; value: "light" | "medium" | "heavy" | "shield" }
  | { t: "equipped"; value: string }
  | { t: "weaponProperty" | "usingWeapon"; value: string }
  | { t: "attackType"; value: "melee" | "ranged" }
  | { t: "hasFeature" | "hasFeat" | "active"; value: string } // active:<id> = privilegio attivato (Ira...)
  | { t: "attackAbility" | "saveProficient"; value: Ability } // saveProficient: competenza nel TS già data dalla classe di partenza (Mente di ferro) // caratteristica usata dall'attacco (Ira: solo attacchi con la Forza)
  | { t: "level" | "classLevel" | "ability"; key?: string; cmp: Cmp; n: number };

const ARMOR = ["none", "light", "medium", "heavy", "any"];
const ABIL = ["str", "dex", "con", "int", "wis", "cha"];
const ID = /^[a-z][a-z0-9_]*$/;

function atom(s: string): Condition {
  const bad = () => new Error(`Condizione non valida: "${s}"`);
  if (s === "shield") return { t: "shield" };
  if (s === "twoHanded") return { t: "twoHanded" };
  if (s === "otherWeapon") return { t: "otherWeapon" };
  let m = /^level(>=|<=|==|>|<)(\d+)$/.exec(s);
  if (m) return { t: "level", cmp: m[1] as Cmp, n: Number(m[2]) };
  m = /^(classLevel|ability):([a-z_]+)(>=|<=|==|>|<)(\d+)$/.exec(s);
  if (m) {
    if (m[1] === "ability" && !ABIL.includes(m[2]!)) throw bad();
    return { t: m[1] as "classLevel" | "ability", key: m[2]!, cmp: m[3] as Cmp, n: Number(m[4]) };
  }
  m = /^([a-zA-Z]+):([a-z_]+)$/.exec(s);
  if (!m) throw bad();
  const [, k, v] = m as unknown as [string, string, string];
  if (k === "wearingArmor" && ARMOR.includes(v)) return { t: k, value: v as never };
  if (k === "attackType" && (v === "melee" || v === "ranged")) return { t: k, value: v };
  if (k === "trained" && ["light", "medium", "heavy", "shield"].includes(v)) return { t: k, value: v as never };
  if ((k === "attackAbility" || k === "saveProficient") && ABIL.includes(v)) return { t: k, value: v as Ability };
  if ((k === "equipped" || k === "weaponProperty" || k === "usingWeapon" || k === "hasFeature" || k === "hasFeat" || k === "active") && ID.test(v))
    return { t: k, value: v };
  throw bad();
}

export function parseCondition(src: string): Condition {
  const or = src.split("||").map((p) => {
    const and = p.split("&&").map((a) => {
      const s = a.trim();
      return s.startsWith("!") ? ({ t: "not", item: atom(s.slice(1).trim()) } as Condition) : atom(s);
    });
    return and.length === 1 ? and[0]! : ({ t: "and", items: and } as Condition);
  });
  return or.length === 1 ? or[0]! : { t: "or", items: or };
}

export const isValidCondition = (s: string): boolean => {
  try { parseCondition(s); return true; } catch { return false; }
};
