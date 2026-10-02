import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeCharacter } from "../compute";
import { testCharacter, testRuleset } from "../compute/testkit";
import { analyzeLoadout, addItem, buyItem, shopCatalog } from "../equipment";
import { spellbook } from "../magic";
import { extendRuleset } from "../ruleset";
import { loadSrd } from "../../data/srdIntegrity";
import {
  buildEffect, buildPack, defaultValues, describeEffect, duplicateEntry, entryFiles, mergeEntries, newHbId, parsePack, presetFor, readEffect,
  takenIds, validateEntry, type HbEntry,
} from "./index";

const t = (it: string) => ({ it });
const base = () => extendRuleset(testRuleset(), [
  { kind: "masteries", entries: [{ id: "sap", name: t("Sap") }] },
  { kind: "damageTypes", entries: [{ id: "radiant", name: t("Radioso") }, { id: "slashing", name: t("Tagliente") }, { id: "bludgeoning", name: t("Contundente") }] },
  { kind: "weaponProperties", entries: [{ id: "versatile", name: t("Versatile") }] },
]);

const weapon = { id: "hb_lama", name: t("Lama"), category: "martial", kind: "melee", damage: "1d8", damageType: "radiant", properties: ["versatile"], versatileDamage: "1d10", mastery: "sap", weight: 3, cost: 5000 };
const feat = { id: "hb_pelle", name: t("Pelle di pietra"), category: "general", effects: [{ op: "acBonus", value: 1 }, { op: "resistance", types: ["bludgeoning"] }] };
const spell = { id: "hb_scintilla", name: t("Scintilla"), level: 0, school: "evocation", classes: ["wizard"], castingTime: { unit: "action", amount: 1 }, range: "36 m", components: { v: true, s: true, m: false }, duration: "Istantanea", resolution: "attack_ranged", summary: "x" };
const E = (kind: HbEntry["kind"], data: object, enabled = true): HbEntry => ({ kind, enabled, data: data as HbEntry["data"] });

