import { describe, expect, it } from "vitest";
import { computeCharacter } from "../compute";
import { testCharacter, testRuleset } from "../compute/testkit";
import { longRest, shortRest } from "../play";
import type { Character } from "../types";
import { castSpell, concentrationBroken, concentrationDc, endConcentration, magicalCunning, recoverSlots, spellbook } from "./index";

// Mago di prova: slot 4/3/2, trucchetto, due preparati, libro con un rituale e un incantesimo non preparato
function wizardRuleset() {
  const rs = testRuleset();
  const w = rs.classes.get("wizard")!;
  (w as { caster: string }).caster = "full";
  w.spellSlots = Array.from({ length: 20 }, () => [4, 3, 2]);
  w.choices.push(
    { id: "wizard_cantrips", label: { it: "Trucchetti" }, count: 1, source: "cantrips:wizard", distinct: true } as never,
    { id: "wizard_prepared", label: { it: "Preparati" }, count: 2, source: "spells:wizard", distinct: true } as never,
    { id: "wizard_spellbook", label: { it: "Libro" }, count: 4, source: "spells:wizard", distinct: true } as never,
  );
  w.features.push({ id: "arcane_recovery", name: { it: "Recupero arcano" }, level: 1, description: "", origin: "private", needsReview: false, choices: [],
    effects: [{ op: "resource", resourceId: "arcane_recovery", uses: 1, recharge: "long_rest" }] } as never);
  rs.spells.get("charm")!.higherLevels = "+1 creatura per slot.";
  rs.spells.get("bolt")!.concentration = true;
  rs.spells.get("ward")!.concentration = true;
  return rs;
}
const rs = wizardRuleset();
const wiz = (over: Partial<Character> = {}, level = 5): Character => testCharacter({
  classes: [{ classId: "wizard", level, hpRolls: [] }],
  decisions: { wizard_cantrips: ["spark"], wizard_prepared: ["charm", "ward"], wizard_spellbook: ["charm", "ward", "omen", "bolt"] }, ...over,
});
const cast = (c: Character, id: string, via: Parameters<typeof castSpell>[4]) => castSpell(c, rs, computeCharacter(c, rs), id, via);

describe("registro degli incantesimi", () => {
  it("fonti: trucchetto, preparati, libro; solo i non-libro sono lanciabili con slot", () => {
    const d = computeCharacter(wiz(), rs);
    const book = spellbook(wiz(), rs, d);
    const by = Object.fromEntries(book.map((e) => [e.id, e]));
    expect(by.spark!.sources[0]).toMatchObject({ kind: "cantrip", label: "wizard", ability: "int" });
    expect(by.charm!.castable).toBe(true);
    expect(by.omen!.castable).toBe(false); // solo nel libro
    expect(by.omen!.ritualOk).toBe(true); // ma il Mago lo lancia come rituale
    expect(by.bolt!.castable).toBe(false);
    expect(by.charm!.sources.map((s) => s.kind).sort()).toEqual(["book", "prepared"]);
    expect(by.charm!.sources[0]!.dc).toBe(d.spellcasting[0]!.dc.value);
    expect(book.map((e) => e.spell.level)).toEqual([...book.map((e) => e.spell.level)].sort((a, b) => a - b));
  });
  it("un rituale nel libro non è lanciabile come rituale da chi non è Mago", () => {
    // stesso libro ma la classe non è il Mago: solo se preparato
    const c = testCharacter({ classes: [{ classId: "cleric", level: 5, hpRolls: [] }], decisions: {} });
    expect(spellbook(c, rs, computeCharacter(c, rs))).toEqual([]);
  });
});

