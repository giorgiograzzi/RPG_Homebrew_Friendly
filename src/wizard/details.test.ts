import { describe, expect, it } from "vitest";
import { loadSrd } from "../data/srdIntegrity";
import { migrateCharacter } from "../db/migrations";
import { emptyCharacter } from "../engine/character";
import { previewDecision, setStartLevel } from "../engine/creation";
import { buildSheetData } from "../export/sheetData";
import { autoComplete, finalizeCharacter } from "./logic";

const R = loadSrd("en");
const gaming = [...R.tools.values()].find((t) => t.group === "gaming")?.id;

describe("dettagli del personaggio", () => {
  it("sono facoltativi (la creazione si chiude senza), si salvano, e vanno sul PDF con le etichette della lingua", () => {
    let ch = previewDecision(setStartLevel({ ...emptyCharacter("d"), name: "Aria", speciesId: "elf", backgroundId: "sage" }, R, 1).character, R, "pick:class", ["wizard"]).character;
    ch = autoComplete(ch, R);
    expect(finalizeCharacter(ch, R, { gaming_set: gaming }).ok).toBe(true);
    expect(buildSheetData(finalizeCharacter(ch, R, { gaming_set: gaming }).character, R, "en").details).toEqual([]);
    ch = { ...ch, details: { player: "Giorgio", backstory: "  Cresciuta in una torre.  ", flaws: "" } };
    const fin = finalizeCharacter(ch, R, { gaming_set: gaming }).character;
    expect(buildSheetData(fin, R, "en").details).toEqual(["Player name: Giorgio", "Backstory: Cresciuta in una torre."]);
    expect(buildSheetData(fin, R, "it").details[0]).toBe("Nome del giocatore: Giorgio");
    const back = migrateCharacter(JSON.parse(JSON.stringify(fin)));
    expect(back.ok && back.character.details?.player).toBe("Giorgio");
    expect(migrateCharacter({ ...fin, details: { player: 5 } }).ok).toBe(false);
  });
});
