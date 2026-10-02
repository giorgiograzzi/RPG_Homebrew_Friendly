import { tr } from "../../i18n/tr";
import { parseCondition, type Condition } from "../schema";
import type { Ruleset } from "../ruleset";

const AB: Record<string, string> = { str: tr("Forza", "Strength"), dex: tr("Destrezza", "Dexterity"), con: tr("Costituzione", "Constitution"), int: tr("Intelligenza", "Intelligence"), wis: tr("Saggezza", "Wisdom"), cha: tr("Carisma", "Charisma") };
const ARMOR: Record<string, string> = { light: tr("leggere", "light"), medium: tr("medie", "medium"), heavy: tr("pesanti", "heavy"), shield: tr("scudi", "shields") };
const CMP: Record<string, string> = { ">=": tr("almeno", "at least"), "<=": tr("al massimo", "at most"), "==": tr("esattamente", "exactly"), ">": tr("più di", "more than"), "<": tr("meno di", "less than") };

function name(rs: Ruleset, id: string): string {
  for (const m of [rs.feats, rs.classes, rs.subclasses] as Map<string, { name: { it: string } }>[]) if (m.has(id)) return m.get(id)!.name.it;
  for (const c of rs.classes.values()) {
    const f = c.features.find((x) => x.id === id) ?? c.choices.flatMap((k) => k.options ?? []).find((o) => o.id === id);
    if (f) return f.name.it;
  }
  return id.replace(/_/g, " ");
}

// Condizione → testo italiano per i motivi di blocco ("Forza 13+", "livello 4", "addestramento nelle armature medie")
export function describeCondition(src: string | Condition, rs: Ruleset): string {
  const c = typeof src === "string" ? parseCondition(src) : src;
  switch (c.t) {
    case "and": return c.items.map((i) => describeCondition(i, rs)).join(tr(" e ", " and "));
    case "or": return c.items.map((i) => describeCondition(i, rs)).join(tr(" oppure ", " or "));
    case "not": return tr(`non: ${describeCondition(c.item, rs)}`, `not: ${describeCondition(c.item, rs)}`);
    case "level": return c.cmp === ">=" ? tr(`livello ${c.n}`, `level ${c.n}`) : tr(`livello ${CMP[c.cmp]} ${c.n}`, `level ${CMP[c.cmp]} ${c.n}`);
    case "classLevel": return tr(`livello ${c.n} da ${name(rs, c.key ?? "")}`, `${name(rs, c.key ?? "")} level ${c.n}`);
    case "ability": return c.cmp === ">=" ? `${AB[c.key ?? ""]} ${c.n}+` : `${AB[c.key ?? ""]} ${CMP[c.cmp]} ${c.n}`;
    case "hasFeature": return tr(`privilegio ${name(rs, c.value)}`, `feature ${name(rs, c.value)}`);
    case "hasFeat": return tr(`talento ${name(rs, c.value)}`, `feat ${name(rs, c.value)}`);
    case "trained": return tr(`addestramento nelle armature ${ARMOR[c.value]}`, `training with ${ARMOR[c.value]} armor`);
    case "wearingArmor": return c.value === "none" ? tr("senza armatura", "no armor") : c.value === "any" ? tr("con un'armatura", "wearing armor") : tr(`armatura ${ARMOR[c.value]}`, `${ARMOR[c.value]} armor`);
    case "shield": return tr("con uno scudo", "with a shield");
    case "twoHanded": return tr("arma a due mani", "two-handed weapon");
    case "otherWeapon": return tr("con un'altra arma in mano", "with another weapon in hand");
    case "equipped": return tr(`equipaggiato: ${c.value}`, `equipped: ${c.value}`);
    case "usingWeapon": return tr(`con ${name(rs, c.value)}`, `with ${name(rs, c.value)}`);
    case "weaponProperty": return tr(`arma con proprietà ${c.value}`, `weapon with the ${c.value} property`);
    case "attackType": return c.value === "melee" ? tr("attacco in mischia", "melee attack") : tr("attacco a distanza", "ranged attack");
    case "saveProficient": return tr(`competenza nel TS di ${AB[c.value]}`, `${AB[c.value]} save proficiency`);
    case "active": return tr(`${name(rs, c.value)} attivo`, `${name(rs, c.value)} active`);
    case "attackAbility": return tr(`attacco con ${AB[c.value]}`, `attack using ${AB[c.value]}`);
  }
}
