import { describe, expect, it } from "vitest";
import { loadSrd } from "../data/srdIntegrity";
import { emptyCharacter } from "../engine/character";
import { allQuestions, characterSize, creationProgress, previewDecision, setStartLevel } from "../engine/creation";
import { buildSheetData } from "../export/sheetData";
import { autoComplete, finalizeCharacter } from "./logic";

const R = loadSrd("en");
const base = (sp: string) => previewDecision(setStartLevel({ ...emptyCharacter("s"), name: "P", speciesId: sp, backgroundId: "soldier" }, R, 1).character, R, "pick:class", ["fighter"]).character;
const gaming = [...R.tools.values()].find((t) => t.group === "gaming")?.id;

describe("taglia a scelta", () => {
  it("Umano e Tiefling chiedono la taglia; le altre specie no", () => {
    for (const sp of R.species.values()) {
      const has = allQuestions(base(sp.id), R).some((q) => q.key === "size");
      expect(has, sp.id).toBe(sp.sizes.length > 1);
    }
  });
  it("senza scelta il passo Specie è incompleto; la taglia scelta arriva in scheda e nel PDF", () => {
    let ch = base("human");
    ch = autoComplete(ch, R);
    expect(creationProgress(ch, R).complete).toBe(true);
    expect(characterSize(ch, R)).toBe("medium"); // autoComplete sceglie la prima
    ch = previewDecision(ch, R, "size", ["small"]).character;
    expect(characterSize(ch, R)).toBe("small");
    const fin = finalizeCharacter(ch, R, { gaming_set: gaming });
    expect(fin.ok).toBe(true);
    expect(buildSheetData(fin.character, R, "en").size).toBe(R.sizes.get("small")!.name.it);
    const noPick = { ...ch, decisions: Object.fromEntries(Object.entries(ch.decisions).filter(([k]) => k !== "size")) };
    expect(creationProgress(noPick, R).steps.find((s) => s.step === "species")!.missing).toContain("size");
  });
});