describe("homebrew: validazione", () => {
  const rs = base();
  it("accetta voci valide e forza origin homebrew", () => {
    const r = validateEntry("weapons", weapon, rs);
    expect(r.ok && (r.data as unknown as { origin: string }).origin).toBe("homebrew");
  });
  it("spiega gli errori in italiano", () => {
    const r = validateEntry("weapons", { ...weapon, name: t(""), damage: "forte" }, rs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("Dai un nome");
  });
  it("controlla i riferimenti ai dati di gioco", () => {
    const r = validateEntry("weapons", { ...weapon, mastery: "inesistente", damageType: "boh" }, rs);
    expect(!r.ok && r.errors.join(" ")).toMatch(/Maestria sconosciuta[\s\S]*Tipo di danno sconosciuto/);
    const g = validateEntry("feats", { ...feat, effects: [{ op: "grantSpell", spell: "nessuna", mode: "known" }] }, rs);
    expect(!g.ok && g.errors.join(" ")).toContain("Incantesimo sconosciuto");
  });
  it("non sovrascrive un id dei dati di gioco", () => {
    const r = validateEntry("feats", { ...feat, id: "alert" }, rs);
    expect(!r.ok && r.errors.join(" ")).toContain("già usato");
  });
  it("rifiuta formule e condizioni non valide", () => {
    expect(validateEntry("feats", { ...feat, effects: [{ op: "acBonus", value: "boh(" }] }, rs).ok).toBe(false);
    expect(validateEntry("feats", { ...feat, prerequisites: ["level>="] }, rs).ok).toBe(false);
  });
  it("id nuovi liberi", () => {
    const taken = takenIds(rs, [E("feats", feat)]);
    expect(newHbId("Pelle di pietra", taken)).toBe("hb_pelle_di_pietra");
    expect(newHbId("Pelle", taken)).toBe("hb_pelle_2"); // "hb_pelle" è già preso
    expect(newHbId("Pelle", (id) => id === "hb_pelle" || id === "hb_pelle_2")).toBe("hb_pelle_3");
    expect(newHbId("Àlert!", taken)).toBe("hb_alert");
    expect(newHbId("", taken)).toBe("hb_voce");
  });
});

describe("homebrew: pacchetti", () => {
  const rs = base();
  const entries = [E("weapons", weapon), E("feats", feat), E("spells", spell)];
  it("esporta e reimporta senza perdite", () => {
    const text = buildPack("Prova", entries);
    const p = parsePack(text, rs);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.errors).toEqual([]);
    expect(p.entries.map((e) => `${e.kind}/${e.data.id}`).sort()).toEqual(["feats/hb_pelle", "spells/hb_scintilla", "weapons/hb_lama"]);
    // esportare di nuovo il reimportato dà lo stesso testo: il formato è stabile
    expect(buildPack("Prova", p.entries)).toBe(buildPack("Prova", p.entries.map((e) => ({ ...e }))));
    expect(JSON.parse(text)).toMatchObject({ schemaVersion: 1, name: "Prova" });
  });
  it("versione mancante, futura o file rotto", () => {
    expect(parsePack("{", rs)).toMatchObject({ ok: false });
    expect(parsePack("[]", rs)).toMatchObject({ ok: false });
    expect(parsePack("{}", rs)).toMatchObject({ ok: false, error: expect.stringContaining("versione") });
    expect(parsePack('{"schemaVersion":2}', rs)).toMatchObject({ ok: false, error: expect.stringContaining("più recente") });
  });
  it("scarta le voci invalide e tiene le altre", () => {
    const p = parsePack(JSON.stringify({ schemaVersion: 1, name: "x", weapons: [weapon, { ...weapon, id: "hb_brutta", damage: "?" }], feats: "no" }), rs);
    expect(p.ok && p.entries).toHaveLength(1);
    expect(p.ok && p.errors).toHaveLength(2);
  });
  it("unisce: stesso id aggiorna e conserva l'attivazione", () => {
    const old = [E("weapons", weapon, false)];
    const m = mergeEntries(old, [E("weapons", { ...weapon, damage: "1d10" }), E("feats", feat)]);
    expect(m).toMatchObject({ added: 1, updated: 1 });
    expect(m.entries[0]).toMatchObject({ enabled: false, data: { damage: "1d10" } });
  });
  it("duplica con id e nome nuovi, disattivata", () => {
    const d = duplicateEntry(E("weapons", weapon), rs, [E("weapons", weapon)]);
    expect(d.data.id).toBe("hb_lama_copia");
    expect(d.enabled).toBe(false);
    expect(d.data.name.it).toBe("Lama (copia)");
  });
});

describe("homebrew: nel ruleset e nel personaggio", () => {
  const all = [E("weapons", weapon), E("feats", feat), E("spells", spell), E("feats", { ...feat, id: "hb_spenta" }, false)];
  const rs = extendRuleset(base(), entryFiles(all));
  it("solo le voci attive entrano", () => {
    expect(rs.weapons.get("hb_lama")?.origin).toBe("homebrew");
    expect(rs.feats.has("hb_pelle")).toBe(true);
    expect(rs.feats.has("hb_spenta")).toBe(false);
    expect(rs.errors).toEqual([]);
    expect(base().weapons.has("hb_lama")).toBe(false); // il ruleset base non cambia
  });
  it("il talento cambia la scheda con la fonte", () => {
    const plain = computeCharacter(testCharacter(), rs);
    const d = computeCharacter(testCharacter({ feats: [{ featId: "hb_pelle" }] }), rs);
    expect(d.ac.value).toBe(plain.ac.value + 1);
    expect(d.resistances).toContain("bludgeoning");
    expect(JSON.stringify(d.ac.sources)).toContain("Pelle di pietra");
  });
  it("l'arma si impugna e attacca con danni e tipo suoi", () => {
    const ch = addItem(testCharacter(), "hb_lama");
    expect(ch.inventory[0]?.itemId).toBe("hb_lama");
    const w = { ...ch, inventory: [{ ...ch.inventory[0]!, state: "wielded" as const }] };
    expect(analyzeLoadout(w, rs).problems).toEqual([]);
    const a = computeCharacter(w, rs).attacks.find((x) => x.id === "hb_lama");
    expect(a?.damage.dice).toBe("1d8");
    expect(a?.damage.type).toBe("radiant");
  });
  it("il negozio ha il gruppo Homebrew, anche per le voci a costo 0, e si comprano", () => {
    const free = extendRuleset(rs, entryFiles([E("items", { id: "hb_zaino", name: t("Zaino"), category: "Oggetto magico", weight: 5, cost: 0 })]));
    const shop = shopCatalog(free);
    expect(shop.filter((c) => c.homebrew).map((c) => c.id).sort()).toEqual(["hb_lama", "hb_zaino"]);
    expect(shop.some((c) => c.id === "rope")).toBe(false); // gli altri oggetti gratuiti restano fuori
    const r = buyItem(testCharacter(), free, "hb_zaino");
    expect(r.ok && r.character.inventory.map((i) => i.itemId)).toEqual(["hb_zaino"]);
  });
  it("l'incantesimo aggiunto a mano compare nel libro", () => {
    const ch = testCharacter({ extraSpells: ["hb_scintilla"] });
    const d = computeCharacter(ch, rs);
    const e = spellbook(ch, rs, d).find((x) => x.id === "hb_scintilla");
    expect(e?.castable).toBe(true);
    expect(e?.sources[0]?.label).toBe("Homebrew");
  });
  it("spenta o cancellata: il personaggio non si rompe", () => {
    const d = computeCharacter(testCharacter({ feats: [{ featId: "hb_spenta" }, { featId: "hb_sparita" }], extraSpells: ["hb_sparita"], inventory: [{ itemId: "hb_sparita", qty: 1, state: "wielded" }] }), rs);
    expect(d.ac.value).toBeGreaterThan(0);
  });
});

