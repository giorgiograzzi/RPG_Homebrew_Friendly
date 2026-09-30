import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exportBackup, previewImport } from "../../db/backup";
import { backgroundFromData, backgroundToData, classFromData, classToData, emptyClass, featureToData, dataToFeature, speciesFromData, speciesToData, subclassToData } from "../../homebrew/complex";
import { computeCharacter } from "../compute";
import { testCharacter, testRuleset } from "../compute/testkit";
import { allQuestions } from "../creation";
import { buildRuleset, extendRuleset } from "../ruleset";
import {
  charactersUsing, copyOfficial, entriesUsedBy, entryFiles, homebrewIds, missingHomebrew, parsePack, validateEntry, type HbEntry,
} from "./index";

const t = (it: string) => ({ it });
const base = () => extendRuleset(testRuleset(), [
  { kind: "damageTypes", entries: [{ id: "fire", name: t("Fuoco") }, { id: "radiant", name: t("Radioso") }] },
  { kind: "skills", entries: [{ id: "perception", name: t("Percezione"), extra: { ability: "wis" } }, { id: "survival", name: t("Sopravvivenza"), extra: { ability: "wis" } }] },
  { kind: "tools", entries: [{ id: "dice", name: t("Dadi"), group: "gaming", ability: "wis" }] },
]);
const pack = (f: string) => readFileSync(`data/homebrew/${f}.json`, "utf8");
const enable = (rs: ReturnType<typeof base>, entries: HbEntry[]) => extendRuleset(rs, entryFiles(entries));

describe("homebrew: pacchetti di esempio (specie, background, classe)", () => {
  const rs = base();
  for (const f of ["esempio-specie", "esempio-background", "esempio-classe"]) {
    it(`${f} si importa senza errori ed entra nel ruleset`, () => {
      const p = parsePack(pack(f), rs);
      expect(p.ok && p.errors).toEqual([]);
      if (!p.ok) return;
      expect(p.entries.length).toBeGreaterThan(0);
      expect(p.entries.every((e) => e.pack === p.name)).toBe(true);
      expect(enable(rs, p.entries).errors).toEqual(rs.errors);
    });
  }
  it("una sottoclasse si riferisce alla classe dello stesso pacchetto; senza la classe è scartata", () => {
    const full = JSON.parse(pack("esempio-classe"));
    const p = parsePack(JSON.stringify({ ...full, classes: [] }), rs);
    expect(p.ok && p.entries.some((e) => e.kind === "subclasses")).toBe(false);
    expect(p.ok && p.errors.join(" ")).toContain("Classe sconosciuta");
  });
});

describe("homebrew: specie, background, classi e sottoclassi nel motore", () => {
  const rs0 = base();
  const entries = ["esempio-specie", "esempio-background", "esempio-classe"].flatMap((f) => { const p = parsePack(pack(f), rs0); return p.ok ? p.entries : []; });
  const rs = enable(rs0, entries);

  it("la specie homebrew dà i suoi tratti al personaggio (resistenza, vista, scelta)", () => {
    const ch = testCharacter({ speciesId: "hb_figli_della_cenere", decisions: { hb_cenere_dono: ["svelto"] } });
    const d = computeCharacter(ch, rs);
    expect(d.senses.darkvision?.value ?? 0).toBeGreaterThanOrEqual(60);
    expect(d.resistances).toContain("fire");
    expect(d.speed.walk.value).toBe(40); // 30 + 10 del dono scelto
  });
  it("il background homebrew dà il suo talento di Origine", () => {
    const ch = testCharacter({ backgroundId: "hb_guardiano_del_faro" });
    const d = computeCharacter(ch, rs);
    expect(d.initiative.value).toBeGreaterThanOrEqual(2);
  });
  it("la classe homebrew: dado vita, tabella, slot da mezzo incantatore", () => {
    const ch = testCharacter({ classes: [{ classId: "hb_custode_delle_rune", subclassId: "hb_via_della_fiamma", level: 5, hpRolls: ["avg", "avg", "avg", "avg", "avg"] }] });
    const d = computeCharacter(ch, rs);
    expect(d.hp.max.value).toBeGreaterThan(0);
    expect(d.spellSlots.slots).toEqual([3, 2]);
    expect(d.resistances).toContain("fire"); // privilegio della sottoclasse homebrew
  });
  it("la creazione elenca specie, background, classe e sottoclasse homebrew, con la dicitura", () => {
    const ch = testCharacter({ classes: [{ classId: "hb_custode_delle_rune", level: 3, hpRolls: [] }] });
    const names = allQuestions(ch, rs).flatMap((q) => q.options.map((o) => o.name));
    for (const n of ["Custode delle Rune · Homebrew", "Via della Fiamma · Homebrew", "Figli della Cenere · Homebrew", "Guardiano del faro · Homebrew"]) expect(names).toContain(n);
  });
  it("gli incantesimi homebrew di una classe si propongono per quella classe", () => {
    const ch = testCharacter({ classes: [{ classId: "hb_custode_delle_rune", level: 3, hpRolls: [] }] });
    const prepared = allQuestions(ch, rs).find((q) => q.key.endsWith("_prepared"));
    expect(prepared?.options.map((o) => o.id)).toContain("hb_raggio_dell_alba");
  });
});

