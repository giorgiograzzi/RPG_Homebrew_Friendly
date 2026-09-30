import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { ABILITIES, type Ability } from "../engine/schema";
import type { SheetData } from "./sheetData";

// Scrive i dati sopra la scheda ufficiale 2024 in italiano (A4, 595×842 pt, senza campi compilabili): le posizioni sono fisse.
// Le coordinate sono in punti con l'origine in ALTO a sinistra (come si legge la pagina); `top` è la linea di base del testo.
// Le misure vengono dalle etichette stampate sulla scheda (public/forms/scheda-2024-it.pdf).
const H = 842;
const INK = rgb(0.08, 0.1, 0.18);

interface Ctx { page: PDFPage; font: PDFFont; bold: PDFFont }
type Align = "left" | "center" | "right";

// Il font standard conosce solo il set WinAnsi: i caratteri fuori da quello si tolgono invece di far fallire la stampa
function clean(font: PDFFont, s: string): string {
  const ok = new Set(font.getCharacterSet());
  return [...s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ")].filter((c) => ok.has(c.codePointAt(0)!)).join("");
}

function put(c: Ctx, text: string, x: number, top: number, size: number, o: { align?: Align; bold?: boolean; w?: number; min?: number } = {}) {
  const font = o.bold ? c.bold : c.font;
  let t = clean(font, text);
  if (!t) return;
  let s = size;
  // una riga sola: si rimpicciolisce (fino a `min`) e poi si taglia, così non esce mai dal riquadro
  if (o.w) {
    while (font.widthOfTextAtSize(t, s) > o.w && s > (o.min ?? size * 0.6)) s -= 0.25;
    if (font.widthOfTextAtSize(t, s) > o.w) {
      let base = t;
      while (base.length > 1 && font.widthOfTextAtSize(`${base}…`, s) > o.w) base = base.slice(0, -1);
      t = `${base.trimEnd()}…`;
    }
  }
  const w = font.widthOfTextAtSize(t, s);
  const px = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
  c.page.drawText(t, { x: px, y: H - top, size: s, font, color: INK });
}

function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of clean(font, text).split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width || !line) line = next; else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}

// Elenco di voci in un riquadro (più colonne se servono): corpo via via più piccolo finché tutto ci sta, poi si taglia
function flow(c: Ctx, items: string[], box: { x: number; top: number; w: number; h: number; cols?: number; bullet?: boolean }, sizes = [7.5, 7, 6.5, 6, 5.5, 5]) {
  const cols = box.cols ?? 1, gap = 8, cw = (box.w - gap * (cols - 1)) / cols;
  const layout = (size: number) => {
    const lines: { t: string; first: boolean }[] = [];
    for (const it of items) wrap(c.font, box.bullet === false ? it : `• ${it}`, size, cw).forEach((t, i) => lines.push({ t: i && box.bullet !== false ? `  ${t}` : t, first: i === 0 }));
    return lines;
  };
  let size = sizes[sizes.length - 1]!, lines = layout(size);
  for (const s of sizes) { const l = layout(s); if (Math.ceil(l.length / cols) * (s + 1.5) <= box.h) { size = s; lines = l; break; } }
  const per = Math.max(1, Math.floor(box.h / (size + 1.5)));
  lines.slice(0, per * cols).forEach((l, i) => {
    const col = Math.floor(i / per), row = i % per;
    put(c, l.t, box.x + col * (cw + gap), box.top + (row + 1) * (size + 1.5) - 1.5, size);
  });
}

// Segni: rombo (casella della scheda), pallino (competenza)
function diamond(c: Ctx, x: number, top: number, r = 2.6) {
  c.page.drawSvgPath(`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`, { x, y: H - top, color: INK });
}
function dot(c: Ctx, x: number, top: number, expert = false) {
  c.page.drawCircle({ x, y: H - top, size: 2.7, color: INK });
  if (expert) c.page.drawCircle({ x, y: H - top, size: 4.2, borderColor: INK, borderWidth: 0.8 });
}

