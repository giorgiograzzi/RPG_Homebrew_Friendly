import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { lookupItem } from "../equipment/loadout";

type Set = { items: { item: string; qty: number; note?: string }[]; gp: number };

// Equipaggiamento iniziale: opzione di classe (A/B/C) + opzione di background (A/B), dalle decisioni `equipment:class` e `equipment:background`.
// $tool = lo strumento scelto per la competenza del background/classe; $instrument = lo strumento musicale scelto; $gaming_set = un set da gioco;
// $holy_symbol = simbolo sacro (amuleto); $spellbook = nessun oggetto (il libro è l'elenco degli incantesimi).
// L'armatura e lo scudo arrivano indossati, il resto riposto. Non si vende l'equipaggiamento iniziale per avere monete (file 02 §6).
export function startingEquipment(ch: Character, rs: Ruleset, opts: { gaming_set?: string; extraGold?: number } = {}): { inventory: Character["inventory"]; gp: number; pending: string[] } {
  const inv = new Map<string, number>();
  const pending: string[] = [];
  let gp = opts.extraGold ?? 0;
  const first = ch.classes[0] && rs.classes.get(ch.classes[0].classId);
  const bg = rs.backgrounds.get(ch.backgroundId);
  const tool = (bg && (ch.decisions[`${bg.id}_tool`]?.[0] ?? (bg.tool !== "artisan" && bg.tool !== "gaming" && bg.tool !== "musical" ? bg.tool : undefined)))
    ?? (first && (ch.decisions[`${first.id}_tools`]?.[0]));
  const resolve = (id: string): string | undefined => {
    if (id === "$tool") return tool;
    if (id === "$instrument") return (first && ch.decisions[`${first.id}_tools`]?.[0]) || ch.decisions[`${bg?.id}_tool`]?.[0];
    if (id === "$gaming_set") return ch.decisions["equipment:gaming_set"]?.[0] ?? opts.gaming_set;
    // il libro degli incantesimi non è un oggetto dell'SRD: il libro è l'elenco degli incantesimi del personaggio
    if (id === "$spellbook") return "";
    // simbolo sacro: l'SRD ne ha tre varianti dello stesso costo; si parte dall'amuleto (si cambia nello zaino)
    if (id === "$holy_symbol") return ch.decisions["equipment:holy_symbol"]?.[0] ?? "holy_symbol_amulet";
    return id.startsWith("$") ? undefined : id;
  };
  const add = (set: Set | undefined) => {
    if (!set) return;
    gp += set.gp;
    for (const i of set.items) {
      const id = resolve(i.item);
      if (id === "") continue;
      if (!id) { pending.push(i.item); continue; }
      inv.set(id, (inv.get(id) ?? 0) + i.qty);
    }
  };
  add(first?.equipment[(ch.decisions["equipment:class"]?.[0] ?? "") as "A"]);
  add(bg?.equipment[(ch.decisions["equipment:background"]?.[0] ?? "") as "A"]);
  const inventory = [...inv].map(([itemId, qty]) => {
    const f = lookupItem(rs, itemId);
    const state = f?.kind === "armor" ? ("worn" as const) : ("stowed" as const);
    return { itemId, qty, state };
  });
  // una sola armatura e un solo scudo indossati
  let body = false, shield = false;
  for (const e of inventory) {
    const a = rs.armors.get(e.itemId);
    if (!a) continue;
    if (a.category === "shield") { if (shield) e.state = "stowed" as never; shield = true; }
    else { if (body) e.state = "stowed" as never; body = true; }
  }
  return { inventory, gp, pending };
}

// Partire a un livello più alto: monete fisse + dado (es. 1d10 × 25 mo) e oggetti magici concessi
export function startingWealth(level: number, rs: Ruleset, rng: () => number = Math.random): { gold: number; roll?: number; magicItems: { common: number; uncommon: number; rare: number; veryRare: number } } | undefined {
  const band = rs.creation.get("creation")?.startingLevels.find((b) => level >= b.minLevel && level <= b.maxLevel);
  if (!band) return undefined;
  let gold = band.gold, roll: number | undefined;
  if (band.goldDice) {
    roll = Array.from({ length: band.goldDice.count }, () => 1 + Math.floor(rng() * band.goldDice!.sides)).reduce((a, b) => a + b, 0);
    gold += roll * band.goldDice.multiplier;
  }
  return { gold, ...(roll !== undefined ? { roll } : {}), magicItems: band.magicItems };
}
