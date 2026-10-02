import { describe, expect, it } from "vitest";
import { loadSrd } from "../data/srdIntegrity";
import { computeCharacter } from "../engine/compute";
import { emptyCharacter } from "../engine/character";
import { creationProgress, previewDecision, setStartLevel } from "../engine/creation";
import { autoComplete, finalizeCharacter } from "./logic";

// Ogni voce dei dati SRD si può creare: classe × sottoclasse × specie × background, a livello 1 e a livello 5
const R = loadSrd("en");
const gamingSet = [...R.tools.values()].find((t) => t.group === "gaming")?.id;

function create(classId: string, speciesId: string, backgroundId: string, level: number, subclassId?: string) {
  const s = setStartLevel({ ...emptyCharacter(`c-${classId}-${speciesId}-${backgroundId}-${level}`), name: "Prova", speciesId, backgroundId }, R, level);
  expect(s.ok).toBe(true);
  let ch = previewDecision(s.character, R, "pick:class", [classId]).character;
  if (subclassId) { const r = previewDecision(ch, R, `subclass:${classId}`, [subclassId]); expect(r.errors, `${classId}/${subclassId}`).toEqual([]); ch = r.character; }
  ch = autoComplete(ch, R);
  const prog = creationProgress(ch, R);
  const tag = `${classId}/${subclassId ?? "-"}/${speciesId}/${backgroundId}/L${level}`;
  expect(prog.steps.filter((x) => !x.complete), tag).toEqual([]);
  const fin = finalizeCharacter(ch, R, { gaming_set: gamingSet });
  expect(fin.errors, tag).toEqual([]);
  const d = computeCharacter(fin.character, R);
  expect(d.level, tag).toBe(level);
  expect(d.hp.max.value, tag).toBeGreaterThan(0);
  expect(d.ac.value, tag).toBeGreaterThanOrEqual(10);
  expect(d.warnings, tag).toEqual([]);
  return { fin, d };
}

describe("ogni voce dei dati SRD è creabile", () => {
  const [classes, species, backgrounds] = [[...R.classes.keys()], [...R.species.keys()], [...R.backgrounds.keys()]];
  it("ogni specie × ogni background, a livello 1 (con una classe a rotazione)", () => {
    let n = 0;
    for (const sp of species) for (const bg of backgrounds) create(classes[n++ % classes.length]!, sp, bg, 1);
  });
  it("ogni classe × ogni specie, a livello 1", () => {
    for (const cl of classes) species.forEach((sp, i) => create(cl, sp, backgrounds[i % backgrounds.length]!, 1));
  });
  it("ogni classe × ogni sottoclasse della classe × ogni background, a livello 5", () => {
    for (const cl of classes) {
      const subs = [...R.subclasses.values()].filter((s) => s.classId === cl);
      expect(subs.length, cl).toBeGreaterThan(0);
      for (const sub of subs) backgrounds.forEach((bg, i) => create(cl, species[i % species.length]!, bg, 5, sub.id));
    }
  });
  it("le sottoclassi danno i privilegi dei loro livelli (fino al 5)", () => {
    for (const sub of R.subclasses.values()) {
      const { d } = create(sub.classId, "human", "soldier", 5, sub.id);
      const expected = sub.features.filter((f) => f.level <= 5).map((f) => f.id);
      expect(expected.length, sub.id).toBeGreaterThan(0);
      for (const id of expected) expect(d.features, `${sub.id}/${id}`).toContain(id);
    }
  });
});