// ---- posizioni (dalle etichette della scheda) ----
// Blocchi delle caratteristiche: x e y del titolo; il modificatore sta nel cerchio, il punteggio nel riquadro accanto
const BLOCKS: Record<Ability, { cx: number; top: number; save: { x: number; top: number } }> = {
  str: { cx: 71.5, top: 247, save: { x: 63, top: 311 } }, dex: { cx: 72, top: 357, save: { x: 63, top: 421 } }, con: { cx: 71.5, top: 492, save: { x: 63, top: 556 } },
  int: { cx: 170, top: 176, save: { x: 161, top: 240 } }, wis: { cx: 170, top: 337, save: { x: 161, top: 401 } }, cha: { cx: 170, top: 498, save: { x: 161, top: 561 } },
};
// Abilità: posizione dell'etichetta stampata
const SKILLS: Record<string, { x: number; top: number }> = {
  athletics: { x: 62, top: 329 }, acrobatics: { x: 62, top: 439 }, stealth: { x: 62, top: 452 }, sleight_of_hand: { x: 62, top: 465 },
  arcana: { x: 160, top: 258 }, investigation: { x: 160, top: 271 }, nature: { x: 160, top: 284 }, religion: { x: 160, top: 297 }, history: { x: 160, top: 310 },
  animal_handling: { x: 160, top: 414 }, insight: { x: 160, top: 432 }, medicine: { x: 160, top: 446 }, perception: { x: 160, top: 459 }, survival: { x: 160, top: 472 },
  deception: { x: 160, top: 581 }, intimidation: { x: 160, top: 594 }, performance: { x: 160, top: 607 }, persuasion: { x: 160, top: 620 },
};

function page1(c: Ctx, d: SheetData) {
  put(c, d.name, 44, 86, 13, { bold: true, w: 195, min: 8 });
  put(c, d.background, 44, 106, 9, { w: 105 }); put(c, d.klass, 158, 106, 9, { w: 92 });
  put(c, d.species, 44, 126, 9, { w: 105 }); put(c, d.subclass, 158, 126, 9, { w: 92 });
  put(c, d.level, 270.5, 104, 16, { align: "center", bold: true }); put(c, d.xp, 270.5, 124, 8, { align: "center", w: 40 });
  put(c, d.ac, 332.5, 115, 18, { align: "center", bold: true }); if (d.shield) diamond(c, 333, 134);
  put(c, d.hpNow, 383.5, 122, 15, { align: "center", bold: true, w: 40 }); put(c, d.hpMax, 427, 126, 11, { align: "center", bold: true, w: 32 });
  put(c, d.hitDice, 474, 126, 8, { align: "center", w: 40 }); put(c, d.hitDiceUsed, 474, 106, 10, { align: "center" });
  put(c, d.pb, 71, 207, 18, { align: "center", bold: true }); if (d.inspiration) diamond(c, 70.5, 611, 4);
  put(c, d.initiative, 262, 197, 16, { align: "center", bold: true }); put(c, d.speed, 348.5, 197, 13, { align: "center", bold: true, w: 52 });
  put(c, d.size, 437, 197, 10, { align: "center", bold: true, w: 52 }); put(c, d.passive, 525, 197, 16, { align: "center", bold: true });

  for (const a of ABILITIES) {
    const b = BLOCKS[a], s = d.scores[a];
    put(c, s.mod, b.cx - 12, b.top + 30, 16, { align: "center", bold: true });
    put(c, s.score, b.cx + 16, b.top + 29, 10, { align: "center", bold: true });
    if (s.saveProf) dot(c, b.save.x - 24, b.save.top - 2.5);
    put(c, s.save, b.save.x - 9, b.save.top, 8, { align: "center", bold: true });
  }
  for (const [id, sk] of Object.entries(d.skills)) {
    const p = SKILLS[id];
    if (!p || !sk) continue;
    if (sk.prof === "proficient" || sk.prof === "expertise") dot(c, p.x - 24, p.top - 2.5, sk.prof === "expertise");
    put(c, sk.value, p.x - 9, p.top, 8, { align: "center", bold: true });
  }

  d.attacks.forEach((a, i) => {
    const top = 254 + i * 19.3;
    put(c, a.name, 230, top, 8, { w: 96, min: 5.5 }); put(c, a.bonus, 351, top, 8, { align: "center", bold: true });
    put(c, a.damage, 375, top, 7, { w: 68, min: 5 }); put(c, a.notes, 447, top, 6.5, { w: 112, min: 4.5 });
  });
  flow(c, d.classFeatures, { x: 229, top: 386, w: 334, h: 190, cols: 2 });
  flow(c, d.speciesTraits, { x: 229, top: 607, w: 154, h: 160 });
  flow(c, d.feats, { x: 399, top: 607, w: 164, h: 160 });

  (["light", "medium", "heavy", "shield"] as const).forEach((k, i) => { if (d.armor[k]) diamond(c, [76, 114, 149, 188][i]!, 667, 2.8); });
  flow(c, [d.weapons].filter(Boolean), { bullet: false, x: 34, top: 683, w: 180, h: 46 }, [7.5, 7, 6.5, 6]);
  flow(c, [d.tools].filter(Boolean), { bullet: false, x: 34, top: 739, w: 180, h: 30 }, [7.5, 7, 6.5, 6]);
}

