import { ABILITIES } from "../engine/schema";
import { SKILLS } from "../engine/schema";
import type { Ruleset } from "../engine/ruleset";
import type { Character } from "../engine/types";
import { STRINGS, type Lang } from "../i18n";
import { DISCLAIMER, SRD_NOTICE } from "../legal/attribution";
import { A4, ACCENT, Doc, INK, LINE, MARGIN, MUTED, SOFT, type FontBytes } from "./pdfKit";
import { buildSheetData, type SheetData } from "./sheetData";

// Scheda PDF originale (A4, layout nostro): pagina 1 con tutto il necessario in gioco (caratteristiche, abilità, competenze, combattimento, attacchi),
// poi sezioni complete e separate (equipaggiamento, privilegi e tratti, incantesimi con le schede di dettaglio), ognuna con il suo spazio. Ogni numero viene da buildSheetData, cioè dal motore.
const CW = A4.w - 2 * MARGIN;
type Pdf = (typeof STRINGS)["it"]["pdf"];

// Crea il PDF di un personaggio nella lingua indicata (i dati vanno letti da un ruleset della stessa lingua)
export const makeSheetPdf = (ch: Character, rs: Ruleset, lang: Lang, fonts: FontBytes) => buildSheetPdf(buildSheetData(ch, rs, lang), lang, fonts, rs);

