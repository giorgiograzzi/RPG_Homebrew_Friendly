import { describe, expect, it } from "vitest";
import { buildRuleset } from "../ruleset";
import {
  effectSchema, homebrewPackSchema, parseCondition, parseFormula, spellSchema, weaponSchema,
} from "./index";

describe("condizioni", () => {
  it("parsa atomi, not, and, or", () => {
    expect(parseCondition("wearingArmor:none && !shield")).toEqual({
      t: "and",
      items: [{ t: "wearingArmor", value: "none" }, { t: "not", item: { t: "shield" } }],
    });
    expect(parseCondition("level>=5").t).toBe("level");
    expect(parseCondition("classLevel:fighter>=3 || hasFeat:tough").t).toBe("or");
    expect(parseCondition("weaponProperty:finesse")).toEqual({ t: "weaponProperty", value: "finesse" });
    expect(parseCondition("equipped:greatsword")).toEqual({ t: "equipped", value: "greatsword" });
    expect(parseCondition("hasFeature:rage")).toEqual({ t: "hasFeature", value: "rage" });
    expect(parseCondition("trained:medium")).toEqual({ t: "trained", value: "medium" });
  });
  it("rifiuta condizioni sbagliate", () => {
    expect(() => parseCondition("wearingArmor:tutta")).toThrow();
    expect(() => parseCondition("boh")).toThrow();
    expect(() => parseCondition("ability:xyz>=13")).toThrow();
    expect(() => parseCondition("trained:tutte")).toThrow();
  });
});

describe("formule", () => {
  it("parsa", () => {
    expect(parseFormula("pb")).toEqual({ t: "var", name: "pb" });
    expect(parseFormula("max(1, mod:wis)").t).toBe("fn");
    expect(parseFormula("10 + mod:dex + mod:con").t).toBe("bin");
  });
  it("rifiuta", () => {
    expect(() => parseFormula("foo")).toThrow();
    expect(() => parseFormula("1 +")).toThrow();
    expect(() => parseFormula("2 $ 3")).toThrow();
  });
});

describe("effetti", () => {
  it("accetta esempi dei PDF", () => {
    const ok = [
      { op: "resistance", types: ["necrotic", "radiant"] },
      { op: "sense", kind: "darkvision", range: 60 },
      { op: "acFormula", formula: "10 + mod:dex + mod:con", shieldAllowed: true, when: "wearingArmor:none" },
      { op: "hpMaxPerLevel", value: 1 },
      { op: "grantSpell", spell: "light", mode: "cantrip", ability: "cha" },
      { op: "resource", resourceId: "healing_hands", uses: 1, recharge: "long_rest" },
      { op: "resource", resourceId: "rage", uses: { table: Array(20).fill(2) }, recharge: "long_rest", partialShortRest: 1 },
      { op: "checkBonus", value: "max(1, mod:wis)", skills: ["arcana", "religion"] },
    ];
    for (const e of ok) expect(effectSchema.safeParse(e).success, JSON.stringify(e)).toBe(true);
  });
  it("rifiuta op ignota, formula e condizione errate", () => {
    expect(effectSchema.safeParse({ op: "boh" }).success).toBe(false);
    expect(effectSchema.safeParse({ op: "acBonus", value: "x +" }).success).toBe(false);
    expect(effectSchema.safeParse({ op: "acBonus", value: 2, when: "???" }).success).toBe(false);
  });
});

const greatsword = {
  id: "greatsword", name: { it: "Spadone", en: "Greatsword" }, category: "martial", kind: "melee",
  damage: "2d6", damageType: "slashing", properties: ["heavy", "two_handed"], mastery: "graze",
  weight: 6, cost: 5000,
};

describe("contenuti e ruleset", () => {
  it("valida un'arma e un incantesimo", () => {
    expect(weaponSchema.safeParse(greatsword).success).toBe(true);
    expect(spellSchema.safeParse({
      id: "mending", name: { it: "Riparare" }, level: 0, school: "transmutation",
      classes: ["bard", "cleric"], castingTime: { unit: "minute" }, range: "Contatto",
      components: { v: true, s: true, m: true }, duration: "Istantanea", resolution: "none",
      summary: "Ripara una rottura.",
    }).success).toBe(true);
  });
  it("ruleset vuoto se non ci sono file (private/ assente)", () => {
    const rs = buildRuleset([]);
    expect(rs.weapons.size).toBe(0);
    expect(rs.errors).toEqual([]);
  });
  it("scarta le voci invalide e i duplicati senza bloccarsi", () => {
    const rs = buildRuleset([
      { kind: "weapons", entries: [greatsword, greatsword, { id: "rotta" }] },
      { kind: "boh", entries: [] },
    ]);
    expect(rs.weapons.size).toBe(1);
    expect(rs.errors).toHaveLength(3);
  });
  it("pacchetto homebrew versionato", () => {
    expect(homebrewPackSchema.safeParse({ schemaVersion: 1, name: "x", weapons: [greatsword] }).success).toBe(true);
    expect(homebrewPackSchema.safeParse({ schemaVersion: 2, name: "x" }).success).toBe(false);
  });
});
