import { describe, expect, it } from "vitest";
import { computeCharacter } from "../compute";
import { testCharacter, testRuleset } from "../compute/testkit";
import type { Character } from "../types";
import { levelFromXp, levelUp, levelUpOptions, rollHitDie, totalLevel, xpForLevel } from "./index";

const rs = testRuleset();
rs.classes.get("wizard")!.multiclassRequirement = "ability:int>=13";
rs.classes.get("fighter")!.multiclassRequirement = "ability:str>=13 || ability:dex>=13";
const fighter = (level = 1): Character => ({ ...testCharacter({ classes: [{ classId: "fighter", level, hpRolls: Array(level).fill("avg").map((v, i) => (i === 0 ? 10 : v)) }] }), state: { ...testCharacter().state, hp: 12 } });
// testCharacter: Cos 13 (+1), Des 14, For 15, Int 8, Sag 10, Car 12

describe("opzioni di livello", () => {
  it("classi che hai e nuove; il multiclasse chiede 13 sia nella classe attuale sia nella nuova", () => {
    const o = levelUpOptions(fighter(), rs);
    expect(o.find((x) => x.classId === "fighter")).toMatchObject({ isNew: false, level: 2, enabled: true });
    expect(o.find((x) => x.classId === "wizard")).toMatchObject({ isNew: true, level: 1, enabled: false, reason: expect.stringContaining("Intelligenza") });
    expect(o.find((x) => x.classId === "barbarian")).toMatchObject({ isNew: true, enabled: true });
    const smart = { ...fighter(), baseScores: { ...fighter().baseScores, int: 14 } };
    expect(levelUpOptions(smart, rs).find((x) => x.classId === "wizard")!.enabled).toBe(true);
    // la classe che hai già richiede ancora 13 per lasciarla
    const weak = { ...smart, baseScores: { ...smart.baseScores, str: 10, dex: 10 } };
    expect(levelUpOptions(weak, rs).find((x) => x.classId === "wizard")).toMatchObject({ enabled: false, reason: expect.stringContaining("Per lasciare") });
  });
  it("niente oltre il 20° livello totale", () => {
    expect(levelUpOptions(fighter(20), rs)).toEqual([]);
    expect(levelUp(fighter(20), rs, "fighter").ok).toBe(false);
    const mixed = { ...fighter(19), classes: [{ classId: "fighter", level: 10, hpRolls: [] }, { classId: "barbarian", level: 9, hpRolls: [] }] };
    expect(totalLevel(mixed)).toBe(19);
    expect(levelUp(mixed, rs, "barbarian").ok).toBe(true);
    expect(levelUp(levelUp(mixed, rs, "barbarian").character, rs, "fighter").ok).toBe(false);
  });
});

describe("salire di livello", () => {
  it("PF con valore fisso: dado/2+1 + mod Cos; il PF attuale sale dello stesso valore", () => {
    const r = levelUp(fighter(1), rs, "fighter", "avg");
    expect(r).toMatchObject({ ok: true, classLevel: 2, total: 2, hpDie: 10, hpGain: 7, isNew: false }); // d10 fisso 6 + Cos 1
    expect(r.hpMaxAfter - r.hpMaxBefore).toBe(7);
    expect(r.character.state.hp).toBe(12 + 7);
    expect(r.character.classes[0]).toMatchObject({ level: 2 });
    expect(r.character.classes[0]!.hpRolls).toEqual([10, "avg"]);
    expect(computeCharacter(r.character, rs).hp.max.value).toBe(r.hpMaxAfter);
  });
  it("PF con il tiro: 1..dado; minimo 1 per livello anche con Cos negativa", () => {
    const r = levelUp(fighter(1), rs, "fighter", 3);
    expect(r.hpGain).toBe(4); // 3 + Cos 1
    expect(levelUp(fighter(1), rs, "fighter", 0).ok).toBe(false);
    expect(levelUp(fighter(1), rs, "fighter", 11).ok).toBe(false);
    const frail = { ...fighter(1), baseScores: { ...fighter().baseScores, con: 3 } }; // Cos -4
    expect(levelUp(frail, rs, "fighter", 1).hpGain).toBe(1);
  });
  it("il bonus di competenza sale dal livello totale (5° livello)", () => {
    const r = levelUp(fighter(4), rs, "fighter");
    expect(r).toMatchObject({ pbBefore: 2, pbAfter: 3, classLevel: 5 });
  });
  it("nuova classe (multiclasse): primo livello con tiro o valore fisso, mai il massimo; i TS non si aggiungono", () => {
    const r = levelUp(fighter(3), rs, "monk", "avg"); // d8 fisso 5 + Cos 1
    expect(r).toMatchObject({ ok: true, isNew: true, classLevel: 1, total: 4, hpDie: 8, hpGain: 6 });
    expect(r.character.classes[1]).toEqual({ classId: "monk", level: 1, hpRolls: ["avg"] });
    const d = computeCharacter(r.character, rs);
    expect(d.hp.hitDice).toEqual([{ die: 8, total: 1 }, { die: 10, total: 3 }]);
    expect(d.saves.dex.proficient).toBe(false); // il Monaco (For, Des) non aggiunge il TS Des: i TS li dà solo la prima classe
    expect(d.saves.str.proficient).toBe(true);
  });
  it("rifiuta il multiclasse senza i requisiti, con il motivo", () => {
    const r = levelUp(fighter(3), rs, "wizard");
    expect(r).toMatchObject({ ok: false, errors: [expect.stringContaining("Intelligenza")] });
  });
  it("hpRolls più corti del livello vengono completati con il valore fisso", () => {
    const c = { ...fighter(3), classes: [{ classId: "fighter", level: 3, hpRolls: [10] }] };
    expect(levelUp(c, rs, "fighter").character.classes[0]!.hpRolls).toEqual([10, "avg", "avg", "avg"]);
  });
  it("il tiro del dado usa il generatore dato", () => {
    expect(rollHitDie(10, () => 0)).toBe(1);
    expect(rollHitDie(10, () => 0.999)).toBe(10);
    expect(rollHitDie(6, () => 0.5)).toBe(4);
  });
});

describe("punti esperienza", () => {
  it("livello dai PX e soglia del prossimo", () => {
    expect(levelFromXp(rs, 0)).toBe(1);
    expect(levelFromXp(rs, 299)).toBe(1);
    expect(levelFromXp(rs, 300)).toBe(2);
    expect(levelFromXp(rs, 355000)).toBe(20);
    expect(levelFromXp(rs, 999999)).toBe(20);
    expect(xpForLevel(rs, 5)).toBe(6500);
    expect(xpForLevel(rs, 21)).toBeNull();
  });
});