function page2(c: Ctx, d: SheetData) {
  put(c, d.spellAbility, 92, 88, 9, { align: "center", bold: true, w: 90 });
  put(c, d.spellMod, 53, 122, 13, { align: "center", bold: true });
  put(c, d.spellDc, 53, 147, 13, { align: "center", bold: true });
  put(c, d.spellAtk, 53, 172, 13, { align: "center", bold: true });
  // slot: totali per livello (Livello 1-3 a sinistra, 4-6 al centro, 7-9 a destra)
  const col = [187, 269, 342];
  d.slots.forEach((n, i) => { if (n) put(c, n, col[Math.floor(i / 3)]! + 7, [148, 161, 174][i % 3]!, 9, { align: "center", bold: true }); });

  d.spells.forEach((s, i) => {
    const top = 236 + i * 18;
    put(c, s.level, 45, top, 8, { align: "center", bold: true });
    put(c, s.name, 59, top, 8, { w: 98, min: 5.5 }); put(c, s.time, 163, top, 6.5, { w: 30, min: 4.5 }); put(c, s.range, 195, top, 6.5, { w: 38, min: 4.5 });
    if (s.concentration) diamond(c, 244, top - 3, 2.4);
    if (s.ritual) diamond(c, 265, top - 3, 2.4);
    if (s.material) diamond(c, 285, top - 3, 2.4);
    put(c, s.notes, 302, top, 6.5, { w: 78, min: 4.5 });
  });

  put(c, d.alignment, 404, 338, 9, { w: 150 });
  flow(c, [d.languages].filter(Boolean), { bullet: false, x: 402, top: 381, w: 158, h: 38 }, [7.5, 7, 6.5, 6]);
  flow(c, d.equipment, { x: 402, top: 444, w: 158, h: 166 }, [7.5, 7, 6.5, 6, 5.5]);
  d.attunement.slice(0, 3).forEach((n, i) => put(c, n, 421, 626.5 + i * 18.5, 7.5, { w: 140, min: 5 }));
  (["cp", "sp", "ep", "gp", "pp"] as const).forEach((k, i) => put(c, d.coins[k], [415.5, 448.5, 481.5, 514.5, 546.5][i]!, 729, 9, { align: "center", bold: true, w: 30 }));
}

// Scrive i dati sul modello e restituisce il PDF pronto da stampare
export async function fillSheet(template: ArrayBuffer | Uint8Array, d: SheetData): Promise<Uint8Array> {
  const doc = await PDFDocument.load(template);
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [p1, p2] = doc.getPages();
  if (!p1 || !p2) throw new Error("Il modello della scheda non ha 2 pagine.");
  page1({ page: p1, font, bold }, d);
  page2({ page: p2, font, bold }, d);
  doc.setTitle(`Scheda di ${d.name || "personaggio"}`);
  return doc.save();
}