export async function buildSheetPdf(d: SheetData, lang: Lang, fonts: FontBytes, rs: Ruleset): Promise<Uint8Array> {
  const P: Pdf = STRINGS[lang].pdf, AB: Record<string, string> = STRINGS[lang].wizard.abilities;
  const doc = await Doc.create(fonts, `${P.title}: ${d.name || "—"}`);
  header(doc, d, P);
  const top = doc.y;

  // pagina 1, tre colonne: caratteristiche | abilità e competenze | combattimento e attacchi. Ognuna ha il suo spazio.
  const L = { x: MARGIN, w: 100 }, M = { x: MARGIN + 112, w: 150 }, R = { x: MARGIN + 274, w: CW - 274 };
  let ly = top;
  for (const a of ABILITIES) {
    const s = d.scores[a];
    doc.rect(L.x, ly, L.w, 52, { fill: SOFT, stroke: LINE });
    doc.text(AB[a]!.toUpperCase(), L.x, ly + 3, { size: 6.5, bold: true, color: MUTED, width: L.w, align: "center" });
    doc.text(s.mod, L.x, ly + 11, { size: 18, bold: true, width: L.w, align: "center" });
    doc.text(s.score, L.x, ly + 31, { size: 7.5, color: MUTED, width: L.w, align: "center" });
    doc.dot(L.x + 9, ly + 44, s.saveProf ? "proficient" : "none", 2.8);
    doc.text(`${P.save} ${s.save}`, L.x + 15, ly + 40.5, { size: 7 });
    ly += 56;
  }

  // colonna centrale: abilità, poi competenze
  let my = top;
  doc.text(P.skills.toUpperCase(), M.x, my, { size: 8, bold: true, color: ACCENT });
  doc.line(M.x, my + 11, M.x + M.w, my + 11, ACCENT, 0.8);
  my += 16;
  for (const id of SKILLS) {
    const s = d.skills[id];
    if (!s) continue;
    doc.dot(M.x + 4, my + 4.8, s.prof, 2.8);
    doc.text(s.value, M.x + 10, my, { size: 8, bold: true, width: 20, align: "right" });
    doc.text(rs.skills.get(id)?.name.it ?? id, M.x + 35, my, { size: 8 });
    doc.line(M.x, my + 11.5, M.x + M.w, my + 11.5, LINE, 0.3);
    my += 13;
  }
  my += 6;
  doc.text(P.proficiencies.toUpperCase(), M.x, my, { size: 8, bold: true, color: ACCENT });
  doc.line(M.x, my + 11, M.x + M.w, my + 11, ACCENT, 0.8);
  my += 15;
  const armor = [d.armor.light && P.armorLight, d.armor.medium && P.armorMedium, d.armor.heavy && P.armorHeavy, d.armor.shield && P.armorShield].filter(Boolean).join(", ");
  for (const [label, text] of [[P.armor, armor], [P.weapons, d.weapons], [P.tools, d.tools], [P.languages, d.languages]] as const) {
    if (!text) continue;
    doc.text(label.toUpperCase(), M.x, my, { size: 6.5, bold: true, color: MUTED });
    my += 8.5;
    for (const l of doc.wrap(text, M.w, 7.5)) { doc.text(l, M.x, my, { size: 7.5 }); my += 9.5; }
    my += 3;
  }

  // colonna destra: combattimento e attacchi
  let ry = top;
  const bw = (R.w - 16) / 3;
  const row = (items: [string, string, number?][]) => { items.forEach(([l, v, big], i) => doc.box(R.x + i * (bw + 8), ry, bw, 42, l, v, { big: big ?? 15 })); ry += 47; };
  row([[P.ac, d.ac], [P.initiative, d.initiative], [P.speed, d.speed, 11]]);
  row([[`${P.hp} · ${P.hpMax}`, d.hpMax], [`${P.hp} · ${P.hpNow}`, d.hpNow], [P.hitDice, d.hitDice || "—", 11]]);
  row([[P.pb, d.pb], [P.passive, d.passive], [P.inspiration, ""]]);
  doc.dot(R.x + 2 * (bw + 8) + bw / 2, ry - 47 + 28, d.inspiration ? "proficient" : "none", 5.5);

  doc.text(P.attacks.toUpperCase(), R.x, ry + 2, { size: 8, bold: true, color: ACCENT });
  doc.line(R.x, ry + 13, R.x + R.w, ry + 13, ACCENT, 0.8);
  ry += 18;
  const cols = { n: R.x, b: R.x + 96, dmg: R.x + 124 };
  doc.text(P.atkName, cols.n, ry, { size: 6.5, color: MUTED }); doc.text(P.atkBonus, cols.b, ry, { size: 6.5, color: MUTED }); doc.text(P.atkDamage, cols.dmg, ry, { size: 6.5, color: MUTED });
  ry += 9;
  if (!d.attacks.length) { doc.text(P.noAttacks, R.x, ry, { size: 7.5, color: MUTED }); ry += 12; }
  for (const a of d.attacks) {
    doc.text(doc.wrap(a.name, 92, 8, true, 1)[0] ?? "", cols.n, ry, { size: 8, bold: true });
    doc.text(a.bonus, cols.b, ry, { size: 8 });
    doc.text(doc.wrap(a.damage, R.w - 124, 8, false, 1)[0] ?? "", cols.dmg, ry, { size: 8 });
    ry += 10.5;
    if (a.notes) for (const l of doc.wrap(a.notes, R.w, 6.5, false, 2)) { doc.text(l, R.x, ry, { size: 6.5, color: MUTED }); ry += 8; }
    doc.line(R.x, ry + 1, R.x + R.w, ry + 1, LINE, 0.3);
    ry += 4;
  }

  doc.y = Math.max(ly, my, ry) + 6;
  flow(doc, d, P);
  footer(doc, lang, P);
  return doc.pdf.save();
}

function header(doc: Doc, d: SheetData, P: Pdf) {
  doc.rect(MARGIN, MARGIN, CW, 44, { fill: SOFT, stroke: LINE });
  doc.rect(MARGIN, MARGIN, 5, 44, { fill: ACCENT });
  doc.text(d.name || "—", MARGIN + 14, MARGIN + 4, { size: 18, bold: true });
  const cls = `${d.klass} ${P.level} ${d.level}${d.subclass ? ` · ${d.subclass}` : ""}`;
  doc.text(cls, MARGIN + 14, MARGIN + 27, { size: 9, bold: true, color: ACCENT });
  const meta = [d.species, d.background, d.alignment, d.xp && `${P.xp} ${d.xp}`].filter(Boolean).join(" · ");
  doc.text(meta, MARGIN + 14 + doc.width(cls, 9, true) + 12, MARGIN + 28, { size: 8, color: MUTED });
  doc.y = MARGIN + 52;
}

