import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildBlankSheet } from "./blankSheet";

const FONT = (w: number) => readFileSync(`node_modules/@fontsource/noto-sans/files/noto-sans-latin-${w}-normal.woff`);

describe("scheda compilabile vuota", () => {
  it("ha 3 pagine A4 e i campi con i nomi del modulo originale", async () => {
    const doc = await PDFDocument.load(await buildBlankSheet({ regular: FONT(400), bold: FONT(700) }));
    expect(doc.getPageCount()).toBe(3);
    const names = new Set(doc.getForm().getFields().map((f) => f.getName()));
    for (const n of ["nome_personaggio", "Forza_Atletica_bonus", "Destrezza_Rapidità di mano_competenza", "arma_8_3", "privilegi", "equipaggiamento", "denari_MO", "slot_9_spesi", "incantesimo_24_C", "incantesimo_1_7"]) expect(names.has(n), n).toBe(true);
  });
});
