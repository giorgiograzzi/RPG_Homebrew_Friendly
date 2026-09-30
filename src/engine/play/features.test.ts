import { describe, expect, it } from "vitest";
import { computeCharacter } from "../compute";
import { testCharacter, testRuleset } from "../compute/testkit";
import { characterSchema } from "../schema";
import type { Character } from "../types";
import { longRest, setActive, shortRest } from "./index";

// Barbaro di prova con: Ira (attivabile, con effetti, uso da tabella), un privilegio SOLO TESTO con contatore (Usi = mod Sag)
// e un privilegio con scelta all'attivazione (Rivelazione: ali o luce).
const F = (o: Record<string, unknown>) => ({ description: "", effects: [], choices: [], level: 1, needsReview: false, origin: "private", ...o }) as never;
function rulesetWithFeatures() {
  const rs = testRuleset();
  const barb = rs.classes.get("barbarian")!;
  barb.features.push(
    F({ id: "rage", name: { it: "Ira" }, description: "Resistenza e bonus ai danni.",
      usage: { uses: { table: [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6] }, recharge: "long_rest", partialShortRest: 1 },
      activation: { resource: "rage", requires: "!wearingArmor:heavy" },
      effects: [
        { op: "damageBonus", value: 2, attackType: "any", when: "active:rage && attackAbility:str" },
        { op: "resistance", types: ["bludgeoning", "piercing", "slashing"], when: "active:rage" },
        { op: "saveAdvantage", abilities: ["str"], when: "active:rage" },
        { op: "restriction", forbids: "spellcasting", when: "active:rage" },
      ] }),
    F({ id: "warding_flare", name: { it: "Bagliore protettivo" }, description: "Reazione. Usi = mod Sag (min 1) per Riposo Lungo.",
      usage: { uses: "max(1, mod:wis)", recharge: "long_rest" } }),
    F({ id: "revelation", name: { it: "Rivelazione" }, level: 3, usage: { uses: 1, recharge: "long_rest" },
      activation: { resource: "revelation", label: { it: "Aspetto" }, duration: "1 minuto", options: [
        { id: "wings", name: { it: "Ali" }, effects: [{ op: "setSpeed", mode: "fly", value: 30 }] },
        { id: "light", name: { it: "Luce" }, effects: [] },
      ] } }),
  );
  return rs;
}
const rs = rulesetWithFeatures();
const barb = (over: Partial<Character> = {}, level = 3) => testCharacter({
  classes: [{ classId: "barbarian", level, hpRolls: [] }], inventory: [{ itemId: "longsword", qty: 1, state: "wielded" }, { itemId: "shortbow", qty: 1, state: "stowed" }],
  ...over,
});
const on = (c: Character, id: string, picks: string[] = []) => {
  const r = setActive(c, rs, computeCharacter(c, rs), id, true, picks);
  return r;
};
const dmg = (c: Character, label: RegExp) => computeCharacter(c, rs).attacks.find((a) => label.test(a.label))!.damage.bonus.value;

describe("elenco dei privilegi", () => {
  it("descrizione, fonte, livello, contatori e attivazione", () => {
    const d = computeCharacter(barb(), rs);
    const rage = d.featureList.find((f) => f.id === "rage")!;
    expect(rage).toMatchObject({ name: "Ira", kind: "class", source: "barbarian", level: 1, resourceId: "rage", active: false, description: "Resistenza e bonus ai danni." });
    expect(rage.activation).toMatchObject({ resource: "rage", options: [] });
    expect(d.featureList.find((f) => f.id === "warding_flare")).toMatchObject({ resourceId: "warding_flare" });
  });
  it("i privilegi di livello più alto compaiono solo quando si sbloccano", () => {
    expect(computeCharacter(barb({}, 2), rs).featureList.map((f) => f.id)).not.toContain("revelation");
    expect(computeCharacter(barb({}, 3), rs).featureList.map((f) => f.id)).toContain("revelation");
  });
});

describe("contatori generici (privilegio solo testo)", () => {
  it("usage → risorsa con formula e ricarica", () => {
    const d = computeCharacter(barb(), rs);
    expect(d.resources.warding_flare).toMatchObject({ remaining: 1, recharge: "long_rest" });
    const strongWis = computeCharacter(barb({ baseScores: { str: 15, dex: 14, con: 13, int: 8, wis: 18, cha: 12 } }), rs);
    expect(strongWis.resources.warding_flare!.max.value).toBe(4); // mod Sag +4
    expect(d.resources.rage!.max.value).toBe(3); // tabella al 3° livello
  });
  it("si consumano e si ricaricano con il riposo giusto", () => {
    const used = barb({ state: { ...testCharacter().state, resourcesUsed: { warding_flare: 1, rage: 2 } } });
    const d = computeCharacter(used, rs);
    expect(shortRest(used, d).state.resourcesUsed).toEqual({ warding_flare: 1, rage: 2 }); // solo long_rest: il breve non li tocca
    expect(longRest(used, d).state.resourcesUsed).toEqual({});
  });
});

