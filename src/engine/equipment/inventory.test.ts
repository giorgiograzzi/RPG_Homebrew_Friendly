import { describe, expect, it } from "vitest";
import { testCharacter, testRuleset } from "../compute/testkit";
import type { Character } from "../types";
import { addItem, buyItem, formatCost, payCoins, setAttuned, setQty, shopCatalog, walletCp } from "./inventory";

const coins = (o: Partial<Character["coins"]>) => ({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...o });
const total = (c: Character["coins"]) => walletCp(c);

describe("monete", () => {
  it("valori e formato", () => {
    expect(walletCp(coins({ pp: 1, gp: 2, ep: 1, sp: 3, cp: 4 }))).toBe(1000 + 200 + 50 + 30 + 4);
    expect(formatCost(1)).toBe("1 mr");
    expect(formatCost(10)).toBe("1 ma");
    expect(formatCost(1505)).toBe("15 mo 5 mr");
    expect(formatCost(0)).toBe("0");
  });
  it("paga esatto con le monete più grandi che ci stanno", () => {
    const r = payCoins(coins({ gp: 10, sp: 5 }), 250);
    expect(r).toMatchObject({ ok: true, coins: coins({ gp: 8, sp: 0 }) });
  });
  it("spezza la moneta più piccola che basta e dà il resto in oro/argento/rame", () => {
    const r = payCoins(coins({ gp: 5 }), 150); // 1,5 mo con sole monete d'oro: si spendono 2 mo e si ricevono 5 ma
    expect(r.ok && total(r.coins)).toBe(500 - 150);
    expect(r.ok && r.coins).toEqual(coins({ gp: 3, sp: 5 }));
  });
  it("il totale scende sempre esattamente del costo", () => {
    for (const cost of [1, 7, 10, 55, 99, 100, 101, 1234]) {
      const start = coins({ pp: 1, gp: 3, ep: 2, sp: 4, cp: 6 });
      const r = payCoins(start, cost);
      expect(r.ok, String(cost)).toBe(true);
      if (r.ok) { expect(total(r.coins), String(cost)).toBe(total(start) - cost); expect(Object.values(r.coins).every((n) => n >= 0)).toBe(true); }
    }
  });
  it("senza fondi non paga e dice quanto manca", () => {
    const r = payCoins(coins({ gp: 1 }), 500);
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("Ti servono 5 mo") });
  });
});

describe("negozio e inventario", () => {
  const rs = testRuleset();
  const rich = () => testCharacter({ coins: coins({ gp: 100 }), inventory: [] });
  it("il catalogo ha solo oggetti con un costo", () => {
    const cat = shopCatalog(rs);
    expect(cat.every((c) => c.cost > 0)).toBe(true);
  });
  it("comprare toglie le monete e aggiunge l'oggetto (riposto); ricomprando aumenta la quantità", () => {
    const withCost = testRuleset();
    withCost.items.get("rope")!.cost = 100;
    const a = buyItem(rich(), withCost, "rope");
    expect(a.ok).toBe(true);
    expect(a.character.coins.gp).toBe(99);
    expect(a.character.inventory).toEqual([{ itemId: "rope", qty: 1, state: "stowed" }]);
    const b = buyItem(a.character, withCost, "rope", 2);
    expect(b.character.inventory[0]!.qty).toBe(3);
    expect(b.character.coins.gp).toBe(97);
  });
  it("comprare senza fondi non cambia nulla", () => {
    const withCost = testRuleset();
    withCost.items.get("rope")!.cost = 50000;
    const c = rich();
    const r = buyItem(c, withCost, "rope");
    expect(r.ok).toBe(false);
    expect(r.character).toBe(c);
    expect(buyItem(c, withCost, "nonesiste").ok).toBe(false);
  });
  it("quantità: a zero l'oggetto esce; aggiungere oggetti già presenti somma", () => {
    const c = addItem(addItem(rich(), "rope", 2), "rope", 1);
    expect(c.inventory[0]!.qty).toBe(3);
    expect(setQty(c, "rope", 5).inventory[0]!.qty).toBe(5);
    expect(setQty(c, "rope", 0).inventory).toEqual([]);
    expect(setQty(c, "rope", -3).inventory).toEqual([]);
  });
  it("sintonia: solo dove serve e al massimo 3", () => {
    const c = testCharacter({ inventory: [{ itemId: "ring", qty: 1, state: "stowed" }, { itemId: "rope", qty: 1, state: "stowed" }] });
    const on = setAttuned(c, rs, "ring", true);
    expect(on.ok).toBe(true);
    expect(on.character.inventory[0]!.attuned).toBe(true);
    expect(setAttuned(on.character, rs, "ring", false).character.inventory[0]!.attuned).toBeUndefined();
    expect(setAttuned(c, rs, "rope", true)).toMatchObject({ ok: false, errors: [expect.stringContaining("non richiede sintonia")] });
    const full = { ...c, inventory: [1, 2, 3].map((i) => ({ itemId: `x${i}`, qty: 1, state: "stowed" as const, attuned: true })).concat([{ itemId: "ring", qty: 1, state: "stowed" as const, attuned: undefined as never }]) };
    expect(setAttuned(full as Character, rs, "ring", true)).toMatchObject({ ok: false });
  });
});
