import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeCharacter } from "../compute";
import { emptyCharacter } from "../character";
import { longRest, shortRest } from "../play";
import { buildRuleset } from "../ruleset";
import type { Character } from "../types";
import { autoComplete } from "../../wizard/logic";
import { castSpell, magicalCunning, recoverSlots, spellbook } from "./index";

// Gira solo dove esistono i dati privati (non tracciati): magie con i dati veri
const DIR = "data/private";
describe.skipIf(!existsSync(`${DIR}/spells.json`))("magie con i dati veri (step 16)", () => {
  const R = buildRuleset(readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"))));
  // personaggio creato dal wizard al 1° livello e poi portato al livello `level` (le scelte dei livelli superiori non servono qui)
  const make = (classId: string, species: string, bg: string, level = 1): Character => {
    const c = autoComplete({ ...emptyCharacter(`m-${classId}`), name: classId, classes: [{ classId, level: 1, hpRolls: [] }], speciesId: species, backgroundId: bg }, R);
    return { ...c, classes: c.classes.map((x) => ({ ...x, level })) };
  };
  const D = (c: Character) => computeCharacter(c, R);
  const cast = (c: Character, id: string, via: Parameters<typeof castSpell>[4]) => castSpell(c, R, D(c), id, via);

  it("Mago: trucchetti, preparati e libro con CD e attacco; un rituale del libro si lancia senza slot", () => {
    const c = make("wizard", "human", "sage");
    const book = spellbook(c, R, D(c));
    expect(book.some((e) => e.spell.level === 0)).toBe(true);
    const inBook = book.filter((e) => e.sources.some((s) => s.kind === "book"));
    expect(inBook.length).toBe(6);
    const dc = D(c).spellcasting[0]!.dc.value;
    expect(book[0]!.sources[0]).toMatchObject({ ability: "int", dc });
    const notPrepared = book.find((e) => !e.castable);
    if (notPrepared) expect(cast(c, notPrepared.id, { kind: "slot", level: 1 }).ok).toBe(false);
    const rit = inBook.find((e) => e.spell.ritual && !e.castable);
    if (rit) expect(cast(c, rit.id, { kind: "ritual" }).ok).toBe(true);
    const prepared = book.find((e) => e.castable && e.spell.level === 1)!;
    const r = cast(c, prepared.id, { kind: "slot", level: 1 });
    expect(r.ok).toBe(true);
    expect(D(r.character).spellSlots.remaining[0]).toBe(1); // 2 slot di 1° al 1° livello
  });
  it("Warlock: slot del Patto tutti dello stesso livello, tornano con un Riposo Breve", () => {
    const c = make("warlock", "human", "sage", 5); // 2 slot di 3° livello
    const d = D(c);
    expect(d.spellSlots.pact).toMatchObject({ count: 2, level: 3, used: 0, remaining: 2 });
    const spell = spellbook(c, R, d).find((e) => e.castable && e.spell.level >= 1 && e.spell.level <= 3)!;
    const a = cast(c, spell.id, { kind: "pact" });
    expect(a).toMatchObject({ ok: true, level: 3 });
    expect(D(a.character).spellSlots.pact).toMatchObject({ used: 1, remaining: 1 });
    const b = cast(a.character, spell.id, { kind: "pact" });
    expect(D(b.character).spellSlots.pact!.remaining).toBe(0);
    expect(cast(b.character, spell.id, { kind: "pact" }).ok).toBe(false);
    expect(D(shortRest(b.character, D(b.character))).spellSlots.pact!.remaining).toBe(2);
  });
  it("Astuzia magica: recupera metà degli slot del Patto (per eccesso) una volta per Riposo Lungo", () => {
    const c = make("warlock", "human", "sage", 5);
    const spent = { ...c, state: { ...c.state, pactUsed: 2 } };
    const r = magicalCunning(spent, D(spent), 5);
    expect(r.ok).toBe(true);
    expect(D(r.character).spellSlots.pact!.remaining).toBe(1);
    expect(magicalCunning(r.character, D(r.character), 5).ok).toBe(false); // un solo uso
    expect(D(longRest(r.character, D(r.character))).resources.magical_cunning!.remaining).toBe(1);
  });
  it("Recupero arcano del Mago di 5° livello: fino a 3 livelli di slot", () => {
    const c = make("wizard", "human", "sage", 5);
    const spent = { ...c, state: { ...c.state, slotsUsed: { 1: 3, 2: 1 } } };
    expect(D(spent).spellSlots.slots.slice(0, 3)).toEqual([4, 3, 2]);
    expect(recoverSlots(spent, D(spent), "arcane_recovery", 5, [2, 1]).ok).toBe(true);
    expect(recoverSlots(spent, D(spent), "arcane_recovery", 5, [2, 2]).ok).toBe(false);
  });
  it("Lancio gratuito di specie (Alto elfo): un contatore per incantesimo che si ricarica col Riposo Lungo", () => {
    const c = { ...make("fighter", "elf", "soldier", 5), decisions: { ...make("fighter", "elf", "soldier", 5).decisions, elven_lineage: ["high_elf"] } };
    const d = D(c);
    const free = spellbook(c, R, d).flatMap((e) => e.sources.filter((s) => s.free).map((s) => ({ e, s })));
    if (!free.length) return; // il lignaggio dipende dalle scelte automatiche
    const { e, s } = free[0]!;
    const r = cast(c, e.id, { kind: "free", resourceId: s.free!.resourceId });
    expect(r.ok).toBe(true);
    expect(r.character.state.resourcesUsed[s.free!.resourceId]).toBe(1);
    const again = cast(r.character, e.id, { kind: "free", resourceId: s.free!.resourceId });
    expect(again.ok).toBe(s.free!.max > 1);
    expect(D(longRest(r.character, D(r.character))).resources[s.free!.resourceId]!.remaining).toBe(s.free!.max);
  });
  it("Cavaliere mistico (terzo incantatore): Intelligenza da incantatore", () => {
    const c = { ...make("fighter", "human", "soldier", 3), classes: [{ classId: "fighter", level: 3, subclassId: "eldritch_knight", hpRolls: [] }] };
    expect(D(c).spellcasting.map((x) => x.ability)).toEqual(["int"]);
    expect(D(c).spellSlots.slots[0]).toBeGreaterThan(0);
  });
  it("preparare: cambiare gli incantesimi preparati del Chierico rispetta il numero e i livelli", async () => {
    const { choose } = await import("../../wizard/logic");
    const c = make("cleric", "human", "acolyte", 1);
    const key = "cleric_prepared";
    const q = (await import("../creation")).allQuestions(c, R).find((x) => x.key === key)!;
    const avail = q.options.filter((o) => o.enabled).map((o) => o.id);
    const swap = choose(c, R, key, avail.slice(0, q.count));
    expect(swap.ok).toBe(true);
    expect(choose(c, R, key, avail.slice(0, q.count + 1)).ok).toBe(false); // troppi
    const high = R.spells.values();
    const l3 = [...high].find((s) => s.level === 3 && s.classes.includes("cleric"))!;
    expect(choose(c, R, key, [l3.id]).ok).toBe(false); // nessuno slot di 3° al 1° livello
  });
});
