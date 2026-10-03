import { readFileSync, writeFileSync } from "node:fs";
import { buildBlankSheet } from "../src/export/blankSheet";

// Genera la scheda compilabile vuota: npx tsx scripts/blank-sheet.ts [percorso.pdf]
const font = (w: number) => readFileSync(`node_modules/@fontsource/noto-sans/files/noto-sans-latin-${w}-normal.woff`);
const out = process.argv[2] ?? "scheda-vuota.pdf";
writeFileSync(out, await buildBlankSheet({ regular: font(400), bold: font(700) }));
console.log(out);
