import { describe, expect, it } from "vitest";
import { loadSrd } from "../data/srdIntegrity";
import { computeCharacter } from "../engine/compute";
import { emptyCharacter } from "../engine/character";
import { creationProgress, previewDecision, setBaseScores, setSecondClass, setStartLevel, setHpMode } from "../engine/creation";
import { autoComplete, finalizeCharacter } from "./logic";

// Multiclasse alla creazione: ogni coppia di classi si crea, si chiude e dà i livelli giusti
const R = loadSrd("en");
const gaming = [...R.tools.values()].find((t) => t.group === "gaming")?.id;
const all14 = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 };

function make(a: string, b: string, total: number, l2: number, scores = all14) {
  let ch = setStartLevel({ ...emptyCharacter("m"), name: "Prova", speciesId: "human", backgroundId: "soldier" }, R, total).character;
  ch = previewDecision(ch, R, "pick:class", [a]).character;
  const s = setSecondClass(ch, R, b, l2);
  expect(s.ok, s.errors.join()).toBe(true);
  ch = s.character;
  const sc = setBaseScores(ch, R, "manual", scores);
  expect(sc.ok).toBe(true);
  return autoComplete(sc.character, R);
}

describe("multiclasse alla creazione", () => {
  it("ogni coppia di classi: livello 5 diviso 3+2, si completa e si chiude", { timeout: 90_000 }, () => {
    for (const a of R.classes.keys()) for (const b of R.classes.keys()) {
      if (a === b) continue;
      const ch = make(a, b, 5, 2);
      const tag = `${a}+${b}`;
      expect(creationProgress(ch, R).steps.filter((s) => !s.complete), tag).toEqual([]);
      const fin = finalizeCharacter(ch, R, { gaming_set: gaming });
      expect(fin.errors, tag).toEqual([]);
      const d = computeCharacter(fin.character, R);
      expect(d.level, tag).toBe(5);
      expect(fin.character.classes.map((c) => c.level), tag).toEqual([3, 2]);
      expect(d.hp.max.value, tag).toBeGreaterThan(0);
      expect(d.warnings, tag).toEqual([]);
    }
  });
  it("il requisito 13 si controlla nel passo Classe (con i punteggi della serie standard il Guerriero+Mago non va)", () => {
    let ch = setStartLevel({ ...emptyCharacter("m"), name: "P", speciesId: "human", backgroundId: "soldier" }, R, 4).character;
    ch = previewDecision(ch, R, "pick:class", ["fighter"]).character;
    ch = setSecondClass(ch, R, "wizard", 2).character;
    ch = setBaseScores(ch, R, "manual", { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 }).character;
    expect(creationProgress(ch, R).steps.find((s) => s.step === "class")!.problems.join()).toMatch(/Mage|Mago|Wizard/i);
    expect(creationProgress(ch, R).complete).toBe(false);
  });
  it("la seconda classe si toglie, e cambiando livello o prima classe si riparte bene", () => {
    let ch = make("fighter", "rogue", 6, 3);
    expect(ch.classes.map((c) => c.level)).toEqual([3, 3]);
    ch = setStartLevel(ch, R, 4).character;
    expect(ch.classes.map((c) => c.level)).toEqual([1, 3]);
    ch = setStartLevel(ch, R, 1).character; // un livello solo: niente seconda classe
    expect(ch.classes).toHaveLength(1);
    ch = make("fighter", "rogue", 6, 3);
    ch = previewDecision(ch, R, "pick:class", ["cleric"]).character;
    expect(ch.classes.map((c) => `${c.classId}${c.level}`)).toEqual(["cleric3", "rogue3"]);
    ch = previewDecision(ch, R, "pick:class", ["rogue"]).character; // coincide con la seconda: resta una sola classe
    expect(ch.classes.map((c) => `${c.classId}${c.level}`)).toEqual(["rogue6"]);
    expect(setSecondClass(ch, R, null).character.classes).toHaveLength(1);
    expect(setSecondClass(ch, R, "rogue").ok).toBe(false);
  });
  it("PF a tiro: tira anche i livelli della seconda classe", () => {
    const ch = setHpMode(make("fighter", "rogue", 6, 3), R, "roll", () => 0.99);
    expect(ch.classes[0]!.hpRolls).toEqual([10, 10, 10]);
    expect(ch.classes[1]!.hpRolls).toEqual([8, 8, 8]);
  });
});