describe("homebrew: validazione dei nuovi tipi", () => {
  const rs = base();
  const cls = JSON.parse(pack("esempio-classe")).classes[0];
  it("una classe incantatrice senza slot, caratteristica o colonna preparati viene spiegata", () => {
    const r = validateEntry("classes", { ...cls, spellSlots: undefined, spellAbility: undefined, table: {} }, rs);
    expect(!r.ok && r.errors.join(" ")).toMatch(/caratteristica da incantatore[\s\S]*slot[\s\S]*preparati/);
  });
  it("un background deve avere un talento e uno strumento esistenti", () => {
    const bg = JSON.parse(pack("esempio-background")).backgrounds[0];
    const r = validateEntry("backgrounds", bg, rs); // il talento homebrew non è (ancora) nel ruleset
    expect(!r.ok && r.errors.join(" ")).toContain("Talento sconosciuto");
    expect(validateEntry("backgrounds", { ...bg, feat: "alert", tool: "strumento_finto" }, rs)).toMatchObject({ ok: false });
  });
  it("non si sovrascrive una classe ufficiale", () => {
    const r = validateEntry("classes", { ...cls, id: "fighter" }, rs);
    expect(!r.ok && r.errors.join(" ")).toContain("già usato");
  });
  it("un linguaggio, un tipo di danno e una condizione semplici sono validi", () => {
    expect(validateEntry("languages", { id: "hb_ignan", name: t("Ignico"), extra: { rarity: "rare" } }, rs).ok).toBe(true);
    expect(validateEntry("damageTypes", { id: "hb_sonico", name: t("Sonico") }, rs).ok).toBe(true);
    expect(validateEntry("conditions", { id: "hb_brillante", name: t("Brillante"), description: "Emette luce." }, rs).ok).toBe(true);
  });
});

describe("homebrew: bozze ↔ dati senza perdere niente", () => {
  const rs = base();
  const raw = JSON.parse(pack("esempio-classe"));
  it("classe: dati → bozza → dati dà lo stesso risultato utile", () => {
    const d = classFromData(raw.classes[0]);
    const back = classToData(d, raw.classes[0].id, rs, raw.classes[0]) as Record<string, any>;
    expect(back.hitDie).toBe(8);
    expect(back.table.rune).toHaveLength(20);
    expect(back.spellSlots).toEqual(raw.classes[0].spellSlots); // "keep": si tiene la tabella salvata
    expect(back.features.map((f: { id: string }) => f.id)).toEqual(["hb_rune_incisione", "hb_rune_pelle", "hb_rune_maestria"]);
    expect(back.choices.some((c: { id: string }) => c.id === "hb_custode_delle_rune_prepared")).toBe(true);
    expect(validateEntry("classes", back, rs).ok).toBe(true);
  });
  it("un privilegio con uso a tabella e attivazione tiene usi, attivazione ed effetto condizionato", () => {
    const f = raw.classes[0].features[0];
    const out = featureToData(dataToFeature(f), "x", new Set()) as Record<string, any>;
    expect(out.usage).toEqual(f.usage);
    expect(out.activation).toEqual(f.activation);
    expect(out.effects).toEqual(f.effects);
  });
  it("effetti che il modulo non sa leggere restano intatti", () => {
    const f = { id: "a", name: t("A"), level: 1, effects: [{ op: "grantSpell", spell: "spark", mode: "known", when: "level>=3" }, { op: "acBonus", value: 1 }] };
    const out = featureToData(dataToFeature(f), "x", new Set()) as Record<string, any>;
    expect([...out.effects].sort((a, b) => a.op.localeCompare(b.op))).toEqual([...f.effects].sort((a, b) => a.op.localeCompare(b.op)));
  });
  it("specie e background fanno il giro completo", () => {
    const sp = JSON.parse(pack("esempio-specie")).species[0];
    expect((speciesToData(speciesFromData(sp), sp.id) as Record<string, any>).traits.map((x: { id: string }) => x.id)).toEqual(sp.traits.map((x: { id: string }) => x.id));
    const bg = JSON.parse(pack("esempio-background")).backgrounds[0];
    expect((backgroundToData(backgroundFromData(bg), bg.id) as Record<string, any>).equipment).toEqual(bg.equipment);
  });
  it("una classe nuova incantatrice genera le scelte di trucchetti e preparati", () => {
    const d = { ...emptyClass(), name: "X", caster: "full", spellAbility: "int", columns: [{ name: "trucchetti", values: Array(20).fill("2") }, { name: "preparati", values: Array(20).fill("4") }] };
    const out = classToData(d, "hb_x", rs) as Record<string, any>;
    expect(out.choices.map((c: { id: string }) => c.id)).toEqual(["hb_x_skills", "hb_x_cantrips", "hb_x_prepared"]);
    expect(out.spellList).toBe("hb_x");
  });
  it("una sottoclasse nuova ha id dei privilegi stabili", () => {
    const out = subclassToData({ name: "S", description: "", classId: "fighter", features: [{ ...dataToFeature({ id: "", name: t("Colpo"), level: 3 }) }], keep: {} }, "hb_s") as Record<string, any>;
    expect(out.features[0].id).toBe("hb_s_colpo");
  });
});