describe("homebrew: catalogo effetti", () => {
  const rs = base();
  it("ogni effetto predefinito con valori iniziali passa lo schema", () => {
    for (const op of ["acBonus", "initiativeBonus", "speedBonus", "setSpeed", "hpMaxBonus", "hpMaxPerLevel", "attackBonus", "damageBonus", "saveBonus", "checkBonus", "grantSkillProficiency", "saveAdvantage", "abilityScoreIncrease", "resistance", "sense", "critRange"]) {
      const p = presetFor(op)!;
      const v = defaultValues(p, rs);
      if (op === "checkBonus" || op === "grantSkillProficiency") v.skills = ["stealth"];
      if (op === "resistance") v.types = ["radiant"];
      const r = validateEntry("feats", { ...feat, effects: [buildEffect(p, v)] }, rs);
      expect(r.ok, `${op}: ${r.ok ? "" : r.errors.join(" ")}`).toBe(true);
    }
  });
  it("si rilegge un effetto salvato e lo si descrive", () => {
    const e = { op: "abilityScoreIncrease", abilities: ["str"], amount: 1, cap: 20 } as const;
    const r = readEffect(e as never)!;
    expect(r.values).toMatchObject({ abilities: "str", amount: 1, cap: 20 });
    expect(describeEffect(e as never, rs)).toContain("Aumento di caratteristica");
    expect(describeEffect({ op: "acBonus", value: 2 }, rs)).toBe("Bonus alla CA: +2");
  });
  it("saveBonus senza caratteristica e saveAdvantage senza lista valgono per tutti", () => {
    const sb = buildEffect(presetFor("saveBonus")!, { value: 1, ability: "" }) as Record<string, unknown>;
    expect("ability" in sb).toBe(false);
    const sa = buildEffect(presetFor("saveAdvantage")!, { abilities: [] }) as Record<string, unknown>;
    expect("abilities" in sa).toBe(false);
  });
});

// Pacchetti di esempio (data/homebrew/*.json): ci sono dallo step 6; finché mancano il blocco si salta
const EX = "data/homebrew";
describe.skipIf(!existsSync(EX))("homebrew: esempi con i dati SRD", () => {
  const rs = loadSrd("it");
  for (const f of (existsSync(EX) ? readdirSync(EX) : []).filter((x) => x.endsWith(".json"))) {
    it(`${f} si importa senza errori e si usa`, () => {
      const p = parsePack(readFileSync(`${EX}/${f}`, "utf8"), rs);
      expect(p.ok).toBe(true);
      if (!p.ok) return;
      expect(p.errors).toEqual([]);
      expect(p.entries.length).toBeGreaterThan(0);
      const both = extendRuleset(rs, entryFiles(p.entries));
      expect(both.errors).toEqual(rs.errors);
    });
  }
});
