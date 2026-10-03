import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFName, rgb, type PDFFont, type PDFForm, type PDFPage } from "pdf-lib";
import type { Lang } from "../i18n";
import { DISCLAIMER, SRD_NOTICE } from "../legal/attribution";
import type { FontBytes } from "./pdfKit";

// Scheda compilabile, ridisegnata da zero (A4, 3 pagine): ogni riquadro ha il suo spazio, righe e nomi sono allineati per costruzione.
// I campi usano gli stessi nomi del modulo originale ("Forza_Atletica_bonus", "arma_1_0", "incantesimo_3_C"...) per poterli riempire dal personaggio.
const W = 595.28, H = 841.89, M = 30, CW = W - 2 * M;
const PETROL = rgb(0.141, 0.329, 0.357), GOLD = rgb(0.718, 0.584, 0.329), INK = rgb(0.15, 0.23, 0.24), SOFT = rgb(0.45, 0.56, 0.58), TINT = rgb(0.95, 0.97, 0.97);

const ABILITIES: [string, string[]][] = [
  ["Forza", ["Atletica"]],
  ["Intelligenza", ["Arcano", "Indagare", "Natura", "Religione", "Storia"]],
  ["Destrezza", ["Acrobazia", "Furtività", "Rapidità di mano"]],
  ["Saggezza", ["Addestrare animali", "Intuizione", "Medicina", "Percezione", "Sopravvivenza"]],
  ["Costituzione", []],
  ["Carisma", ["Inganno", "Intimidire", "Intrattenere", "Persuasione"]],
];

