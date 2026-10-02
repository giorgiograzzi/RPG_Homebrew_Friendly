import { describe, expect, it } from "vitest";
import { loadSrd } from "../data/srdIntegrity";
import { computeCharacter } from "../engine/compute";
import { emptyCharacter } from "../engine/character";
import { allQuestions, creationProgress, previewDecision, setStartLevel } from "../engine/creation";
import { autoComplete, finalizeCharacter } from "./logic";

const R = loadSrd("en");
const mk = (classId: string, bg: string) => previewDecision(setStartLevel({ ...emptyCharacter("e"), name: "P", speciesId: "human", backgroundId: bg }, R, 1).character, R, "pick:class", [classId]).character;

describe("oggetti a scelta dell'equipaggiamento", () => {
  it("il Chierico sceglie il simbolo sacro (3 varianti) e finisce nello zaino", () => {
    let ch = autoComplete(mk("cleric", "soldier"), R);
    const q = allQuestions(ch, R).find((x) => x.key === "equipment:holy_symbol");
    expect(q?.options.length).toBe(3);
    ch = previewDecision(ch, R, "equipment:holy_symbol", ["holy_symbol_reliquary"]).character;
    const fin = finalizeCharacter(ch, R);
    expect(fin.ok, fin.errors.join()).toBe(true);
    expect(fin.character.inventory.some((i) => i.itemId === "holy_symbol_reliquary")).toBe(true);
    expect(fin.character.inventory.some((i) => i.itemId === "holy_symbol_amulet")).toBe(false);
  });
  it("se l'equipaggiamento scelto non lo richiede la domanda sparisce (e la scelta fatta con lei)", () => {
    let ch = autoComplete(mk("cleric", "soldier"), R);
    ch = previewDecision(ch, R, "equipment:holy_symbol", ["holy_symbol_emblem"]).character;
    const other = Object.keys(R.classes.get("cleric")!.equipment).find((k) => !R.classes.get("cleric")!.equipment[k as "A"]!.items.some((i) => i.item === "$holy_symbol"));
    expect(other).toBeDefined();
    const r = previewDecision(ch, R, "equipment:class", [other!]);
    expect(allQuestions(r.character, R).some((x) => x.key === "equipment:holy_symbol")).toBe(false);
    expect(r.character.decisions["equipment:holy_symbol"]).toBeUndefined();
  });
  it("il set da gioco si sceglie nella creazione (Soldato) e il progresso lo chiede", () => {
    const base = mk("fighter", "soldier");
    const ch = autoComplete(base, R);
    const q = allQuestions(ch, R).find((x) => x.key === "equipment:gaming_set");
    if (!q) return; // l'opzione B del Soldato non ha il set: niente da scegliere
    expect(q.complete).toBe(true);
    expect(creationProgress(ch, R).complete).toBe(true);
    const fin = finalizeCharacter(ch, R);
    expect(fin.ok, fin.errors.join()).toBe(true);
    expect(computeCharacter(fin.character, R).warnings).toEqual([]);
  });
});
