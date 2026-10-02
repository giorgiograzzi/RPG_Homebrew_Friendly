import type { Character } from "../types";
import type { Ruleset } from "../ruleset";
import { lookupItem, needsAttunement, type Found } from "./loadout";
import { tr } from "../../i18n/tr";

// Inventario, monete e negozio. Costi in monete di rame (1 mo = 100 mr), pesi in lb.
type Coins = Character["coins"];
type Denom = keyof Coins;
export const COIN_VALUE: Record<Denom, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
const HIGH_TO_LOW: Denom[] = ["pp", "gp", "ep", "sp", "cp"];
const CHANGE: Denom[] = ["gp", "sp", "cp"]; // il resto si dà in oro, argento e rame (niente electrum né platino)

export const walletCp = (c: Coins): number => HIGH_TO_LOW.reduce((n, d) => n + c[d] * COIN_VALUE[d], 0);

// 1 mo = 100 mr: "1 mo 5 mr", "25 mr", "50 mo"
export function formatCost(cp: number): string {
  const gp = Math.floor(cp / 100), rest = cp % 100, sp = Math.floor(rest / 10), c = rest % 10;
  const parts = [gp ? `${gp} mo` : "", sp ? `${sp} ma` : "", c ? `${c} mr` : ""].filter(Boolean);
  return parts.join(" ") || "0";
}

// Paga con le monete che hai: prima quelle più grandi che ci stanno, poi si "spezza" la più piccola che basta e si dà il resto.
export function payCoins(coins: Coins, costCp: number): { ok: true; coins: Coins } | { ok: false; error: string } {
  if (costCp <= 0) return { ok: true, coins };
  if (walletCp(coins) < costCp) return { ok: false, error: tr(`Ti servono ${formatCost(costCp)}: hai ${formatCost(walletCp(coins))}`, `You need ${formatCost(costCp)}: you have ${formatCost(walletCp(coins))}`) };
  const c: Coins = { ...coins };
  let need = costCp;
  for (const d of HIGH_TO_LOW) {
    const use = Math.min(c[d], Math.floor(need / COIN_VALUE[d]));
    c[d] -= use; need -= use * COIN_VALUE[d];
  }
  while (need > 0) {
    // la moneta più piccola che copre il rimanente
    const d = [...HIGH_TO_LOW].reverse().find((x) => c[x] > 0 && COIN_VALUE[x] >= need);
    if (!d) {
      // nessuna moneta singola basta: si usano le più piccole disponibili finché copre
      const any = [...HIGH_TO_LOW].reverse().find((x) => c[x] > 0)!;
      c[any]--; need -= COIN_VALUE[any]; continue;
    }
    c[d]--;
    let change = COIN_VALUE[d] - need; need = 0;
    for (const k of CHANGE) { const n = Math.floor(change / COIN_VALUE[k]); c[k] += n; change -= n * COIN_VALUE[k]; }
  }
  return { ok: true, coins: c };
}

export interface CatalogEntry { id: string; name: string; kind: Found["kind"]; group: string; homebrew: boolean; cost: number; weight: number; description: string }
const GROUP: Record<string, string> = { weapon: tr("Armi", "Weapons"), armor: tr("Armature", "Armor"), tool: tr("Strumenti", "Tools"), item: tr("Oggetti", "Items"), magic: tr("Oggetti magici", "Magic items") };
// Tutto ciò che si può comprare (ha un costo). Le creazioni homebrew hanno gli stessi gruppi del manuale ma il flag `homebrew` (anche a costo 0: oggetti magici, doni).
export function shopCatalog(rs: Ruleset): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  const add = (kind: Found["kind"], defs: Iterable<{ id: string; name: { it: string }; cost: number; weight: number; origin?: string; description?: string }>) => {
    for (const d of defs) {
      const hb = d.origin === "homebrew";
      const magic = kind === "item" && !!(d as { magic?: unknown }).magic; // gli oggetti magici dell'SRD non hanno prezzo: si aggiungono (li assegna il GM)
      if (d.cost > 0 || hb || magic) out.push({ id: d.id, name: d.name.it, kind, group: GROUP[magic ? "magic" : kind]!, homebrew: hb, cost: d.cost, weight: d.weight, description: d.description ?? "" });
    }
  };
  add("weapon", rs.weapons.values()); add("armor", rs.armors.values()); add("tool", rs.tools.values()); add("item", rs.items.values());
  return out.sort((a, b) => a.group.localeCompare(b.group, "it") || a.name.localeCompare(b.name, "it"));
}

export interface Result { ok: boolean; errors: string[]; character: Character }
const fail = (ch: Character, e: string): Result => ({ ok: false, errors: [e], character: ch });

export function buyItem(ch: Character, rs: Ruleset, id: string, qty = 1): Result {
  const f = lookupItem(rs, id);
  if (!f) return fail(ch, tr(`Oggetto sconosciuto: ${id}`, `Unknown item: ${id}`));
  const cost = (f.def as { cost?: number }).cost ?? 0;
  const pay = payCoins(ch.coins, cost * qty);
  if (!pay.ok) return fail(ch, pay.error);
  return { ok: true, errors: [], character: { ...addItem(ch, id, qty), coins: pay.coins } };
}

// Aggiunge (o aumenta) un oggetto, riposto nello zaino
export function addItem(ch: Character, id: string, qty = 1): Character {
  const i = ch.inventory.findIndex((e) => e.itemId === id);
  if (i >= 0) return { ...ch, inventory: ch.inventory.map((e, k) => (k === i ? { ...e, qty: e.qty + qty } : e)) };
  return { ...ch, inventory: [...ch.inventory, { itemId: id, qty, state: "stowed" }] };
}

// Cambia la quantità; a 0 l'oggetto esce dall'inventario
export function setQty(ch: Character, id: string, qty: number): Character {
  const n = Math.max(0, Math.floor(qty));
  return { ...ch, inventory: n === 0 ? ch.inventory.filter((e) => e.itemId !== id) : ch.inventory.map((e) => (e.itemId === id ? { ...e, qty: n } : e)) };
}

// Sintonia: solo per gli oggetti che la richiedono, al massimo 3
export function setAttuned(ch: Character, rs: Ruleset, id: string, on: boolean): Result {
  const f = lookupItem(rs, id);
  if (!f || !ch.inventory.some((e) => e.itemId === id)) return fail(ch, tr("Oggetto non nel tuo inventario", "Item not in your inventory"));
  if (on) {
    if (!needsAttunement(f)) return fail(ch, tr(`${f.def.name.it} non richiede sintonia`, `${f.def.name.it} does not require attunement`));
    if (ch.inventory.filter((e) => e.attuned).length >= 3) return fail(ch, tr("Sei già sintonizzato con 3 oggetti", "You are already attuned to 3 items"));
  }
  return { ok: true, errors: [], character: { ...ch, inventory: ch.inventory.map((e) => {
    if (e.itemId !== id) return e;
    const { attuned: _a, ...rest } = e; void _a;
    return on ? { ...rest, attuned: true } : rest;
  }) } };
}
