import type { Armor, Character, EquipState, Item, Tool, Weapon } from "../types";
import type { Ruleset } from "../ruleset";
import { DEFAULT_SETTINGS, type Settings } from "../settings";
import { tr } from "../../i18n/tr";

export type Found =
  | { kind: "weapon"; def: Weapon } | { kind: "armor"; def: Armor } | { kind: "tool"; def: Tool } | { kind: "item"; def: Item };

export function lookupItem(rs: Ruleset, id: string): Found | undefined {
  const w = rs.weapons.get(id); if (w) return { kind: "weapon", def: w };
  const a = rs.armors.get(id); if (a) return { kind: "armor", def: a };
  const t = rs.tools.get(id); if (t) return { kind: "tool", def: t };
  const i = rs.items.get(id); if (i) return { kind: "item", def: i };
  return undefined;
}

// Sintonia: solo armi, armature e oggetti che la richiedono
export const needsAttunement = (f: Found): boolean => f.kind !== "tool" && f.def.attunement;

type Entry = Character["inventory"][number];
export interface WieldedWeapon { entry: Entry; weapon: Weapon; hands: 1 | 2 }

// Mani occupate da un'arma: A due mani = 2 (la Lancia da cavaliere in sella = 1); Versatile a due mani (grip "two") = 2
export function handsFor(w: Weapon, entry: Entry, mounted: boolean): 1 | 2 {
  if (w.properties.includes("two_handed") && !(w.twoHandedUnlessMounted && mounted)) return 2;
  if (w.properties.includes("versatile") && entry.grip === "two") return 2;
  return 1;
}

export interface Loadout {
  handsUsed: number; handsMax: 2;
  body?: Armor; shield?: Armor;
  wielded: WieldedWeapon[];
  attuned: number; // oggetti sintonizzati (max 3)
  weight: number; // lb: oggetti + monete (50 monete = 1 lb)
  problems: string[];
}

// Stato dell'equipaggiamento: mani, armatura e scudo (una sola armatura e un solo scudo), sintonia, peso.
export function analyzeLoadout(ch: Character, rs: Ruleset): Loadout {
  const problems: string[] = [];
  const mounted = !!ch.state.mounted;
  const wielded: WieldedWeapon[] = [];
  const bodies: Armor[] = []; const shields: Armor[] = [];
  let weight = 0, attuned = 0;
  for (const e of ch.inventory) {
    const f = lookupItem(rs, e.itemId);
    if (!f) { if (rs.items.size + rs.weapons.size > 0) problems.push(tr(`Oggetto sconosciuto: ${e.itemId}`, `Unknown item: ${e.itemId}`)); continue; }
    weight += ((f.def as { weight?: number }).weight ?? 0) * e.qty;
    const name = f.def.name.it;
    if (e.attuned) {
      attuned++;
      if (!needsAttunement(f)) problems.push(tr(`${name} non richiede sintonia`, `${name} does not require attunement`));
    }
    if (f.kind === "armor") {
      if (e.state === "wielded") problems.push(tr(`${name}: un'armatura si indossa (stato "indossato"), non si impugna`, `${name}: armor is worn (state "worn"), not wielded`));
      if (e.state === "worn") (f.def.category === "shield" ? shields : bodies).push(f.def);
    } else if (f.kind === "weapon") {
      if (e.state === "worn") problems.push(tr(`${name}: un'arma si impugna, non si indossa`, `${name}: a weapon is wielded, not worn`));
      if (e.state === "wielded") wielded.push({ entry: e, weapon: f.def, hands: handsFor(f.def, e, mounted) });
    }
  }
  weight += (ch.coins.cp + ch.coins.sp + ch.coins.ep + ch.coins.gp + ch.coins.pp) / 50;
  if (bodies.length > 1) problems.push(tr(`Puoi indossare una sola armatura (indossate: ${bodies.map((b) => b.name.it).join(", ")})`, `You can wear only one suit of armor (worn: ${bodies.map((b) => b.name.it).join(", ")})`));
  if (shields.length > 1) problems.push(tr("Puoi usare un solo scudo", "You can use only one shield"));
  const handsUsed = wielded.reduce((n, w) => n + w.hands, 0) + (shields.length ? 1 : 0);
  if (handsUsed > 2) problems.push(`Troppe mani occupate (${handsUsed} su 2): armi impugnate e scudo`);
  if (attuned > 3) problems.push(`Sintonia: ${attuned} oggetti (massimo 3)`);
  return {
    handsUsed, handsMax: 2, wielded, attuned, weight: Math.round(weight * 100) / 100, problems,
    ...(bodies[0] ? { body: bodies[0] } : {}), ...(shields[0] ? { shield: shields[0] } : {}),
  };
}

