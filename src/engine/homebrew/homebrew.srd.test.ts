import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadSrd } from "../../data/srdIntegrity";
import { emptyCharacter } from "../character";
import { computeCharacter } from "../compute";
import { creationProgress } from "../creation";
import { extendRuleset } from "../ruleset";
import { autoComplete } from "../../wizard/logic";
import { entryFiles, parsePack, type HbEntry } from "./index";

// I pacchetti di esempio di data/homebrew/ sul ruleset SRD vero (non su quello di prova): si importano senza scarti
// e i personaggi che li usano si creano e si calcolano.
const FILES = readdirSync("data/homebrew").filter((f) => f.endsWith(".json"));
const R = loadSrd("it");
const entries: HbEntry[] = [];

describe("homebrew: pacchetti di esempio sull'SRD", () => {
  it("ci sono i pacchetti di esempio", () => expect(FILES.sort()).toEqual(["esempio-background.json", "esempio-classe.json", "esempio-specie.json"]));
  for (const f of FILES) {
    it(`${f} si importa sull'SRD senza voci scartate`, () => {
      const p = parsePack(readFileSync(`data/homebrew/${f}`, "utf8"), R);
      expect(p.ok && p.errors).toEqual([]);
      if (p.ok) { expect(p.entries.length).toBeGreaterThan(0); entries.push(...p.entries); }
    });
  }
  it("un personaggio con specie, background, classe e sottoclasse homebrew si crea e si calcola", () => {
    const rs = extendRuleset(R, entryFiles(entries));
    const base = { ...emptyCharacter("hb"), name: "Brace", speciesId: "hb_figli_della_cenere", backgroundId: "hb_guardiano_del_faro",
      classes: [{ classId: "hb_custode_delle_rune", subclassId: "hb_via_della_fiamma", level: 5, hpRolls: [] as (number | "avg")[] }] };
    const ch = autoComplete(base, rs);
    expect(creationProgress(ch, rs).steps.filter((s) => !s.complete).map((s) => `${s.step}: ${[...s.missing, ...s.problems].join(", ")}`)).toEqual([]);
    const d = computeCharacter(ch, rs);
    expect(d.resistances).toContain("fire");
    expect(d.senses.darkvision?.value).toBe(60);
    expect(d.spellSlots.slots).toEqual([3, 2]);
  });
});

describe("homebrew: niente copia da voce ufficiale", () => {
  const read = (p: string) => readFileSync(p, "utf8");
  it("né la logica né l'editor la espongono", () => {
    expect(read("src/engine/homebrew/pack.ts")).not.toContain("copyOfficial");
    expect(read("src/pages/Homebrew.tsx")).not.toMatch(/copyOfficial|OfficialDialog/);
    for (const l of ["it", "en"]) expect(Object.keys(JSON.parse(read(`src/i18n/${l}.json`)).homebrew)).not.toContain("official");
  });
});