describe("stati attivabili: Ira", () => {
  it("da spenta non dà nulla; accesa: bonus ai danni con la Forza, resistenze, vantaggio ai TS, niente incantesimi", () => {
    const off = barb();
    expect(dmg(off, /longsword|Spada lunga/i)).toBe(2); // solo mod For (+2)
    expect(computeCharacter(off, rs).resistances).toEqual([]);
    const r = on(off, "rage");
    expect(r.ok).toBe(true);
    expect(dmg(r.character, /longsword|Spada lunga/i)).toBe(4);
    const d = computeCharacter(r.character, rs);
    expect(d.resistances).toEqual(expect.arrayContaining(["bludgeoning", "piercing", "slashing"]));
    expect(d.saves.str.mode).toBe("advantage");
    expect(d.spellcastingBlocked).toBe(true);
    expect(d.featureList.find((f) => f.id === "rage")!.active).toBe(true);
  });
  it("il bonus vale solo per gli attacchi con la Forza (non l'arco, che usa la Destrezza)", () => {
    const c = on(barb({ inventory: [{ itemId: "shortbow", qty: 1, state: "wielded" }] }), "rage").character;
    const bow = computeCharacter(c, rs).attacks.find((a) => a.kind === "ranged")!;
    expect(bow.ability).toBe("dex");
    expect(bow.damage.bonus.sources.some((s) => /Ira/.test(s.label))).toBe(false);
  });
  it("attivare consuma un uso; senza usi non si attiva; già attiva no; spegnere non restituisce l'uso", () => {
    const r = on(barb(), "rage");
    expect(r.character.state.resourcesUsed.rage).toBe(1);
    expect(on(r.character, "rage")).toMatchObject({ ok: false, errors: ["È già attivo"] });
    const off = setActive(r.character, rs, computeCharacter(r.character, rs), "rage", false);
    expect(off.character.state.active).toEqual({});
    expect(off.character.state.resourcesUsed.rage).toBe(1);
    const empty = barb({ state: { ...testCharacter().state, resourcesUsed: { rage: 3 } } });
    expect(on(empty, "rage")).toMatchObject({ ok: false, errors: ["Nessun uso rimasto"] });
  });
  it("con armatura pesante non si attiva", () => {
    const c = barb({ inventory: [{ itemId: "plate", qty: 1, state: "worn" }] });
    const r = on(c, "rage");
    expect(r.ok).toBe(false);
    expect(r.character.state.resourcesUsed.rage).toBeUndefined();
  });
  it("un privilegio che non si attiva dà errore; un riposo spegne gli stati", () => {
    expect(on(barb(), "warding_flare")).toMatchObject({ ok: false });
    const c = on(barb(), "rage").character;
    const d = computeCharacter(c, rs);
    expect(shortRest(c, d).state.active).toBeUndefined();
    expect(computeCharacter(shortRest(c, d), rs).resistances).toEqual([]);
    expect(longRest(c, d).state.active).toBeUndefined();
  });
});

describe("scelta per attivazione", () => {
  it("serve una scelta valida, viene salvata e applica gli effetti dell'opzione", () => {
    expect(on(barb(), "revelation")).toMatchObject({ ok: false, errors: [expect.stringContaining("Scegli")] });
    expect(on(barb(), "revelation", ["boh"]).ok).toBe(false);
    expect(on(barb(), "revelation", ["wings", "light"]).ok).toBe(false);
    const r = on(barb(), "revelation", ["wings"]);
    expect(r.ok).toBe(true);
    expect(r.character.state.active).toEqual({ revelation: ["wings"] });
    const d = computeCharacter(r.character, rs);
    expect(d.speed.fly.value).toBe(30);
    expect(d.featureList.find((f) => f.id === "revelation")).toMatchObject({ active: true, picked: ["wings"] });
    expect(computeCharacter(on(barb(), "revelation", ["light"]).character, rs).speed.fly.value).toBe(0);
  });
  it("lo stato attivo è valido per il formato di salvataggio", () => {
    const c = on(barb(), "revelation", ["wings"]).character;
    expect(characterSchema.safeParse(c).success).toBe(true);
  });
});
