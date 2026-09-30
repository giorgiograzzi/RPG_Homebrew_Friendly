import { describe, expect, it } from "vitest";
import { computeCharacter } from "../compute";
import { testCharacter, testRuleset } from "../compute/testkit";
import type { Character } from "../types";
import {
  applyDamage, applyHealing, deathSave, hitDiceList, isDead, isDying, isStable, longRest, nextHitDie, rollD20, rollExpr, setCoins, setCondition,
  setExhaustion, setOverride, setTempHp, shortRest, spendHitDie, stabilize, toggleSlot, useResource,
} from "./index";

const rs = testRuleset();
const seq = (...n: number[]) => { let i = 0; return () => n[i++ % n.length]!; }; // rng: valori 0..1
const ch = (state: Partial<Character["state"]> = {}, over: Partial<Character> = {}) => { const c = testCharacter(over); return { ...c, state: { ...c.state, hp: 12, ...state } }; };

describe("dadi", () => {
  it("d20 con vantaggio/svantaggio tiene il più alto/basso", () => {
    const rng = seq(0.5, 0.05); // 11, 2
    expect(rollD20(3, "advantage", rng)).toMatchObject({ dice: [11, 2], natural: 11, total: 14 });
    expect(rollD20(3, "disadvantage", seq(0.5, 0.05))).toMatchObject({ natural: 2, total: 5 });
    expect(rollD20(0, "normal", seq(0.99))).toMatchObject({ natural: 20, crit: true });
    expect(rollD20(0, "normal", seq(0))).toMatchObject({ natural: 1, fumble: true });
  });
  it("espressioni di danno", () => {
    expect(rollExpr("2d6 + 3", seq(0.99, 0))).toMatchObject({ rolls: [6, 1], bonus: 3, total: 10 });
    expect(rollExpr("1d8 - 1", seq(0))).toMatchObject({ total: 0 });
    expect(rollExpr("d20", seq(0.5))?.total).toBe(11);
    expect(rollExpr("5")?.total).toBe(5);
    expect(rollExpr("2d6", seq(0.99, 0.99), { crit: true })?.rolls).toHaveLength(4); // critico: dadi doppi
    expect(rollExpr("abc")).toBeNull();
  });
});

