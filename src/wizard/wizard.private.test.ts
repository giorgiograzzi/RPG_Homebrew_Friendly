import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeCharacter } from "../engine/compute";
import { classOptions, creationProgress, hpIsRolled, levelBand, levelStartingGold, previewDecision, rollStartingGold, setHpMode, setStartLevel } from "../engine/creation";
import { buildRuleset } from "../engine/ruleset";
import { emptyCharacter } from "../engine/character";
import { autoComplete, finalizeCharacter, isFinalized, reopenCreation } from "./logic";
import { levelUp } from "../engine/levelup";

// Gira solo dove esistono i dati privati (non tracciati)
const DIR = "data/private";
describe.skipIf(!existsSync(`${DIR}/creation.json`))("creazione completa con i dati veri (step 13)", () => {
  const R = buildRuleset(readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"))));
  const make = (classId: string, speciesId: string, backgroundId: string, name: string) => {
    const base = { ...emptyCharacter(`t-${classId}`), name, classes: [{ classId, level: 1, hpRolls: [] }], speciesId, backgroundId };
    return autoComplete(base, R);
  };

  for (const [classId, species, bg] of [["fighter", "human", "soldier"], ["wizard", "elf", "sage"], ["cleric", "dwarf", "acolyte"], ["rogue", "halfling", "criminal"]] as const) {
    it(`${classId}: dalle scelte al personaggio giocabile`, () => {
      const ch = make(classId, species, bg, `Prova ${classId}`);
      const prog = creationProgress(ch, R);
      expect(prog.steps.filter((s) => !s.complete), JSON.stringify(prog.steps.filter((s) => !s.complete))).toEqual([]);
      expect(prog.complete).toBe(true);
      const fin = finalizeCharacter(ch, R, { gaming_set: [...R.tools.values()].find((t) => t.group === "gaming")?.id });
      expect(fin.errors).toEqual([]);
      expect(isFinalized(fin.character)).toBe(true);
      const d = computeCharacter(fin.character, R);
      expect(d.hp.max.value).toBeGreaterThan(0);
      expect(fin.character.state.hp).toBe(d.hp.max.value);
      expect(d.ac.value).toBeGreaterThanOrEqual(10);
      expect(fin.character.inventory.length).toBeGreaterThan(0);
      expect(d.warnings).toEqual([]);
      // riaperta, la creazione torna modificabile senza perdere le scelte
      const re = reopenCreation(fin.character);
      expect(isFinalized(re)).toBe(false);
      expect(creationProgress(re, R).complete).toBe(true);
    });
  }
  it("il Mago ha slot e incantesimi dopo la creazione", () => {
    const fin = finalizeCharacter(make("wizard", "elf", "sage", "Mago"), R);
    const d = computeCharacter(fin.character, R);
    expect(d.spellSlots.slots[0]).toBe(2);
    expect(d.spellcasting[0]?.classId).toBe("wizard");
  });
  it("senza nome o con scelte mancanti non si può chiudere", () => {
    const ch = make("fighter", "human", "soldier", "");
    expect(finalizeCharacter(ch, R).ok).toBe(false);
    expect(finalizeCharacter({ ...ch, name: "X", decisions: {} }, R).ok).toBe(false);
  });
  it("le classi bloccate dal multiclasse hanno il motivo", () => {
    const ch = make("fighter", "human", "soldier", "F");
    expect(classOptions(ch, R).filter((o) => !o.enabled).every((o) => o.disabledReason)).toBe(true);
  });
  it("modifica: salire di livello a creazione riaperta tiene PF già tirati, equipaggiamento, monete e PF attuali", () => {
    const fin = finalizeCharacter(make("fighter", "human", "soldier", "Modifica"), R).character;
    const damaged = { ...fin, coins: { ...fin.coins, gp: 77 }, inventory: [...fin.inventory, { itemId: "dagger", qty: 3, state: "stowed" as const }], state: { ...fin.state, hp: 4 } };
    const editing = reopenCreation(damaged);
    expect(isFinalized(editing)).toBe(false);
    const up = levelUp(editing, R, "fighter", 3); // tiro del dado: 3
    expect(up.ok).toBe(true);
    const done = finalizeCharacter(autoComplete(up.character, R), R);
    expect(done.errors).toEqual([]);
    const c = done.character;
    expect(isFinalized(c)).toBe(true);
    expect(c.editing).toBe(false);
    expect(c.classes[0]!.level).toBe(2);
    expect(c.classes[0]!.hpRolls).toEqual([10, 3]); // il tiro resta (non torna alla media)
    expect(c.coins.gp).toBe(77);
    expect(c.inventory.find((i) => i.itemId === "dagger")?.qty).toBe(3);
    expect(c.inventory.length).toBe(damaged.inventory.length);
    const d = computeCharacter(c, R);
    expect(c.state.hp).toBe(4 + up.hpGain); // i PF attuali salgono dei PF guadagnati, non tornano al massimo
    expect(c.state.hp).toBeLessThanOrEqual(d.hp.max.value);
  });
  it("prima creazione: salire di livello nel riepilogo e poi chiudere dà i PF corretti", () => {
    const ch = make("wizard", "human", "sage", "Livello 2");
    const up = levelUp(ch, R, "wizard", "avg");
    const done = finalizeCharacter(autoComplete(up.character, R), R);
    expect(done.errors).toEqual([]);
    const d = computeCharacter(done.character, R);
    expect(d.level).toBe(2);
    expect(done.character.state.hp).toBe(d.hp.max.value);
    expect(done.character.classes[0]!.hpRolls).toEqual([6, "avg"]);
  });
});

describe.skipIf(!existsSync(`${DIR}/creation.json`))("passo 0: livello di partenza (step 17)", () => {
  const R = buildRuleset(readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"))));
  const start = (classId: string, level: number) => {
    const s = setStartLevel({ ...emptyCharacter(`s-${classId}-${level}`), name: `${classId} ${level}`, speciesId: "human", backgroundId: "soldier" }, R, level);
    expect(s.ok).toBe(true);
    const pick = previewDecision(s.character, R, "pick:class", [classId]);
    expect(pick.ok).toBe(true);
    return autoComplete(pick.character, R);
  };
  it("il livello scelto prima della classe vale per la classe; PX minimi del livello", () => {
    const c = start("cleric", 5);
    expect(c.classes[0]!.level).toBe(5);
    expect(c.startLevel).toBe(5);
    expect(c.xp).toBe(6500);
    expect(creationProgress(c, R).complete).toBe(true);
  });
  it("le 12 classi si creano complete a livello 1, 5, 11 e 20 direttamente dal passo 0", () => {
    for (const cid of R.classes.keys()) for (const L of [1, 5, 11, 20]) {
      const c = start(cid, L);
      const prog = creationProgress(c, R);
      expect(prog.complete, `${cid} ${L}: ${JSON.stringify(prog.steps.filter((s) => !s.complete))}`).toBe(true);
      const fin = finalizeCharacter(c, R, { gaming_set: [...R.tools.values()].find((t) => t.group === "gaming")?.id });
      expect(fin.errors, `${cid} ${L}`).toEqual([]);
      const d = computeCharacter(fin.character, R);
      expect(d.level).toBe(L);
      expect(d.hp.hitDice[0]!.total).toBe(L);
      expect(fin.character.classes[0]!.hpRolls).toHaveLength(L);
    }
  });
  it("PF: valore fisso o tiri (memorizzati), il 1° livello è sempre il massimo", () => {
    const c = start("fighter", 5);
    const avg = setHpMode(c, R, "avg");
    expect(avg.classes[0]!.hpRolls).toEqual([10, "avg", "avg", "avg", "avg"]);
    expect(hpIsRolled(avg)).toBe(false);
    const rolled = setHpMode(c, R, "roll", () => 0.5); // d10 → 6
    expect(rolled.classes[0]!.hpRolls).toEqual([10, 6, 6, 6, 6]);
    expect(hpIsRolled(rolled)).toBe(true);
    const fin = finalizeCharacter(rolled, R).character;
    expect(fin.classes[0]!.hpRolls).toEqual([10, 6, 6, 6, 6]); // la chiusura non li cambia
    const con = computeCharacter(fin, R).mods.con.value;
    expect(computeCharacter(fin, R).hp.max.value).toBe(10 + 4 * (6 + con) + con); // 1° livello: dado massimo + Cos; poi tiro (6) + Cos per livello
  });
  it("monete della fascia di livello: fisse + dado, tirate una volta; senza tiro solo le fisse", () => {
    const c = start("fighter", 5); // 500 mo + 1d10 × 25 mo
    expect(levelBand(R, 5)).toMatchObject({ gold: 500 });
    const base = finalizeCharacter(c, R).character;
    const rolled = rollStartingGold(c, R, () => 0.5); // 1d10 = 6 → 150
    expect(rolled.startingGold).toBe(650);
    const withRoll = finalizeCharacter(rolled, R).character;
    expect(withRoll.coins.gp - base.coins.gp).toBe(650 - 500);
    expect(base.coins.gp).toBeGreaterThanOrEqual(500);
    expect(levelStartingGold(start("fighter", 1), R)).toBe(0);
  });
  it("cambiare fascia di livello annulla il tiro delle monete; abbassare il livello annulla le scelte dei livelli persi", () => {
    const c = rollStartingGold(start("fighter", 5), R, () => 0);
    expect(c.startingGold).toBeDefined();
    const same = setStartLevel(c, R, 8); // stessa fascia (5-10)
    expect(same.character.startingGold).toBeDefined();
    const other = setStartLevel(c, R, 12);
    expect(other.character.startingGold).toBeUndefined();
    const high = start("fighter", 8);
    expect(Object.keys(high.decisions).some((k) => /asi_fighter_8/.test(k))).toBe(true);
    const down = setStartLevel(high, R, 3);
    expect(down.ok).toBe(true);
    expect(down.character.classes[0]!.level).toBe(3);
    expect(Object.keys(down.character.decisions).some((k) => /asi_fighter_(4|6|8)/.test(k))).toBe(false);
    expect(down.removed.length).toBeGreaterThan(0);
    expect(setStartLevel(c, R, 0).ok).toBe(false);
    expect(setStartLevel(c, R, 21).ok).toBe(false);
  });
  it("modifica: cambiare il livello di un personaggio già creato tiene equipaggiamento, monete e PF", () => {
    const fin = finalizeCharacter(start("wizard", 3), R).character;
    const edited = reopenCreation({ ...fin, coins: { ...fin.coins, gp: 99 }, state: { ...fin.state, hp: 5 } });
    const up = setStartLevel(edited, R, 5);
    const done = finalizeCharacter(autoComplete(up.character, R), R);
    expect(done.errors).toEqual([]);
    expect(done.character.classes[0]!.level).toBe(5);
    expect(done.character.coins.gp).toBe(99);
    expect(done.character.inventory.length).toBe(fin.inventory.length);
    expect(done.character.state.hp).toBe(5);
  });
});
