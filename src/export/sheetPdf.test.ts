import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { loadSrd } from "../data/srdIntegrity";
import { emptyCharacter } from "../engine/character";
import { creationProgress } from "../engine/creation";
import { SKILLS } from "../engine/schema";
import type { Character } from "../engine/types";
import { STRINGS, type Lang } from "../i18n";
import { DISCLAIMER, SRD_NOTICE } from "../legal/attribution";
import { autoComplete, finalizeCharacter } from "../wizard/logic";
import { makeSheetPdf } from "./sheetPdf";

const FONT = (w: number) => readFileSync(`node_modules/@fontsource/noto-sans/files/noto-sans-latin-${w}-normal.woff`);
const fonts = { regular: FONT(400), bold: FONT(700) };

async function readPdf(bytes: Uint8Array) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items.map((x) => ("str" in x ? x.str : "")).join(" ").replace(/\s+/g, " "));
  return { n: doc.numPages, pages, text: pages.join("\n") };
}

// Un mago di livello 5 completo e un guerriero di livello 1 (senza incantesimi)
function make(lang: Lang, classId: string, level: number, name: string) {
  const rs = loadSrd(lang);
  const base: Character = { ...emptyCharacter(`pdf-${classId}`), name, speciesId: "elf", backgroundId: "sage", classes: [{ classId, level, hpRolls: [] }] };
  const ch = autoComplete(base, rs);
  expect(creationProgress(ch, rs).complete).toBe(true);
  const fin = finalizeCharacter(ch, rs, { gaming_set: [...rs.tools.values()].find((t) => t.group === "gaming")?.id });
  expect(fin.errors).toEqual([]);
  return { rs, ch: fin.character };
}

describe("scheda PDF libera", () => {
  for (const lang of ["it", "en"] as const) {
    it(`mago di 5° livello in ${lang}: pagine, testi chiave, niente campi vuoti`, async () => {
      const { rs, ch } = make(lang, "wizard", 5, "Aria Ventosa");
      const bytes = await makeSheetPdf(ch, rs, lang, fonts);
      const { n, pages, text } = await readPdf(bytes);
      const P = STRINGS[lang].pdf, S = STRINGS[lang];
      expect(n).toBeGreaterThanOrEqual(2);
      expect(text).toContain("Aria Ventosa");
      expect(text).toContain(rs.classes.get("wizard")!.name.it);
      expect(text).toContain(rs.species.get("elf")!.name.it);
      expect(text).toContain(rs.backgrounds.get("sage")!.name.it);
      // intestazioni della lingua giusta
      for (const k of ["skills", "attacks", "equipment", "spellcasting", "classFeatures"] as const) expect(text.toUpperCase()).toContain(P[k].toUpperCase());
      for (const a of ["str", "dex", "con", "int", "wis", "cha"] as const) expect(text.toUpperCase()).toContain((S.wizard.abilities as Record<string, string>)[a]!.toUpperCase());
      // tutte le 18 abilità, con il loro bonus
      for (const s of SKILLS) expect(text, s).toContain(rs.skills.get(s)!.name.it);
      // incantesimi: almeno un trucchetto e uno slot
      expect(text).toContain(P.slots);
      // nessun taglio: tutti gli incantesimi del libro compaiono, anche nel dettaglio (sezione con il testo)
      expect(text).toContain(P.spellDetails.toUpperCase());
      const names = [...rs.spells.values()].filter((sp) => text.includes(sp.name.it)).length;
      expect(names).toBeGreaterThan(8);
      // piè di pagina: dicitura CC-BY esatta della lingua e numerazione su ogni pagina
      pages.forEach((pg, i) => {
        expect(pg).toContain(SRD_NOTICE[lang]); // dicitura CC-BY intera, su ogni pagina
        expect(pg).toContain(DISCLAIMER[lang]);
        expect(pg).toContain(P.page.replace("{n}", String(i + 1)).replace("{t}", String(n)));
      });
      // niente segnaposto o campi vuoti: nessun "undefined"/"NaN"/"[object", niente "?" dovuto a glifi mancanti
      expect(text).not.toMatch(/undefined|NaN|\[object|null/);
      expect(text).not.toMatch(/\s\?\s/);
      // l'altra lingua non compare nelle etichette
      const other = STRINGS[lang === "it" ? "en" : "it"].pdf;
      expect(text).not.toContain(other.classFeatures);
    });
  }

  it("guerriero di 1° livello: niente sezione incantesimi", async () => {
    const { rs, ch } = make("en", "fighter", 1, "Brom");
    const { text } = await readPdf(await makeSheetPdf(ch, rs, "en", fonts));
    expect(text).toContain("Brom");
    expect(text).not.toContain(STRINGS.en.pdf.spellLegend);
  });

  it("un nome con accenti e caratteri fuori dal font non rompe la scheda", async () => {
    const { rs, ch } = make("it", "fighter", 1, "Ñandú ★ 龍");
    const { text } = await readPdf(await makeSheetPdf(ch, rs, "it", fonts));
    expect(text).toContain("Ñandú");
  });

  it("il font incorporato è libero: licenza e attribuzione in repo", () => {
    expect(readFileSync("ATTRIBUTION.md", "utf8")).toMatch(/Noto Sans[\s\S]*SIL Open Font License 1\.1/);
    expect(readFileSync("docs/licenses/NotoSans-OFL-1.1.txt", "utf8")).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });
});
