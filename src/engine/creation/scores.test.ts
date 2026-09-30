import { describe, expect, it } from "vitest";
import { testCharacter, testRuleset } from "../compute/testkit";
import { asiProblems } from "./asi";
import { pointBuyCost, recommendedArray, rollAbilityScores, scoreProblems, setBaseScores, startingWealth } from "./index";

const rs = testRuleset();
const S = (str: number, dex: number, con: number, int: number, wis: number, cha: number) => ({ str, dex, con, int, wis, cha });
const bgSpec = { allowed: ["str", "dex", "con"] as never, mode: "background" as const, cap: 20 };
const zeros = S(10, 10, 10, 10, 10, 10);

describe("punteggi di caratteristica", () => {
  it("tiro 4d6 scartando il più basso: 6 valori tra 3 e 18", () => {
    const seq = [6, 1, 3, 4, /* → 6+3+4 = 13 */ 1, 1, 1, 1, /* → 3 */ 6, 6, 6, 6 /* → 18 */];
    let i = 0;
    const rng = () => (((seq[i++ % seq.length] ?? 1) - 1) + 0.5) / 6;
    const { rolls, dice } = rollAbilityScores(rng);
    expect(rolls.slice(0, 3)).toEqual([13, 3, 18]);
    expect(dice[0]).toEqual([6, 1, 3, 4]);
    const real = rollAbilityScores();
    expect(real.rolls).toHaveLength(6);
    expect(real.rolls.every((r) => r >= 3 && r <= 18)).toBe(true);
  });
  it("array standard: serve una permutazione di 15, 14, 13, 12, 10, 8", () => {
    const ch = testCharacter();
    expect(setBaseScores(ch, rs, "array", S(15, 14, 13, 12, 10, 8)).ok).toBe(true);
    expect(setBaseScores(ch, rs, "array", S(15, 15, 13, 12, 10, 8)).errors[0]).toMatch(/15, 14, 13, 12, 10, 8/);
    expect(setBaseScores(ch, rs, "array", S(8, 10, 12, 13, 14, 15)).ok).toBe(true); // qualsiasi ordine
  });
  it("tiro casuale: i valori assegnati devono essere quelli tirati", () => {
    const ch = testCharacter();
    expect(setBaseScores(ch, rs, "roll", S(16, 12, 12, 10, 9, 7)).errors[0]).toMatch(/Tira i dadi/);
    expect(setBaseScores(ch, rs, "roll", S(16, 12, 12, 10, 9, 7), [16, 12, 12, 10, 9, 7]).ok).toBe(true);
    expect(setBaseScores(ch, rs, "roll", S(18, 12, 12, 10, 9, 7), [16, 12, 12, 10, 9, 7]).ok).toBe(false);
  });
  it("acquisto a punti: 27 punti, da 8 a 15, costi 0/1/2/3/4/5/7/9", () => {
    expect(pointBuyCost(rs, S(8, 8, 8, 8, 8, 8))).toMatchObject({ spent: 0, remaining: 27, errors: [] });
    expect(pointBuyCost(rs, S(15, 15, 15, 8, 8, 8))).toMatchObject({ spent: 27, remaining: 0, errors: [] });
    expect(pointBuyCost(rs, S(15, 15, 15, 9, 8, 8)).errors[0]).toMatch(/28 su 27/);
    expect(pointBuyCost(rs, S(16, 8, 8, 8, 8, 8)).errors[0]).toMatch(/da 8 a 15/);
    expect(pointBuyCost(rs, S(13, 13, 13, 13, 13, 13)).spent).toBe(30);
    expect(setBaseScores(testCharacter(), rs, "pointbuy", S(13, 12, 14, 10, 8, 8)).ok).toBe(true); // 5+4+7+2 = 18
    expect(setBaseScores(testCharacter(), rs, "pointbuy", S(15, 15, 15, 12, 12, 12)).ok).toBe(false); // 39
  });
  it("metodo mancante e manuale", () => {
    expect(scoreProblems(testCharacter(), rs)[0]).toMatch(/metodo/);
    expect(setBaseScores(testCharacter(), rs, "manual", S(20, 3, 10, 10, 10, 10)).ok).toBe(true);
    expect(setBaseScores(testCharacter(), rs, "manual", S(21, 3, 10, 10, 10, 10)).ok).toBe(false);
  });
  it("array consigliato per classe e partenza a livello più alto", () => {
    expect(recommendedArray(rs, "fighter")).toEqual(S(15, 14, 13, 8, 10, 12));
    expect(startingWealth(3, rs)).toBeUndefined();
    const w = startingWealth(5, rs, () => 0.5)!; // d10 = 6 → 500 + 6 × 25
    expect([w.gold, w.roll, w.magicItems.uncommon]).toEqual([650, 6, 1]);
  });
});