describe("lanciare", () => {
  it("il trucchetto è gratis; un incantesimo di 1° spende uno slot del livello scelto", () => {
    const c = wiz();
    expect(cast(c, "spark", { kind: "cantrip" })).toMatchObject({ ok: true });
    expect(cast(c, "spark", { kind: "cantrip" }).character.state.slotsUsed).toEqual({});
    const r = cast(c, "charm", { kind: "slot", level: 1 });
    expect(r.ok).toBe(true);
    expect(r.character.state.slotsUsed).toEqual({ 1: 1 });
    expect(r.level).toBe(1);
    expect(r.notes.join(" ")).toMatch(/un solo slot per lanciare/);
  });
  it("livello superiore: usa lo slot più alto e mostra la voce dell'incantesimo", () => {
    const r = cast(wiz(), "charm", { kind: "slot", level: 3 });
    expect(r.character.state.slotsUsed).toEqual({ 3: 1 });
    expect(r.notes.join(" ")).toMatch(/Livello superiore \(3°\): \+1 creatura/);
    expect(cast(wiz(), "bolt", { kind: "slot", level: 3 }).ok).toBe(false); // non preparato
  });
  it("rifiuta: slot troppo basso, esaurito, inesistente, trucchetto con slot, non preparato", () => {
    expect(cast(wiz(), "charm", { kind: "slot", level: 0 }).ok).toBe(false);
    const used = wiz({ state: { ...testCharacter().state, slotsUsed: { 3: 2 } } });
    expect(cast(used, "charm", { kind: "slot", level: 3 })).toMatchObject({ ok: false, errors: [expect.stringContaining("Nessuno slot di 3°")] });
    expect(cast(wiz(), "charm", { kind: "slot", level: 4 }).ok).toBe(false); // il Mago di prova non ha slot di 4°
    expect(cast(wiz(), "spark", { kind: "slot", level: 1 })).toMatchObject({ ok: false });
    expect(cast(wiz(), "omen", { kind: "slot", level: 1 })).toMatchObject({ ok: false, errors: [expect.stringContaining("Non è preparato")] });
    expect(cast(wiz(), "fireball", { kind: "cantrip" }).ok).toBe(false);
  });
  it("rituale: niente slot; serve preparato o nel libro del Mago; non per chi non è rituale", () => {
    const r = cast(wiz(), "omen", { kind: "ritual" });
    expect(r).toMatchObject({ ok: true });
    expect(r.character.state.slotsUsed).toEqual({});
    expect(r.notes.join(" ")).toMatch(/\+10 minuti/);
    expect(cast(wiz(), "charm", { kind: "ritual" })).toMatchObject({ ok: false, errors: ["Non è un rituale"] });
  });
  it("Concentrazione: una alla volta, la nuova termina la precedente; si può terminare a mano", () => {
    const a = cast(wiz(), "ward", { kind: "slot", level: 1 });
    expect(a.character.state.concentration).toBe("ward");
    const b = cast(a.character, "charm", { kind: "slot", level: 1 }); // charm non richiede concentrazione: resta ward
    expect(b.character.state.concentration).toBe("ward");
    const rs2 = rs.spells.get("bolt")!; rs2.concentration = true;
    const c2 = { ...wiz({ decisions: { wizard_cantrips: ["spark"], wizard_prepared: ["ward", "bolt"], wizard_spellbook: [] } }) };
    const one = cast(c2, "ward", { kind: "slot", level: 1 });
    const two = cast(one.character, "bolt", { kind: "slot", level: 3 });
    expect(two.character.state.concentration).toBe("bolt");
    expect(two.notes[0]).toMatch(/Termina la Concentrazione su ward/);
    expect(endConcentration(two.character).state.concentration).toBeUndefined();
  });
  it("blocchi: armatura senza addestramento e personaggio morto", () => {
    const heavy = wiz({ inventory: [{ itemId: "plate", qty: 1, state: "worn" }] });
    expect(cast(heavy, "spark", { kind: "cantrip" })).toMatchObject({ ok: false, errors: [expect.stringContaining("Non puoi lanciare")] });
    const dead = wiz({ state: { ...testCharacter().state, exhaustion: 6 } });
    expect(cast(dead, "spark", { kind: "cantrip" }).ok).toBe(false);
  });
});

describe("Concentrazione e danni", () => {
  it("CD = 10 o metà del danno (il più alto), massimo 30", () => {
    expect(concentrationDc(4)).toBe(10);
    expect(concentrationDc(20)).toBe(10);
    expect(concentrationDc(21)).toBe(10);
    expect(concentrationDc(22)).toBe(11);
    expect(concentrationDc(59)).toBe(29);
    expect(concentrationDc(200)).toBe(30);
  });
  it("termina se Incapacitato o morto", () => {
    expect(concentrationBroken(computeCharacter(wiz(), rs))).toBe(false);
    const inc = wiz({ state: { ...testCharacter().state, conditions: ["incapacitated"] } });
    expect(concentrationBroken(computeCharacter(inc, rs))).toBe(true);
    expect(concentrationBroken(computeCharacter(wiz({ state: { ...testCharacter().state, exhaustion: 6 } }), rs))).toBe(true);
  });
});

describe("recuperi", () => {
  const spent = (slots: Record<number, number>) => wiz({ state: { ...testCharacter().state, slotsUsed: slots } }); // Mago 5: metà = 3 livelli
  it("Recupero arcano: totale dei livelli ≤ metà del livello (per eccesso), nessuno slot 6°+, un uso", () => {
    const c = spent({ 1: 2, 2: 1 });
    const d = computeCharacter(c, rs);
    const ok = recoverSlots(c, d, "arcane_recovery", 5, [2, 1]);
    expect(ok.ok).toBe(true);
    expect(ok.character.state.slotsUsed).toEqual({ 1: 1 });
    expect(ok.character.state.resourcesUsed.arcane_recovery).toBe(1);
    expect(recoverSlots(c, d, "arcane_recovery", 5, [2, 2]).errors[0]).toMatch(/massimo è 3/); // e comunque non ne hai due di 2°
    expect(recoverSlots(c, d, "arcane_recovery", 5, [1, 1, 1]).errors[0]).toMatch(/Non hai abbastanza slot di 1°/);
    expect(recoverSlots(c, d, "arcane_recovery", 5, []).ok).toBe(false);
    expect(recoverSlots(c, d, "arcane_recovery", 5, [6]).errors[0]).toMatch(/fino al 5°/);
    const twice = recoverSlots(ok.character, computeCharacter(ok.character, rs), "arcane_recovery", 5, [1]);
    expect(twice).toMatchObject({ ok: false, errors: [expect.stringContaining("Nessun uso rimasto")] });
  });
  it("il riposo lungo ridà slot e usi; il breve non tocca gli slot normali", () => {
    const c = spent({ 1: 4, 3: 2 });
    const d = computeCharacter(c, rs);
    expect(shortRest(c, d).state.slotsUsed).toEqual({ 1: 4, 3: 2 });
    expect(longRest(c, d).state.slotsUsed).toEqual({});
  });
  it("Astuzia magica esiste solo con il suo privilegio", () => {
    expect(magicalCunning(wiz(), computeCharacter(wiz(), rs), 5)).toMatchObject({ ok: false });
  });
});
