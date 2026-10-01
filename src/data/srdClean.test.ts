import { describe, expect, it } from "vitest";
import { fixEnGlyphs, joinProse, leftoverOddChars } from "../../scripts/lib/srd-clean";
import { pdfPages } from "../../scripts/lib/pdf-text";

// Prime pagine dei mostri nel PDF inglese: i blocchi statistici usano un altro font corrotto, non ci servono.
const FIRST_MONSTER_PAGE = 258;
// Pagina 192 (passo di viaggio): una frazione resa con un glifo non mappato, senza effetti sui dati.
const KNOWN_ODD_PAGES = new Set([192]);

describe("fixEnGlyphs: mappa dei glifi del PDF inglese", () => {
  it("maiuscole con codice di controllo", () => {
    expect(fixEnGlyphs("\u0006onstitution modifier and Proficiency \u0005onus\u020c.")).toBe("Constitution modifier and Proficiency Bonus).");
    expect(fixEnGlyphs("\bach \u0004s \u0015ules \u0016ee \u0017he \u0019itality \u0010onster \u0011ote \u0012ccasion \u0018nless \u000fightly")).toBe(
      "Each As Rules See The Vitality Monster Note Occasion Unless Lightly");
    expect(fixEnGlyphs("\u0014uarters \u001bP budget")).toBe("Quarters XP budget");
  });
  it("minuscole con codice C1 (d, j, k, q, u, x)", () => {
    expect(fixEnGlyphs("e\u0093ual, e\u009aample, ob\u008cect, \u0004ttac\u008d, In\u0086efinite")).toBe("equal, example, object, Attack, Indefinite");
  });
  it("cifre e simboli", () => {
    expect(fixEnGlyphs("\u0007\u0374\u0372 \u0017ests")).toBe("D20 Tests");
    expect(fixEnGlyphs("\u0373d\u0373\u0372 \u03ad \u0373\u0372")).toBe("1d10 × 10");
    expect(fixEnGlyphs("\u03aa\u0373\u020c \u03ab\u0376 \u020bsee")).toBe("+1) −4 (see");
    expect(fixEnGlyphs("traits\u0204unique, task\u01efs, full\u01e6fledged, proficiency\u01e3 a\u01e2")).toBe("traits—unique, task’s, full-fledged, proficiency: a;");
    expect(fixEnGlyphs("\u0373\u0377 \u0374\u0375 \u0376\u0378 \u0379\u037a\u037b")).toBe("15 23 46 789");
  });
  it("trattino dopo una cifra, letto come Q", () => {
    expect(fixEnGlyphs("a 15\u0014foot Emanation, 20\u0014 \nfoot")).toBe("a 15-foot Emanation, 20- \nfoot");
    expect(fixEnGlyphs("\u0017hree\u01e6\u0014uarters")).toBe("Three-Quarters");
  });
  it("non tocca il testo già corretto, né le righe", () => {
    const ok = "Fighter 1st level\n  ‘quoted’ “text” – 5 ft.";
    expect(fixEnGlyphs(ok)).toBe(ok);
  });
});

describe("joinProse", () => {
  it("unisce parole spezzate e righe", () => {
    expect(joinProse("a Diffi -\nculty Class and Trem-\nbling\nthing")).toBe("a Difficulty Class and Trembling thing");
    expect(joinProse("la compe - \ntenza in due")).toBe("la competenza in due");
  });
  it("non unisce un trattino seguito da maiuscola o cifra", () => {
    expect(joinProse("Half-\nOrc and 5-\n10")).toBe("Half- Orc and 5- 10");
  });
});

describe("PDF reali: nessun carattere corrotto residuo", () => {
  it("EN: pagine 1-257 pulite dopo fixEnGlyphs (e sporche prima)", async () => {
    const raw = (await pdfPages("docs/srd/SRD_5.2.1_en.pdf")).slice(0, FIRST_MONSTER_PAGE - 1);
    const before = raw.filter((t) => leftoverOddChars(t).length).length;
    const dirty = raw.flatMap((t, i) => (leftoverOddChars(fixEnGlyphs(t)).length && !KNOWN_ODD_PAGES.has(i + 1) ? [i + 1] : []));
    expect(before).toBeGreaterThan(150); // senza correzione la maggior parte delle pagine è rovinata
    expect(dirty).toEqual([]);
    expect(fixEnGlyphs(raw[83]!)).toContain("Constitution modifier and Proficiency Bonus");
  }, 120_000);
  it("IT: nessun carattere anomalo in tutto il PDF", async () => {
    const pages = await pdfPages("docs/srd/SRD_5.2.1_it.pdf");
    expect(pages.flatMap((t, i) => (leftoverOddChars(t).length ? [i + 1] : []))).toEqual([]);
  }, 120_000);
});