// Dopo la pagina 1 ogni sezione è completa e ha il suo spazio: un blocco intero sta sulla stessa pagina o passa alla successiva, mai spezzato a metà
function flow(doc: Doc, d: SheetData, P: Pdf) {
  const fresh = () => { if (doc.y > MARGIN + 1) doc.newPage(); };

  // equipaggiamento: resta in pagina 1 solo se ci sta tutto
  const eq = d.equipment.length ? doc.paraHeight(d.equipment.join(", "), CW, 8) : 0;
  const att = d.attunement.length ? doc.paraHeight(`${P.attuned}: ${d.attunement.join(", ")}`, CW, 7.5) : 0;
  doc.ensure(21 + 40 + eq + att);
  doc.heading(P.equipment);
  const bw = 56;
  (["pp", "gp", "ep", "sp", "cp"] as const).forEach((k, i) => doc.box(MARGIN + i * (bw + 8), doc.y, bw, 32, k.toUpperCase(), d.coins[k], { big: 12 }));
  doc.y += 40;
  if (d.equipment.length) doc.para(d.equipment.join(", "), MARGIN, CW, { size: 8 });
  if (d.attunement.length) doc.para(`${P.attuned}: ${d.attunement.join(", ")}`, MARGIN, CW, { size: 7.5, color: MUTED });

  // privilegi, tratti, talenti: pagina propria; ogni voce resta intera e il titolo si ripete se la sezione prosegue
  let first = true;
  const list = (title: string, items: string[]) => {
    if (!items.length) return;
    if (first) { fresh(); first = false; }
    doc.ensure(26 + Math.min(doc.paraHeight(items[0]!, CW, 7.5, 2.5), 60));
    doc.heading(title);
    for (const it of items) {
      const h = doc.paraHeight(it, CW, 7.5, 2.5);
      if (doc.y + h > doc.bottom && h < doc.bottom - MARGIN - 20) { doc.newPage(); doc.heading(`${title} ${P.cont}`); }
      doc.para(it, MARGIN, CW, { size: 7.5, gap: 2.5 });
    }
  };
  list(P.classFeatures, d.classFeatures);
  list(P.speciesTraits, d.speciesTraits);
  list(P.feats, d.feats);
  list(P.details, d.details);

  if (!d.spellAbility) return;
  fresh();
  doc.heading(P.spellcasting);
  const items: [string, string][] = [[P.spellAbility, d.spellAbility], [P.spellMod, d.spellMod], [P.spellDc, d.spellDc], [P.spellAtk, d.spellAtk]];
  items.forEach(([l, v], i) => doc.box(MARGIN + i * 80, doc.y, 74, 32, l, v, { big: i === 0 ? 9 : 14 }));
  doc.text(P.slots, MARGIN + 336, doc.y - 1, { size: 6.5, color: MUTED });
  d.slots.forEach((n, i) => { if (n) doc.box(MARGIN + 336 + i * 20, doc.y + 7, 18, 25, `${i + 1}°`, n, { big: 10 }); });
  doc.y += 40;
  const c = { lv: MARGIN, name: MARGIN + 22, time: MARGIN + 190, range: MARGIN + 262, flags: MARGIN + 344, notes: MARGIN + 366 };
  const head = () => {
    doc.ensure(30);
    for (const [k, t] of [["lv", P.spellLevel], ["name", P.spellName], ["time", P.spellTime], ["range", P.spellRange]] as const) doc.text(t!, c[k], doc.y, { size: 6.5, bold: true, color: MUTED });
    doc.y += 9;
  };
  head();
  for (const s of d.spells) {
    if (doc.y + 11 > doc.bottom) { doc.newPage(); head(); }
    doc.text(s.level, c.lv, doc.y, { size: 8, bold: true });
    doc.text(doc.wrap(s.name, 164, 8, false, 1)[0] ?? "", c.name, doc.y, { size: 8 });
    doc.text(doc.wrap(s.time, 66, 7.5, false, 1)[0] ?? "", c.time, doc.y, { size: 7.5 });
    doc.text(doc.wrap(s.range, 76, 7.5, false, 1)[0] ?? "", c.range, doc.y, { size: 7.5 });
    doc.text([s.concentration && "C", s.ritual && "R", s.material && "M"].filter(Boolean).join(" "), c.flags, doc.y, { size: 7.5, bold: true, color: ACCENT });
    doc.text(doc.wrap(s.notes, A4.w - MARGIN - c.notes, 6.5, false, 1)[0] ?? "", c.notes, doc.y + 0.5, { size: 6.5, color: MUTED });
    doc.line(MARGIN, doc.y + 10, MARGIN + CW, doc.y + 10, LINE, 0.3);
    doc.y += 11.5;
  }
  doc.para(P.spellLegend, MARGIN, CW, { size: 6.5, color: MUTED });

  // dettaglio: una scheda per incantesimo, su due colonne, ognuna intera
  if (!d.spells.length) return;
  fresh();
  doc.heading(P.spellDetails);
  const colW = (CW - 14) / 2, sz = 7, lh = sz * 1.35;
  let pageTop = doc.y, col = 0;
  const ys = [pageTop, pageTop];
  for (const s of d.spells) {
    const body = doc.wrap(s.summary, colW, sz), higher = s.higher ? doc.wrap(`${P.higher}: ${s.higher}`, colW, sz) : [], meta = doc.wrap(s.meta, colW, 6.5);
    const h = 11 + meta.length * 8.5 + (body.length + higher.length) * lh + 7;
    for (let k = 0; k < 2 && ys[col]! + h > doc.bottom; k++) {
      if (col === 0) col = 1;
      else { doc.newPage(); doc.heading(`${P.spellDetails} ${P.cont}`); pageTop = doc.y; ys[0] = ys[1] = pageTop; col = 0; }
    }
    const x = MARGIN + col * (colW + 14);
    let y = ys[col]!;
    doc.text(doc.wrap(s.name, colW, 8.5, true, 1)[0] ?? "", x, y, { size: 8.5, bold: true }); y += 11;
    for (const l of meta) { doc.text(l, x, y, { size: 6.5, color: MUTED }); y += 8.5; }
    for (const l of body) { doc.text(l, x, y, { size: sz }); y += lh; }
    for (const l of higher) { doc.text(l, x, y, { size: sz, color: MUTED }); y += lh; }
    doc.line(x, y + 2, x + colW, y + 2, LINE, 0.3);
    ys[col] = y + 7;
  }
  doc.y = Math.max(ys[0]!, ys[1]!);
}

// Su ogni pagina: dicitura CC-BY dell'SRD (testo esatto), avviso «non ufficiale» e numero di pagina
function footer(doc: Doc, lang: Lang, P: Pdf) {
  const n = doc.pages.length;
  doc.pages.forEach((page, i) => {
    doc.page = page;
    const top = A4.h - MARGIN - 31;
    doc.line(MARGIN, top - 3, MARGIN + CW, top - 3, LINE, 0.5);
    let y = top;
    for (const l of [...doc.wrap(SRD_NOTICE[lang], CW - 70, 5.8), ...doc.wrap(DISCLAIMER[lang], CW - 70, 5.8)]) { doc.text(l, MARGIN, y, { size: 5.8, color: MUTED }); y += 6.8; }
    doc.text(P.page.replace("{n}", String(i + 1)).replace("{t}", String(n)), MARGIN, top, { size: 7, color: INK, width: CW, align: "right" });
  });
}