// `fill` riempie i campi prima che vengano disegnati; `extra` (un altro PDF) viene accodato come pagine di continuazione
export async function buildBlankSheet(fonts: FontBytes, o: { lang?: Lang; fill?: (form: PDFForm) => void; extra?: Uint8Array } = {}): Promise<Uint8Array> {
  const lang = o.lang ?? "it";
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const reg = await pdf.embedFont(fonts.regular, { subset: true }), bold = await pdf.embedFont(fonts.bold, { subset: true });
  pdf.setTitle("Scheda del personaggio"); pdf.setCreator("RPG Homebrew Friendly");
  const form = pdf.getForm();

  let page!: PDFPage;
  const y = (top: number) => H - top;
  const text = (s: string, x: number, top: number, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; width?: number; align?: "center" | "right" } = {}) => {
    const size = o.size ?? 8, f: PDFFont = o.bold ? bold : reg, w = f.widthOfTextAtSize(s, size);
    const dx = o.width && o.align === "center" ? (o.width - w) / 2 : o.width && o.align === "right" ? o.width - w : 0;
    page.drawText(s, { x: x + dx, y: y(top) - size * 0.8, size, font: f, color: o.color ?? INK });
  };
  const line = (x1: number, t1: number, x2: number, t2: number, color = SOFT, thickness = 0.7) => page.drawLine({ start: { x: x1, y: y(t1) }, end: { x: x2, y: y(t2) }, color, thickness });
  const box = (x: number, top: number, w: number, h: number, title?: string) => {
    page.drawRectangle({ x, y: y(top) - h, width: w, height: h, borderColor: PETROL, borderWidth: 0.9, color: undefined });
    page.drawRectangle({ x: x + 10, y: y(top) - 0.9, width: 22, height: 1.8, color: GOLD });
    if (title) { text(title, x + 8, top + 7, { size: 9, bold: true, color: PETROL }); line(x + 8, top + 21, x + w - 8, top + 21, SOFT, 0.6); }
  };
  // campo di testo senza bordo, con la riga sotto; `multi` = più righe di testo che vanno a capo
  const field = (name: string, x: number, top: number, w: number, h: number, o: { size?: number; multi?: boolean; align?: "center"; rule?: boolean } = {}) => {
    const f = form.createTextField(name);
    if (o.multi) f.enableMultiline();
    if (o.align === "center") f.setAlignment(1);
    f.addToPage(page, { x, y: y(top) - h, width: w, height: h, borderWidth: 0, font: reg });
    f.setFontSize(o.size ?? 9);
    for (const wd of f.acroField.getWidgets()) { const mk = wd.getOrCreateAppearanceCharacteristics().dict; mk.delete(PDFName.of("BG")); mk.delete(PDFName.of("BC")); } // sfondo trasparente: righe e riquadri sotto restano visibili
    if (o.rule !== false && !o.multi) line(x, top + h, x + w, top + h);
  };
  const check = (name: string, x: number, top: number, s = 9) => {
    const c = form.createCheckBox(name);
    c.addToPage(page, { x, y: y(top) - s, width: s, height: s, borderColor: PETROL, borderWidth: 0.8, backgroundColor: rgb(1, 1, 1) });
  };
  const labelled = (label: string, name: string, x: number, top: number, w: number, o: { size?: number } = {}) => {
    text(label, x, top, { size: 7.5, color: INK });
    field(name, x, top + 9, w, 15, o);
  };
  const wrapText = (str: string, width: number, size: number) => {
    const out: string[] = []; let cur = "";
    for (const w of str.replace(/\s+/g, " ").split(" ")) { const t = cur ? `${cur} ${w}` : w; if (reg.widthOfTextAtSize(t, size) <= width || !cur) cur = t; else { out.push(cur); cur = w; } }
    return cur ? [...out, cur] : out;
  };
  const newPage = (n: number, sub: string) => {
    page = pdf.addPage([W, H]);
    text("SCHEDA DEL PERSONAGGIO", M, 26, { size: 19, bold: true, color: PETROL });
    text(`SRD 5.2.1  /  ${sub}`, M, 50, { size: 8, color: PETROL });
    text(`${n}/3`, W - M - 40, 30, { size: 12, bold: true, color: GOLD, width: 40, align: "right" });
    line(M, 64, W - M, 64, SOFT, 0.6);
    line(M, H - 44, W - M, H - 44, SOFT, 0.5);
    // dicitura CC-BY dell'SRD e avviso «non ufficiale» su ogni pagina
    let fy = H - 41;
    for (const l of [...wrapText(SRD_NOTICE[lang], CW - 60, 5.8), ...wrapText(DISCLAIMER[lang], CW - 60, 5.8)]) { text(l, M, fy, { size: 5.8, color: SOFT }); fy += 6.6; }
  };

  // ───────── pagina 1: caratteristiche e combattimento ─────────
  newPage(1, "CARATTERISTICHE E COMBATTIMENTO");
  const gap = 8;
  let top = 72;
  const id1 = [["Nome del personaggio", "nome_personaggio", 218], ["Classe", "classe", 130], ["Livello", "livello", 80], ["PE", "pe", 77]] as const;
  let x = M;
  for (const [l, n, w] of id1) { labelled(l, n, x, top, w); x += w + gap; }
  top += 32; x = M;
  const id2 = [["Background", "background", 130], ["Specie", "specie", 130], ["Sottoclasse", "sottoclasse", 145], ["Allineamento", "allineamento", 100]] as const;
  for (const [l, n, w] of id2) { labelled(l, n, x, top, w); x += w + gap; }

  // combattimento: quattro riquadri della stessa altezza
  top += 36;
  const bh = 62, bw = [92, 168, 110, 140];
  const bx = [M, M + 92 + gap, M + 92 + gap + 168 + gap, M + 92 + gap + 168 + gap + 110 + gap];
  box(bx[0]!, top, bw[0]!, bh, "ARMATURA");
  field("classe_armatura", bx[0]! + 10, top + 33, 32, 20, { size: 13, align: "center" }); text("CA", bx[0]! + 10, top + 55, { size: 6.5, color: SOFT, width: 32, align: "center" });
  check("scudo", bx[0]! + 55, top + 37); text("Scudo", bx[0]! + 55, top + 49, { size: 6.5 });
  box(bx[1]!, top, bw[1]!, bh, "PUNTI FERITA");
  [["Attuali", "pf_attuali"], ["Max", "pf_max"], ["Temp", "pf_temp"]].forEach(([l, n], i) => { const fx = bx[1]! + 10 + i * 52; text(l!, fx, top + 27, { size: 7 }); field(n!, fx, top + 37, 44, 17, { size: 11, align: "center" }); });
  box(bx[2]!, top, bw[2]!, bh, "DADI VITA");
  [["Max", "dadi_vita_max"], ["Spesi", "dadi_vita_spesi"]].forEach(([l, n], i) => { const fx = bx[2]! + 10 + i * 48; text(l!, fx, top + 27, { size: 7 }); field(n!, fx, top + 37, 40, 17, { size: 11, align: "center" }); });
  box(bx[3]!, top, bw[3]!, bh, "TS CONTRO MORTE");
  (["Successi", "Fallimenti"] as const).forEach((l, r) => { text(l, bx[3]! + 10, top + 28 + r * 15, { size: 7.5 }); for (let i = 1; i <= 3; i++) check(`morte_${l}_${i}`, bx[3]! + 72 + (i - 1) * 18, top + 27 + r * 15, 9); });

  // riga di valori
  top += bh + 8;
  const stats = [["Bonus competenza", "bonus_competenza"], ["Iniziativa", "iniziativa"], ["Velocità", "velocita"], ["Taglia", "taglia"], ["Percezione passiva", "percezione_passiva"]] as const;
  const sw = (CW - 4 * gap - 62) / 5;
  stats.forEach(([l, n], i) => { const sx = M + i * (sw + gap); text(l, sx, top, { size: 7.5 }); field(n, sx, top + 9, sw, 17, { size: 11, align: "center" }); });
  const ix = W - M - 54;
  text("Ispirazione eroica", ix - 8, top, { size: 7, width: 70, align: "center" }); check("ispirazione_eroica", ix + 18, top + 12, 12);

  // caratteristiche: due colonne, tre righe; ogni abilità ha la sua riga con casella, nome e bonus
  top += 38;
  text("CARATTERISTICHE E ABILITÀ", M, top, { size: 10, bold: true, color: PETROL });
  top += 16;
  const cw2 = (CW - gap) / 2, rowH = 13, rowsN = [5, 5, 4], bhs = rowsN.map((n) => 56 + n * rowH), rowTop = [0, 1, 2].map((r) => top + bhs.slice(0, r).reduce((a, b) => a + b + gap, 0));
  ABILITIES.forEach(([ab, skills], k) => {
    const cx = M + (k % 2) * (cw2 + gap), cy = rowTop[Math.floor(k / 2)]!;
    box(cx, cy, cw2, bhs[Math.floor(k / 2)]!, ab.toUpperCase());
    text("Punteggio", cx + 8, cy + 28, { size: 7.5 }); field(`${ab}_punteggio`, cx + 50, cy + 25, 36, 15, { size: 10, align: "center" });
    text("Mod.", cx + 96, cy + 28, { size: 7.5 }); field(`${ab}_mod`, cx + 118, cy + 25, 36, 15, { size: 10, align: "center" });
    check(`${ab}_ts_competenza`, cx + 168, cy + 27, 8); text("TS", cx + 180, cy + 28, { size: 7.5 });
    field(`${ab}_ts`, cx + cw2 - 8 - 36, cy + 25, 36, 15, { size: 10, align: "center" });
    line(cx + 8, cy + 46, cx + cw2 - 8, cy + 46, SOFT, 0.3);
    skills.forEach((s, i) => {
      const ry = cy + 50 + i * rowH;
      check(`${ab}_${s}_competenza`, cx + 10, ry + 2.5, 8);
      text(s, cx + 24, ry + 3, { size: 8.5 });
      field(`${ab}_${s}_bonus`, cx + cw2 - 8 - 36, ry, 36, rowH, { size: 9, align: "center" });
    });
  });

  // armi e trucchetti: otto righe
  top += bhs.reduce((a, b) => a + b + gap, 0);
  const rows = 8, rh = 14, ah = 40 + rows * rh;
  box(M, top, CW, ah, "ARMI E TRUCCHETTI DA COMBATTIMENTO");
  const ac = [{ l: "Nome", x: M + 8, w: 170 }, { l: "Bonus att. / CD", x: M + 186, w: 80 }, { l: "Danno e tipo", x: M + 274, w: 110 }, { l: "Note", x: M + 392, w: CW - 400 }];
  ac.forEach((c) => text(c.l, c.x, top + 26, { size: 7.5, bold: true }));
  for (let r = 1; r <= rows; r++) ac.forEach((c, i) => field(`arma_${r}_${i}`, c.x, top + 38 + (r - 1) * rh, c.w, rh, { size: 9 }));

  // ───────── pagina 2: capacità, equipaggiamento e storia ─────────
  newPage(2, "CAPACITÀ, EQUIPAGGIAMENTO E STORIA");
  const LX = M, LW = 332, RX = M + LW + gap, RW = CW - LW - gap;
  const area = (title: string, name: string, bx0: number, by: number, bw0: number, bh0: number, size = 8.5) => {
    box(bx0, by, bw0, bh0, title);
    field(name, bx0 + 6, by + 26, bw0 - 12, bh0 - 32, { multi: true, size });
  };
  area("PRIVILEGI DI CLASSE", "privilegi", LX, 72, LW, 290);
  area("EQUIPAGGIAMENTO", "equipaggiamento", LX, 370, LW, 190);
  box(LX, 568, LW, 64, "SINTONIA CON OGGETTI MAGICI");
  for (let i = 1; i <= 3; i++) field(`sintonia_${i}`, LX + 8 + (i - 1) * 106, 596, 98, 18);
  box(LX, 640, LW, 52, "DENARI");
  ["MR", "MA", "ME", "MO", "MP"].forEach((c, i) => { const mx = LX + 10 + i * 64; text(c, mx, 668, { size: 8, bold: true, color: PETROL }); field(`denari_${c}`, mx + 18, 663, 40, 18, { size: 10, align: "center" }); });
  area("LINGUE", "lingue", LX, 700, LW, 72);

  area("TRATTI DELLA SPECIE", "tratti_specie", RX, 72, RW, 130);
  area("TALENTI", "talenti", RX, 210, RW, 110);
  box(RX, 328, RW, 170, "ADDESTRAMENTO");
  text("Armature", RX + 8, 354, { size: 7.5, bold: true });
  (["Leggera", "Media", "Pesante", "Scudi"] as const).forEach((a, i) => { const cx = RX + 8 + (i % 2) * 90, cy = 368 + Math.floor(i / 2) * 15; check(`armature_${a}`, cx, cy, 8); text(a, cx + 12, cy + 0.5, { size: 8 }); });
  text("Armi", RX + 8, 402, { size: 7.5, bold: true }); field("competenze_armi", RX + 6, 412, RW - 12, 32, { multi: true, size: 8 });
  text("Strumenti", RX + 8, 448, { size: 7.5, bold: true }); field("competenze_strumenti", RX + 6, 458, RW - 12, 34, { multi: true, size: 8 });
  area("ASPETTO", "aspetto", RX, 506, RW, 84);
  area("STORIA E TRATTI CARATTERIALI", "storia", RX, 598, RW, 174);

  // ───────── pagina 3: incantesimi ─────────
  newPage(3, "TRUCCHETTI E INCANTESIMI");
  top = 72;
  const sp = [["Caratteristica da incantatore", "caratteristica_incantatore"], ["Modificatore", "mod_incantatore"], ["CD tiro salvezza", "cd_incantesimi"], ["Bonus di attacco", "bonus_attacco_incantesimi"]] as const;
  const spw = (CW - 3 * gap) / 4;
  sp.forEach(([l, n], i) => { const sx = M + i * (spw + gap); text(l, sx, top, { size: 7.5, bold: true }); field(n, sx, top + 11, spw, 18, { size: 11, align: "center" }); });
  top += 42;
  box(M, top, CW, 74, "SLOT INCANTESIMO");
  const slw = (CW - 70) / 9;
  text("Livello", M + 8, top + 29, { size: 7.5 }); text("Totali", M + 8, top + 44, { size: 7.5 }); text("Spesi", M + 8, top + 59, { size: 7.5 });
  for (let i = 1; i <= 9; i++) {
    const sx = M + 58 + (i - 1) * slw;
    text(String(i), sx, top + 28, { size: 9, bold: true, color: PETROL, width: slw - 8, align: "center" });
    field(`slot_${i}_totali`, sx, top + 40, slw - 8, 14, { size: 9, align: "center" }); field(`slot_${i}_spesi`, sx, top + 55, slw - 8, 14, { size: 9, align: "center" });
  }
  top += 74 + 14;
  text("TRUCCHETTI E INCANTESIMI PREPARATI", M, top, { size: 10, bold: true, color: PETROL });
  text("C: Concentrazione  •  R: Rituale  •  M: Materiali richiesti", M, top + 14, { size: 7, color: INK });
  top += 28;
  const sc = { lv: M + 4, name: M + 34, time: M + 204, range: M + 272, c: M + 342, r: M + 362, m: M + 382, note: M + 406 };
  const hdr = (s: string, hx: number) => text(s, hx, top, { size: 7.5, bold: true, color: PETROL });
  hdr("Liv.", sc.lv); hdr("Nome", sc.name); hdr("Tempo", sc.time); hdr("Gittata", sc.range); hdr("C", sc.c + 2); hdr("R", sc.r + 2); hdr("M", sc.m + 2); hdr("Note", sc.note);
  top += 12;
  const n = 24, th = (H - 54 - top) / n;
  page.drawRectangle({ x: M, y: y(top) - n * th, width: CW, height: n * th, borderColor: PETROL, borderWidth: 0.9 });
  for (let r = 1; r <= n; r++) {
    const ry = top + (r - 1) * th;
    if (r % 2 === 0) page.drawRectangle({ x: M + 0.5, y: y(ry) - th, width: CW - 1, height: th, color: TINT });
    field(`incantesimo_${r}_0`, sc.lv, ry, 26, th, { size: 8.5, align: "center", rule: false });
    field(`incantesimo_${r}_1`, sc.name, ry, 164, th, { size: 8.5, rule: false });
    field(`incantesimo_${r}_2`, sc.time, ry, 64, th, { size: 8, rule: false });
    field(`incantesimo_${r}_3`, sc.range, ry, 64, th, { size: 8, rule: false });
    (["C", "R", "M"] as const).forEach((k, i) => check(`incantesimo_${r}_${k}`, [sc.c, sc.r, sc.m][i]! + 1, ry + (th - 9) / 2, 9));
    field(`incantesimo_${r}_7`, sc.note, ry, W - M - sc.note - 4, th, { size: 8, rule: false });
    if (r < n) line(M, ry + th, M + CW, ry + th, SOFT, 0.3);
  }
  [sc.name - 4, sc.time - 4, sc.range - 4, sc.c - 4, sc.note - 4].forEach((vx) => line(vx, top, vx, top + n * th, SOFT, 0.3));

  o.fill?.(form);
  form.updateFieldAppearances(reg);
  if (o.extra) {
    const extra = await PDFDocument.load(o.extra);
    for (const pg of await pdf.copyPages(extra, extra.getPageIndices())) pdf.addPage(pg);
  }
  return pdf.save();
}
