import { describe, expect, it } from "vitest";
import { computeCharacter } from "../engine/compute";
import { testCharacter } from "../engine/compute/testkit";
import { buildRuleset } from "../engine/ruleset";
import { filesFor, loadRuleset } from "../data/loadRuleset";
import { brokenReferences } from "../data/srdIntegrity";
import { getLangPref, keyPaths, resolveLang, STRINGS } from ".";

describe("testi dell'interfaccia", () => {
  const [it_, en] = [keyPaths(STRINGS.it), keyPaths(STRINGS.en)];
  it("ogni chiave di it.json esiste in en.json e viceversa", () => {
    expect(it_.filter((k) => !en.includes(k))).toEqual([]);
    expect(en.filter((k) => !it_.includes(k))).toEqual([]);
  });
  it("i segnaposto {x} sono gli stessi nelle due lingue", () => {
    const get = (o: unknown, path: string) => path.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown>)[k], o) as string;
    const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const k of it_) expect(holes(get(STRINGS.en, k)), k).toBe(holes(get(STRINGS.it, k)));
  });
  it("niente testo vuoto in inglese dove l'italiano ha un testo", () => {
    const get = (o: unknown, path: string) => path.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown>)[k], o) as string;
    for (const k of it_) if (get(STRINGS.it, k) !== "") expect(get(STRINGS.en, k), k).not.toBe("");
  });
});

describe("scelta della lingua", () => {
  it("preferenza esplicita, poi lingua del browser, poi inglese", () => {
    expect(resolveLang("en", "it-IT")).toBe("en");
    expect(resolveLang("it", "en-US")).toBe("it");
    expect(resolveLang("auto", "it-IT")).toBe("it");
    expect(resolveLang(null, "it")).toBe("it");
    expect(resolveLang(null, "fr-FR")).toBe("en");
    expect(resolveLang(null, undefined)).toBe("en");
  });
  it("senza archivio del browser la preferenza è automatica", () => { expect(getLangPref()).toBe("auto"); });
});

describe("dati di gioco nelle due lingue", () => {
  const [rsIt, rsEn] = [loadRuleset("it"), loadRuleset("en")];
  it("il ruleset si carica in entrambe le lingue senza errori né riferimenti rotti", () => {
    for (const rs of [rsIt, rsEn]) { expect(rs.errors).toEqual([]); expect(brokenReferences(rs)).toEqual([]); expect(rs.spells.size).toBe(339); }
    expect(filesFor("it").length).toBe(filesFor("en").length);
  });
  it("stesso personaggio, calcolo identico, nomi diversi", () => {
    const ch = testCharacter({ classes: [{ classId: "wizard", level: 5, hpRolls: [] }], speciesId: "elf", backgroundId: "sage" });
    const [a, b] = [computeCharacter(ch, rsIt), computeCharacter(ch, rsEn)];
    expect(b.hp.max.value).toBe(a.hp.max.value);
    expect(b.ac.value).toBe(a.ac.value);
    expect(b.spellSlots.slots).toEqual(a.spellSlots.slots);
    expect(rsIt.classes.get("wizard")!.name.it).toBe("Mago");
    expect(rsEn.classes.get("wizard")!.name.it).toBe("Wizard");
    expect(rsEn.spells.get("fireball")!.name.it).toBe("Fireball");
    expect(rsIt.spells.get("fireball")!.name.it).toBe("Palla di fuoco");
  });
  it("con dati vuoti l'app non si rompe", () => {
    const empty = buildRuleset([]);
    expect(empty.errors).toEqual([]);
    expect(() => computeCharacter(testCharacter(), empty)).not.toThrow();
  });
});
