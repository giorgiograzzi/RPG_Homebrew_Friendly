import { parseCondition, type Condition } from "../schema";
import type { Ruleset } from "../ruleset";

const AB: Record<string, string> = { str: "Forza", dex: "Destrezza", con: "Costituzione", int: "Intelligenza", wis: "Saggezza", cha: "Carisma" };
const ARMOR: Record<string, string> = { light: "leggere", medium: "medie", heavy: "pesanti", shield: "scudi" };
const CMP: Record<string, string> = { ">=": "almeno", "<=": "al massimo", "==": "esattamente", ">": "più di", "<": "meno di" };

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
    case "and": return c.items.map((i) => describeCondition(i, rs)).join(" e ");
    case "or": return c.items.map((i) => describeCondition(i, rs)).join(" oppure ");
    case "not": return `non: ${describeCondition(c.item, rs)}`;
    case "level": return c.cmp === ">=" ? `livello ${c.n}` : `livello ${CMP[c.cmp]} ${c.n}`;
    case "classLevel": return `livello ${c.n} da ${name(rs, c.key ?? "")}`;
    case "ability": return c.cmp === ">=" ? `${AB[c.key ?? ""]} ${c.n}+` : `${AB[c.key ?? ""]} ${CMP[c.cmp]} ${c.n}`;
    case "hasFeature": return `privilegio ${name(rs, c.value)}`;
    case "hasFeat": return `talento ${name(rs, c.value)}`;
    case "trained": return `addestramento nelle armature ${ARMOR[c.value]}`;
    case "wearingArmor": return c.value === "none" ? "senza armatura" : c.value === "any" ? "con un'armatura" : `armatura ${ARMOR[c.value]}`;
    case "shield": return "con uno scudo";
    case "twoHanded": return "arma a due mani";
    case "otherWeapon": return "con un'altra arma in mano";
    case "equipped": return `equipaggiato: ${c.value}`;
    case "usingWeapon": return `con ${name(rs, c.value)}`;
    case "weaponProperty": return `arma con proprietà ${c.value}`;
    case "attackType": return c.value === "melee" ? "attacco in mischia" : "attacco a distanza";
    case "saveProficient": return `competenza nel TS di ${AB[c.value]}`;
    case "active": return `${name(rs, c.value)} attivo`;
    case "attackAbility": return `attacco con ${AB[c.value]}`;
  }
}