export interface EquipTime { minutes: number; action: boolean; free: boolean; note: string }
export interface EquipResult { character: Character; time: EquipTime; problems: string[] }

// Cambia lo stato di un oggetto e dice quanto costa. Indossare un'armatura toglie prima quella che porti.
// Se il risultato non è valido (troppe mani, ecc.) il personaggio resta invariato e `problems` spiega perché.
export function equipItem(ch: Character, rs: Ruleset, itemId: string, target: EquipState, settings: Settings = DEFAULT_SETTINGS, grip?: "one" | "two"): EquipResult {
  const f = lookupItem(rs, itemId);
  const none: EquipTime = { minutes: 0, action: false, free: true, note: "" };
  const idx = ch.inventory.findIndex((e) => e.itemId === itemId);
  if (!f || idx < 0) return { character: ch, time: none, problems: [tr(`Oggetto non nel tuo inventario: ${itemId}`, `Item not in your inventory: ${itemId}`)] };
  const cur = ch.inventory[idx]!;
  if (cur.state === target && (grip === undefined || cur.grip === grip)) return { character: ch, time: none, problems: [] };

  let inventory = ch.inventory.map((e, i) => (i === idx ? { ...e, state: target, ...(grip ? { grip } : {}) } : e));
  let minutes = 0, action = false, free = false, note = "";
  if (f.kind === "armor" && f.def.category !== "shield") {
    // togliere quella indossata prima di indossarne un'altra
    if (target === "worn") {
      for (const [i, e] of inventory.entries()) {
        const a = e.state === "worn" && i !== idx ? rs.armors.get(e.itemId) : undefined;
        if (a && a.category !== "shield") { inventory = inventory.map((x, k) => (k === i ? { ...x, state: "stowed" as const } : x)); minutes += a.doffMinutes; }
      }
      minutes += f.def.donMinutes;
      note = `Indossare: ${f.def.donMinutes} min`;
    } else if (cur.state === "worn") { minutes += f.def.doffMinutes; note = `Togliere: ${f.def.doffMinutes} min`; }
    else free = true;
  } else if (f.kind === "armor") {
    action = true; note = tr("Scudo: 1 azione", "Shield: 1 action");
  } else if (f.kind === "weapon" && settings.weaponSwap === "house") {
    action = true; note = tr("Estrarre o riporre un'arma: 1 azione (regola della casa)", "Drawing or stowing a weapon: 1 action (house rule)");
  } else {
    free = true; note = f.kind === "weapon" ? tr("Estrarre o riporre un'arma fa parte dell'azione di Attacco (un oggetto per turno)", "Drawing or stowing a weapon is part of the Attack action (one object per turn)") : tr("Interazione con un oggetto", "Object interaction");
  }
  const next: Character = { ...ch, inventory };
  const problems = analyzeLoadout(next, rs).problems.filter((p) => !analyzeLoadout(ch, rs).problems.includes(p));
  if (problems.length) return { character: ch, time: none, problems };
  return { character: next, time: { minutes, action, free, note }, problems: [] };
}