describe("aumenti di caratteristica: regole", () => {
  const pk = (...p: [string, number][]) => p.map(([ability, amount]) => ({ ability: ability as never, amount }));
  it("background: +2/+1 su due delle tre, oppure +1/+1/+1 sulle tre", () => {
    expect(asiProblems(bgSpec, pk(["str", 2], ["dex", 1]), zeros)).toEqual([]);
    expect(asiProblems(bgSpec, pk(["str", 1], ["dex", 1], ["con", 1]), zeros)).toEqual([]);
    expect(asiProblems(bgSpec, pk(["str", 2]), zeros)[0]).toMatch(/\+2 a una e \+1/);
    expect(asiProblems(bgSpec, pk(["str", 2], ["dex", 2]), zeros).length).toBeGreaterThan(0);
    expect(asiProblems(bgSpec, pk(["str", 1], ["dex", 1]), zeros).length).toBeGreaterThan(0);
  });
  it("solo le tre caratteristiche del background; niente doppioni", () => {
    expect(asiProblems(bgSpec, pk(["int", 2], ["dex", 1]), zeros)[0]).toMatch(/non consentita/);
    expect(asiProblems(bgSpec, pk(["str", 1], ["str", 1], ["con", 1]), zeros).join()).toMatch(/un solo aumento/);
  });
  it("tetto 20 (30 per i Doni epici): blocca se il risultato lo supera", () => {
    expect(asiProblems(bgSpec, pk(["str", 2], ["dex", 1]), S(19, 10, 10, 10, 10, 10))[0]).toMatch(/massimo \(20\)/);
    expect(asiProblems(bgSpec, pk(["str", 2], ["dex", 1]), S(18, 19, 10, 10, 10, 10))).toEqual([]);
    const epic = { allowed: ["str", "dex"] as never, mode: "plus1" as const, cap: 30 };
    expect(asiProblems(epic, pk(["str", 1]), S(29, 10, 10, 10, 10, 10))).toEqual([]);
    expect(asiProblems(epic, pk(["str", 1]), S(30, 10, 10, 10, 10, 10))[0]).toMatch(/massimo \(30\)/);
  });
  it("Aumento dei punteggi: +2 a una oppure +1 a due; altri talenti: +1 a una delle elencate", () => {
    const asi = { allowed: ["str", "dex", "con", "int", "wis", "cha"] as never, mode: "asi" as const, cap: 20 };
    expect(asiProblems(asi, pk(["wis", 2]), zeros)).toEqual([]);
    expect(asiProblems(asi, pk(["wis", 1], ["cha", 1]), zeros)).toEqual([]);
    expect(asiProblems(asi, pk(["wis", 1]), zeros)[0]).toMatch(/\+2 a una/);
    const plus1 = { allowed: ["str", "dex"] as never, mode: "plus1" as const, cap: 20 };
    expect(asiProblems(plus1, pk(["str", 1]), zeros)).toEqual([]);
    expect(asiProblems(plus1, pk(["str", 2]), zeros).join()).toMatch(/\+1 a una/);
    expect(asiProblems(plus1, pk(["wis", 1]), zeros)[0]).toMatch(/non consentita/);
  });
});
