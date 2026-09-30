import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeCharacter } from "../compute";
import { emptyCharacter } from "../character";
import { buildRuleset } from "../ruleset";
import type { Character } from "../types";
import { longRest, setActive, useResource } from "./index";

// Gira solo dove esistono i dati privati (non tracciati): privilegi attivabili e contatori dei dati veri
const DIR = "data/private";
describe.skipIf(!existsSync(`${DIR}/classes.json`))("privilegi giocabili con i dati veri (step 14b)", () => {
  const R = buildRuleset(readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"))));
  const mk = (over: Partial<Character>): Character => ({ ...emptyCharacter("t"), baseScores: { str: 16, dex: 12, con: 14, int: 8, wis: 16, cha: 10 }, ...over });
  const barbarian = (level: number) => mk({ classes: [{ classId: "barbarian", level, hpRolls: [] }], inventory: [{ itemId: "greataxe", qty: 1, state: "wielded" }] });
  const axe = (c: Character) => computeCharacter(c, R).attacks.find((a) => a.weaponId === "greataxe")!;
  const on = (c: Character, id: string, picks: string[] = []) => { const r = setActive(c, R, computeCharacter(c, R), id, true, picks); expect(r.errors, r.errors.join()).toEqual([]); return r.character; };

  it("Ira: bonus ai danni della colonna Danno ira (+2, +3 al 9°, +4 al 16°), resistenze e niente incantesimi", () => {
    for (const [lv, bonus] of [[1, 2], [8, 2], [9, 3], [15, 3], [16, 4], [20, 4]] as const) {
      const c = barbarian(lv);
      const before = axe(c).damage.bonus.value;
      const raging = on(c, "rage");
      expect(axe(raging).damage.bonus.value - before, `livello ${lv}`).toBe(bonus);
    }
    const d = computeCharacter(on(barbarian(1), "rage"), R);
    expect(d.resistances).toEqual(expect.arrayContaining(["bludgeoning", "piercing", "slashing"]));
    expect(d.saves.str.mode).toBe("advantage");
    expect(d.spellcastingBlocked).toBe(true);
    expect(computeCharacter(barbarian(1), R).resistances).toEqual([]);
  });
  it("Ira: 2 usi al 1° livello; ogni attivazione ne consuma uno; il riposo lungo li ripristina e spegne l'Ira", () => {
    let c = on(barbarian(1), "rage");
    expect(computeCharacter(c, R).resources.rage).toMatchObject({ max: { value: 2 }, remaining: 1 });
    c = { ...c, state: { ...c.state, active: {} } };
    c = on(c, "rage");
    expect(computeCharacter(c, R).resources.rage!.remaining).toBe(0);
    c = { ...c, state: { ...c.state, active: {} } };
    expect(setActive(c, R, computeCharacter(c, R), "rage", true).errors).toEqual(["Nessun uso rimasto"]);
    expect(computeCharacter(longRest(on(barbarian(1), "rage"), computeCharacter(barbarian(1), R)), R).resources.rage!.remaining).toBe(2);
  });
  it("Ira con armatura pesante: non si attiva", () => {
    const c = { ...barbarian(1), inventory: [{ itemId: "plate", qty: 1, state: "worn" as const }, ...barbarian(1).inventory] };
    expect(setActive(c, R, computeCharacter(c, R), "rage", true).ok).toBe(false);
  });
  it("Rivelazione celestiale (Aasimar): scelta all'attivazione salvata, con volo solo per le Ali", () => {
    const c = mk({ classes: [{ classId: "fighter", level: 3, hpRolls: [] }], speciesId: "aasimar" });
    const d = computeCharacter(c, R);
    const f = d.featureList.find((x) => x.id === "celestial_revelation")!;
    expect(f.activation!.options.map((o) => o.id)).toEqual(["celestial_wings", "inner_radiance", "necrotic_shroud"]);
    expect(setActive(c, R, d, "celestial_revelation", true).ok).toBe(false); // serve la scelta
    const wings = on(c, "celestial_revelation", ["celestial_wings"]);
    expect(wings.state.active).toEqual({ celestial_revelation: ["celestial_wings"] });
    expect(computeCharacter(wings, R).speed.fly.value).toBe(30);
    expect(computeCharacter(on(c, "celestial_revelation", ["inner_radiance"]), R).speed.fly.value).toBe(0);
    expect(computeCharacter(c, R).speed.fly.value).toBe(0);
  });
  it("Volo draconico, Forma grande, Forma selvatica: attivabili con il loro uso", () => {
    const dragon = on(mk({ classes: [{ classId: "fighter", level: 5, hpRolls: [] }], speciesId: "dragonborn" }), "draconic_flight");
    expect(computeCharacter(dragon, R).speed.fly.value).toBe(30);
    const big = mk({ classes: [{ classId: "fighter", level: 5, hpRolls: [] }], speciesId: "goliath" });
    expect(computeCharacter(on(big, "large_form"), R).speed.walk.value).toBe(computeCharacter(big, R).speed.walk.value + 10);
    const druid = mk({ classes: [{ classId: "druid", level: 2, hpRolls: [] }] });
    expect(computeCharacter(on(druid, "wild_shape"), R).featureList.find((f) => f.id === "wild_shape")!.active).toBe(true);
  });
  it("Contatore su un privilegio solo testo: Bagliore protettivo (Usi = mod Sag, min 1)", () => {
    const c = mk({ classes: [{ classId: "cleric", level: 3, subclassId: "light", hpRolls: [] }] }); // Sag 16 → +3
    const d = computeCharacter(c, R);
    const f = d.featureList.find((x) => x.id === "warding_flare")!;
    expect(f).toMatchObject({ kind: "subclass", resourceId: "warding_flare" });
    expect(f.description).toMatch(/mod Sag/);
    expect(d.resources.warding_flare).toMatchObject({ max: { value: 3 }, remaining: 3, recharge: "long_rest" });
    const used = computeCharacter(useResource(c, "warding_flare", 3, 2), R);
    expect(used.resources.warding_flare!.remaining).toBe(1);
    const weak = mk({ baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 8, cha: 10 }, classes: [{ classId: "cleric", level: 3, subclassId: "light", hpRolls: [] }] });
    expect(computeCharacter(weak, R).resources.warding_flare!.max.value).toBe(1); // min 1 scritto nel testo
  });
  it("nessun nome di tratto contiene l'intestazione della tabella (errore dell'estrazione delle specie)", () => {
    const names = [...R.species.values()].flatMap((s) => s.traits.map((t) => t.name.it));
    expect(names.filter((n) => /Livello Effetto|^Tratto /.test(n))).toEqual([]);
  });
  it("ogni feature con un contatore ha un id di risorsa e i dati non hanno privilegi senza descrizione", () => {
    const all = [...R.classes.values()].flatMap((c) => c.features).concat([...R.subclasses.values()].flatMap((s) => s.features));
    for (const f of all.filter((x) => x.usage)) expect(f.description.length, f.id).toBeGreaterThan(0);
  });
});
