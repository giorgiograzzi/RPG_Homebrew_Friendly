import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Mattoncini per disegnare una scheda A4 con pdf-lib: pagine, testo a capo che va alla pagina dopo, riquadri, simboli.
// Le coordinate sono in punti, con l'origine in alto a sinistra (y cresce verso il basso).
export const A4 = { w: 595.28, h: 841.89 };
export const MARGIN = 34;
export const INK = rgb(0.13, 0.14, 0.2), MUTED = rgb(0.4, 0.42, 0.5), ACCENT = rgb(0.29, 0.33, 0.78), SOFT = rgb(0.93, 0.94, 0.98), LINE = rgb(0.72, 0.74, 0.84);
export interface FontBytes { regular: ArrayBuffer | Uint8Array; bold: ArrayBuffer | Uint8Array }
export interface TextOpts { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; width?: number; align?: "left" | "center" | "right" }

export class Doc {
  pages: PDFPage[] = [];
  page: PDFPage;
  y = MARGIN; // cursore verticale (dall'alto)
  readonly bottom = A4.h - MARGIN - 38; // sotto: spazio per il piè di pagina (dicitura, avviso e numero)

  private constructor(readonly pdf: PDFDocument, readonly regular: PDFFont, readonly bold: PDFFont) { this.page = this.addPage(); }
  static async create(fonts: FontBytes, title: string): Promise<Doc> {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const regular = await pdf.embedFont(fonts.regular, { subset: true });
    const bold = await pdf.embedFont(fonts.bold, { subset: true });
    pdf.setTitle(title); pdf.setCreator("RPG Homebrew Friendly"); pdf.setProducer("pdf-lib");
    return new Doc(pdf, regular, bold);
  }

  private addPage(): PDFPage { const p = this.pdf.addPage([A4.w, A4.h]); this.pages.push(p); return p; }
  newPage(): void { this.page = this.addPage(); this.y = MARGIN; }
  ensure(h: number): void { if (this.y + h > this.bottom) this.newPage(); }

  // Il carattere che il font non ha (la scheda deve sempre uscire) diventa "?"
  clean(s: string, bold = false): string {
    const set = new Set((bold ? this.bold : this.regular).getCharacterSet());
    return [...s.replace(/\s+/g, " ")].map((c) => (set.has(c.codePointAt(0)!) ? c : "?")).join("");
  }
  font = (bold?: boolean) => (bold ? this.bold : this.regular);
  width = (s: string, size: number, bold = false) => this.font(bold).widthOfTextAtSize(this.clean(s, bold), size);

  // Una riga di testo; `width` + `align` la posizionano dentro una casella. Ritorna la larghezza usata.
  text(s: string, x: number, top: number, o: TextOpts = {}): number {
    const size = o.size ?? 9, str = this.clean(s, o.bold);
    if (!str) return 0;
    const w = this.font(o.bold).widthOfTextAtSize(str, size);
    const dx = o.width && o.align === "center" ? (o.width - w) / 2 : o.width && o.align === "right" ? o.width - w : 0;
    this.page.drawText(str, { x: x + dx, y: A4.h - top - size * 0.82, size, font: this.font(o.bold), color: o.color ?? INK });
    return w;
  }
  // Testo a capo in una colonna; non spezza oltre `maxLines` (il resto è «…»)
  wrap(s: string, width: number, size: number, bold = false, maxLines = Infinity): string[] {
    const out: string[] = [];
    let line = "";
    for (const word of this.clean(s, bold).split(" ").filter(Boolean)) {
      const t = line ? `${line} ${word}` : word;
      if (this.width(t, size, bold) <= width || !line) line = t; else { out.push(line); line = word; }
    }
    if (line) out.push(line);
    if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = `${out[maxLines - 1]!.replace(/[\s.,;:]+$/, "")}…`; }
    return out;
  }
  // Paragrafo che scorre sulle pagine; ritorna la y finale
  para(s: string, x: number, width: number, o: { size?: number; bold?: boolean; color?: TextOpts["color"]; gap?: number } = {}): void {
    const size = o.size ?? 8.5, lh = size * 1.35;
    for (const l of this.wrap(s, width, size, o.bold)) { this.ensure(lh); this.text(l, x, this.y, { size, bold: o.bold, color: o.color }); this.y += lh; }
    this.y += o.gap ?? 3;
  }
  paraHeight(s: string, width: number, size = 8.5, gap = 3): number { return this.wrap(s, width, size).length * size * 1.35 + gap; }
  heading(s: string, x = MARGIN, width = A4.w - 2 * MARGIN): void {
    this.ensure(26);
    this.y += 4;
    this.text(s.toUpperCase(), x, this.y, { size: 8.5, bold: true, color: ACCENT });
    this.line(x, this.y + 12, x + width, this.y + 12, ACCENT, 0.8);
    this.y += 17;
  }

  rect(x: number, top: number, w: number, h: number, o: { fill?: ReturnType<typeof rgb>; stroke?: ReturnType<typeof rgb>; width?: number } = {}): void {
    this.page.drawRectangle({ x, y: A4.h - top - h, width: w, height: h, color: o.fill, borderColor: o.stroke, borderWidth: o.stroke ? o.width ?? 0.8 : 0 });
  }
  line(x1: number, y1: number, x2: number, y2: number, color = LINE, width = 0.6): void {
    this.page.drawLine({ start: { x: x1, y: A4.h - y1 }, end: { x: x2, y: A4.h - y2 }, color, thickness: width });
  }
  // Pallino di competenza: vuoto, mezzo, pieno, doppio (maestria)
  dot(cx: number, cy: number, level: "none" | "half" | "proficient" | "expertise", r = 3.2): void {
    const c = { x: cx, y: A4.h - cy };
    this.page.drawCircle({ ...c, size: r, borderColor: ACCENT, borderWidth: 0.8, color: level === "proficient" || level === "expertise" ? ACCENT : undefined });
    if (level === "half") this.page.drawCircle({ ...c, size: r / 2, color: ACCENT });
    if (level === "expertise") this.page.drawCircle({ ...c, size: r + 2, borderColor: ACCENT, borderWidth: 0.6 });
  }
  box(x: number, top: number, w: number, h: number, label: string, value: string, o: { big?: number } = {}): void {
    this.rect(x, top, w, h, { fill: SOFT, stroke: LINE });
    this.text(label, x, top + 4, { size: 6.5, color: MUTED, width: w, align: "center" });
    this.text(value, x, top + 12 + (h - 12 - (o.big ?? 16)) / 2 - 1, { size: o.big ?? 16, bold: true, width: w, align: "center" });
  }
}
