import { describe, expect, it } from "vitest";
import { loadSrd } from "../data/srdIntegrity";
import { emptyCharacter } from "../engine/character";
import { previewDecision, setStartLevel } from "../engine/creation";

const R = loadSrd("en");
describe("abbassare il livello", () => {
  it("toglie la sottoclasse se il livello scende sotto quello della sottoclasse, e lo dice", () => {
    let ch = setStartLevel({ ...emptyCharacter("l"), name: "P", speciesId: "human", backgroundId: "soldier" }, R, 5).character;
    ch = previewDecision(ch, R, "pick:class", ["fighter"]).character;
    ch = previewDecision(ch, R, "subclass:fighter", ["champion"]).character;
    expect(ch.classes[0]!.subclassId).toBe("champion");
    expect(setStartLevel(ch, R, 3).character.classes[0]!.subclassId).toBe("champion"); // il Guerriero ha la sottoclasse al 3°
    const low = setStartLevel(ch, R, 2);
    expect(low.character.classes[0]!.subclassId).toBeUndefined();
    expect(low.removed.map((r) => r.key)).toContain("subclass:fighter");
  });
});