describe("PF, PF temporanei e morte", () => {
  it("i PF temporanei assorbono per primi", () => {
    const r = applyDamage(ch({ hp: 12, tempHp: 5 }), 12, 8);
    expect(r.character.state).toMatchObject({ hp: 9, tempHp: 0 });
    expect(r.absorbed).toBe(5);
    expect(applyDamage(ch({ tempHp: 5 }), 12, 3).character.state).toMatchObject({ hp: 12, tempHp: 2 });
  });
  it("PF temporanei: non si sommano, vale il più alto (o si sostituisce a mano)", () => {
    expect(setTempHp(ch({ tempHp: 5 }), 3).state.tempHp).toBe(5);
    expect(setTempHp(ch({ tempHp: 5 }), 8).state.tempHp).toBe(8);
    expect(setTempHp(ch({ tempHp: 5 }), 2, true).state.tempHp).toBe(2);
  });
  it("a 0 PF si cade privi di sensi e si guarisce tornando su", () => {
    const r = applyDamage(ch({ hp: 5 }), 12, 6);
    expect(r).toMatchObject({ downed: true, dead: false });
    expect(r.character.state.conditions).toContain("unconscious");
    expect(isDying(r.character)).toBe(true);
    const healed = applyHealing(r.character, 12, 4);
    expect(healed.state.hp).toBe(4);
    expect(healed.state.conditions).not.toContain("unconscious");
    expect(healed.state.deathSaves).toEqual({ successes: 0, failures: 0 });
  });
  it("una condizione 'privo di sensi' messa a mano non viene tolta dalla cura", () => {
    const c = ch({ hp: 5, conditions: ["unconscious"] });
    expect(applyHealing(applyDamage(c, 12, 5).character, 12, 3).state.conditions).toContain("unconscious");
  });
  it("morte istantanea: danno rimasto pari ai PF massimi", () => {
    const r = applyDamage(ch({ hp: 5 }), 12, 5 + 12);
    expect(r).toMatchObject({ dead: true });
    expect(isDead(r.character)).toBe(true);
    expect(applyDamage(ch({ hp: 5 }), 12, 5 + 11).dead).toBe(false);
  });
  it("colpo a 0 PF = salvezza fallita (2 se critico); danno pari ai PF massimi = morte", () => {
    const down = applyDamage(ch({ hp: 1 }), 12, 5).character;
    expect(applyDamage(down, 12, 3).character.state.deathSaves.failures).toBe(1);
    expect(applyDamage(down, 12, 3, { crit: true }).character.state.deathSaves.failures).toBe(2);
    expect(applyDamage(down, 12, 12).dead).toBe(true);
    expect(applyDamage({ ...down, state: { ...down.state, tempHp: 4 } }, 12, 3).character.state.deathSaves.failures).toBe(0); // assorbito
  });
  it("cura oltre il massimo si ferma al massimo; da morto non si cura", () => {
    expect(applyHealing(ch({ hp: 10 }), 12, 99).state.hp).toBe(12);
    const dead = ch({ hp: 0, deathSaves: { successes: 0, failures: 3 } });
    expect(applyHealing(dead, 12, 5).state.hp).toBe(0);
  });
  it("salvezze contro morte", () => {
    let c = ch({ hp: 0 });
    const a = deathSave(c, 12); expect(a).toMatchObject({ outcome: "success" }); expect(a.character.state.deathSaves.successes).toBe(1);
    expect(deathSave(c, 9).character.state.deathSaves.failures).toBe(1);
    expect(deathSave(c, 1)).toMatchObject({ outcome: "critical_failure" });
    expect(deathSave(c, 1).character.state.deathSaves.failures).toBe(2);
    c = deathSave(deathSave(deathSave(c, 15).character, 15).character, 15).character;
    expect(isStable(c)).toBe(true);
    expect(isDying(c)).toBe(false);
    const crit = deathSave(ch({ hp: 0, deathSaves: { successes: 1, failures: 2 } }), 20);
    expect(crit.character.state).toMatchObject({ hp: 1, deathSaves: { successes: 0, failures: 0 } });
    expect(deathSave(ch({ hp: 0, deathSaves: { successes: 0, failures: 2 } }), 3).dead).toBe(true);
    expect(stabilize(ch({ hp: 0 })).state.deathSaves.successes).toBe(3);
  });
  it("Esaurimento al livello 6 è morte", () => {
    expect(isDead(setExhaustion(ch(), 6))).toBe(true);
    expect(setExhaustion(ch(), 9).state.exhaustion).toBe(6);
    expect(setExhaustion(ch(), -2).state.exhaustion).toBe(0);
  });
});