describe("homebrew: copia di una voce ufficiale", () => {
  const rs = base();
  it("una classe copiata ha id nuovi, scelte col nuovo prefisso e la stessa lista di incantesimi", () => {
    const off = { id: "wizard", name: t("Mago"), hitDie: 6, primaryAbility: ["int"], saves: ["int", "wis"], skillChoices: { count: 2, from: "any" }, armorTraining: [], weaponProficiency: [], caster: "full", spellAbility: "int",
      spellSlots: Array(20).fill([2]), table: { preparati: Array(20).fill(4) }, equipment: {}, features: [], choices: [{ id: "wizard_skills", label: t("Abilità"), count: 2, source: "skills" }, { id: "wizard_spellbook", label: t("Libro"), count: 1, source: "spells:wizard" }] };
    const e = copyOfficial("classes", off, rs, []);
    const d = e.data as Record<string, any>;
    expect(d.id).toBe("hb_mago_copia");
    expect(d.name.it).toBe("Mago (copia)");
    expect(d.choices.map((c: { id: string }) => c.id)).toEqual(["hb_mago_copia_skills", "hb_mago_copia_spellbook"]);
    expect(d.spellList).toBe("wizard");
    expect(e.enabled).toBe(false);
    expect(validateEntry("classes", d, rs).ok).toBe(true);
    // e dopo il giro nel modulo la scelta dell'abilità non si duplica
    const back = classToData(classFromData(d), d.id, rs, d) as Record<string, any>;
    expect(back.choices.filter((c: { id: string }) => c.id.endsWith("_skills"))).toHaveLength(1);
  });
});

describe("homebrew: uso da parte dei personaggi", () => {
  const rs = base();
  const ch = testCharacter({ name: "Brina", speciesId: "hb_a", backgroundId: "soldier", classes: [{ classId: "fighter", subclassId: "hb_sub", level: 1, hpRolls: [] }],
    feats: [{ featId: "hb_talento" }], extraSpells: ["hb_magia"], inventory: [{ itemId: "hb_spada", qty: 1, state: "stowed" }], decisions: { x: ["hb_altro", "normale"] } });
  it("elenca gli id homebrew ovunque compaiano", () => {
    expect(homebrewIds(ch)).toEqual(["hb_a", "hb_altro", "hb_magia", "hb_spada", "hb_sub", "hb_talento"]);
  });
  it("segnala quelli che il ruleset non ha", () => {
    expect(missingHomebrew(ch, rs)).toHaveLength(6);
    const on = enable(rs, [{ kind: "feats", enabled: true, data: { id: "hb_talento", name: t("T"), category: "general" } }]);
    expect(missingHomebrew(ch, on)).not.toContain("hb_talento");
  });
  it("trova i personaggi che usano una voce e le voci da portare con un personaggio", () => {
    expect(charactersUsing([ch, testCharacter()], ["hb_sub"]).map((c) => c.name)).toEqual(["Brina"]);
    const entries: HbEntry[] = [
      { kind: "subclasses", enabled: true, data: { id: "hb_sub", name: t("S"), classId: "hb_classe" } },
      { kind: "classes", enabled: true, data: { id: "hb_classe", name: t("C") } },
      { kind: "feats", enabled: true, data: { id: "hb_inutile", name: t("I") } },
    ];
    expect(entriesUsedBy(entries, [ch]).map((e) => e.data.id).sort()).toEqual(["hb_classe", "hb_sub"]);
  });
  it("il backup porta con sé le voci usate e le rilegge", () => {
    const entries: HbEntry[] = [{ kind: "feats", enabled: true, data: { id: "hb_talento", name: t("T"), category: "general" }, pack: "Mio" }, { kind: "feats", enabled: true, data: { id: "hb_inutile", name: t("I"), category: "general" } }];
    const text = exportBackup([ch], undefined, 1, entriesUsedBy(entries, [ch]));
    const prev = previewImport(text, []);
    expect(prev.ok && prev.homebrew?.map((e) => e.data.id)).toEqual(["hb_talento"]);
    expect(prev.ok && prev.homebrew?.[0]?.pack).toBe("Mio");
  });
});

void buildRuleset;
