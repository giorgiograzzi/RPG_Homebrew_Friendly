import { describe, expect, it } from "vitest";
import { pointBuyCost } from "../engine/creation";
import { ABILITIES } from "../engine/schema";
import { chooseMethod, isFinalized, reopenCreation, startScores, stepPointBuy, swapScore, togglePick } from "./logic";
import { testRuleset, testCharacter } from "../engine/compute/testkit";

const TEST_RULESET = testRuleset();

describe("selezione delle opzioni", () => {
  it("scelta singola: sostituisce o toglie", () => {
    expect(togglePick({ count: 1, selected: [] }, "a")).toEqual(["a"]);
    expect(togglePick({ count: 1, selected: ["a"] }, "b")).toEqual(["b"]);
    expect(togglePick({ count: 1, selected: ["a"] }, "a")).toEqual([]);
  });
  it("scelta multipla: aggiunge, toglie, e oltre il massimo esce la più vecchia", () => {
    expect(togglePick({ count: 2, selected: ["a"] }, "b")).toEqual(["a", "b"]);
    expect(togglePick({ count: 2, selected: ["a", "b"] }, "c")).toEqual(["b", "c"]);
    expect(togglePick({ count: 2, selected: ["a", "b"] }, "a")).toEqual(["b"]);
  });
});

describe("punteggi: scambi e acquisto a punti", () => {
  const S = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  it("swapScore mantiene sempre lo stesso insieme di valori", () => {
    const r = swapScore(S, "str", 8);
    expect(r).toEqual({ ...S, str: 8, cha: 15 });
    expect(swapScore(S, "str", 99)).toBe(S); // valore che non c'è: nessun cambio
    expect(swapScore(S, "str", 15)).toBe(S);
  });
  it("stepPointBuy rispetta limiti e budget", () => {
    const rs = TEST_RULESET;
    const pb = rs.creation.get("creation")?.pointBuy;
    if (!pb) return; // il mini ruleset ha le regole di creazione (testkit)
    let s = startScores(testCharacter(), rs, "pointbuy");
    expect(s.str).toBe(pb.min);
    expect(stepPointBuy(rs, s, "str", -1)).toBe(s); // sotto il minimo
    for (let i = 0; i < 100; i++) for (const a of ABILITIES) s = stepPointBuy(rs, s, a, 1);
    expect(pointBuyCost(rs, s).errors).toEqual([]);
    expect(pointBuyCost(rs, s).remaining).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ABILITIES.map((a) => s[a]))).toBeLessThanOrEqual(pb.max);
  });
  it("il tiro si fa una volta e ricambiando metodo non si rifà", () => {
    let n = 0;
    const rng = () => [0.99, 0.5, 0.2, 0.7][n++ % 4]!;
    const rs = TEST_RULESET;
    const a = chooseMethod(testCharacter(), rs, "roll", { allowReroll: false, rng });
    expect(a.ok).toBe(true);
    const rolls = a.character.creation?.rolls;
    expect(rolls).toHaveLength(6);
    const b = chooseMethod(chooseMethod(a.character, rs, "manual", { allowReroll: false, rng }).character, rs, "roll", { allowReroll: false, rng });
    expect(b.character.creation?.rolls).toEqual(rolls);
  });
});

describe("chiusura della creazione (mini ruleset)", () => {
  it("riapri non perde le scelte", () => {
    const ch = testCharacter();
    const closed = { ...ch, classes: ch.classes.map((c) => ({ ...c, hpRolls: ["avg" as const] })) };
    expect(isFinalized(closed)).toBe(true);
    expect(isFinalized(reopenCreation(closed))).toBe(false);
    expect(reopenCreation(closed).decisions).toEqual(closed.decisions);
  });
});