describe("riposi", () => {
  const c = () => ch({ hp: 3, tempHp: 4, hitDiceUsed: 1, resourcesUsed: { second_wind: 1 }, slotsUsed: { 1: 2 }, exhaustion: 2, conditions: ["poisoned"] });
  it("Dadi Vita: tiro + mod Cos, si consuma il contatore", () => {
    const start = ch({ hp: 3 }, { classes: [{ classId: "fighter", level: 3, hpRolls: [] }] });
    const d = computeCharacter(start, rs);
    expect(hitDiceList(d)).toHaveLength(3);
    expect(nextHitDie(start, d)).toBe(10);
    const r = spendHitDie(start, d, 6)!;
    expect(r.healed).toBe(6 + d.mods.con.value);
    expect(r.character.state.hitDiceUsed).toBe(1);
    expect(r.character.state.hp).toBe(3 + r.healed);
    expect(spendHitDie({ ...start, state: { ...start.state, hitDiceUsed: 3 } }, d, 6)).toBeNull();
  });
  it("il riposo breve ricarica solo le risorse 'short_rest'", () => {
    const d = computeCharacter(c(), rs);
    const r = shortRest(c(), d);
    expect(r.state.resourcesUsed.second_wind).toBeUndefined();
    expect(r.state.slotsUsed[1]).toBe(2); // gli slot normali no
    expect(r.state.hp).toBe(3);
    expect(r.state.exhaustion).toBe(2);
  });
  it("il riposo lungo: PF, dadi vita (metà, min 1), risorse, slot, Esaurimento -1", () => {
    const start = { ...c(), classes: [{ classId: "fighter", level: 4, hpRolls: [] }] };
    const s = { ...start, state: { ...start.state, hitDiceUsed: 4 } };
    const d = computeCharacter(s, rs);
    const r = longRest(s, d);
    expect(r.state).toMatchObject({ hp: d.hp.max.value, tempHp: 0, hitDiceUsed: 2, exhaustion: 1, slotsUsed: {}, resourcesUsed: {} });
    expect(r.state.conditions).toEqual(["poisoned"]); // le condizioni non spariscono da sole
    const one = longRest({ ...c(), state: { ...c().state, hitDiceUsed: 1 } }, computeCharacter(c(), rs));
    expect(one.state.hitDiceUsed).toBe(0); // liv 1: recupera almeno 1
  });
  it("il riposo lungo toglie il privo di sensi da 0 PF, non quello messo a mano", () => {
    const down = applyDamage(ch({ hp: 2 }), 12, 5).character;
    expect(longRest(down, computeCharacter(down, rs)).state.conditions).toEqual([]);
    const manual = ch({ conditions: ["unconscious"] });
    expect(longRest(manual, computeCharacter(manual, rs)).state.conditions).toEqual(["unconscious"]);
  });
});

describe("stato di gioco", () => {
  it("condizioni: aggiunte una volta, fonte ricordata, Esaurimento a parte", () => {
    const a = setCondition(ch(), rs, "frightened", true, "il drago");
    expect(a.state.conditions).toEqual(["frightened"]);
    expect(a.state.conditionSources).toEqual({ frightened: "il drago" });
    expect(setCondition(a, rs, "frightened", true).state.conditions).toEqual(["frightened"]);
    const b = setCondition(a, rs, "frightened", false);
    expect(b.state.conditions).toEqual([]);
    expect(b.state.conditionSources).toEqual({});
    expect(setCondition(ch(), rs, "exhaustion", true).state.conditions).toEqual([]); // a livelli
    expect(setCondition(ch(), rs, "nonesiste", true).state.conditions).toEqual([]);
  });
  it("risorse e slot: mai sotto zero né oltre il massimo", () => {
    expect(useResource(ch(), "second_wind", 2, 1).state.resourcesUsed).toEqual({ second_wind: 1 });
    expect(useResource(useResource(ch(), "second_wind", 2, 5), "second_wind", 2, 1).state.resourcesUsed).toEqual({ second_wind: 2 });
    expect(useResource(ch({ resourcesUsed: { x: 1 } }), "x", 2, -1).state.resourcesUsed).toEqual({});
    expect(toggleSlot(ch(), 1, 2, 3).state.slotsUsed).toEqual({ 1: 2 });
    expect(toggleSlot(ch({ slotsUsed: { 1: 1 } }), 1, 2, -1).state.slotsUsed).toEqual({});
  });
  it("valori forzati: applicati dal motore e rimovibili", () => {
    const c = setOverride(ch(), "ac", 21);
    expect(computeCharacter(c, rs).ac.value).toBe(21);
    expect(computeCharacter(c, rs).ac.sources[0]?.label).toMatch(/forzato/i);
    expect(computeCharacter(setOverride(c, "ac", undefined), rs).ac.value).not.toBe(21);
    expect(setOverride(ch(), "hp.max", 40).overrides).toEqual({ "hp.max": 40 });
  });
  it("monete non negative", () => {
    expect(setCoins(ch(), { gp: -5, sp: 3.9 }).coins).toMatchObject({ gp: 0, sp: 3 });
  });
});
