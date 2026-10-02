import { ABILITIES } from "../engine/schema";
import { SKILLS } from "../engine/schema";
import type { Ruleset } from "../engine/ruleset";
import type { Character } from "../engine/types";
import { STRINGS, type Lang } from "../i18n";
import { SRD_NOTICE } from "../legal/attribution";
import { A4, ACCENT, Doc, INK, LINE, MARGIN, MUTED, SOFT, type FontBytes } from "./pdfKit";
import { buildSheetData, type SheetData } from "./sheetData";

// Scheda PDF originale (A4, layout nostro): intestazione, caratteristiche e abilità, combattimento e attacchi, poi testi che scorrono
// su più pagine (privilegi, equipaggiamento, incantesimi). Ogni numero viene da buildSheetData, cioè dal motore.
const CW = A4.w - 2 * MARGIN;
type Pdf = (typeof STRINGS)["it"]["pdf"];

// Crea il PDF di un personaggio nella lingua indicata (i dati vanno letti da un ruleset della stessa lingua)
export const makeSheetPdf = (ch: Character, rs: Ruleset, lang: Lang, fonts: FontBytes) => buildSheetPdf(buildSheetData(ch, rs, lang), lang, fonts, rs);

export async function buildSheetPdf(d: SheetData, lang: Lang, fonts: FontBytes, rs: Ruleset): Promise<Uint8Array> {
  const P: Pdf = STRINGS[lang].pdf, AB: Record<string, string> = STRINGS[lang].wizard.abilities;
  const doc = await Doc.create(fonts, `${P.title}: ${d.name || "—"}`);
  header(doc, d, P);
  const top = doc.y;

  // colonna sinistra: sei caratteristiche
  const L = { x: MARGIN, w: 118 }, M = { x: MARGIN + 130, w: 168 }, R = { x: MARGIN + 310, w: CW - 310 };
  let ly = top;
  for (const a of ABILITIES) {
    const s = d.scores[a];
    doc.rect(L.x, ly, L.w, 62, { fill: SOFT, stroke: LINE });
    doc.text(AB[a]!.toUpperCase(), L.x, ly + 4, { size: 7, bold: true, color: MUTED, width: L.w, align: "center" });
    doc.text(s.mod, L.x, ly + 14, { size: 21, bold: true, width: L.w, align: "center" });
    doc.text(s.score, L.x, ly + 40, { size: 8.5, color: MUTED, width: L.w, align: "center" });
    doc.dot(L.x + 9, ly + 54, s.saveProf ? "proficient" : "none");
    doc.text(`${P.save} ${s.save}`, L.x + 16, ly + 50, { size: 7.5 });
    ly += 67;
  }

  // colonna centrale: abilità
  let my = top;
  doc.text(P.skills.toUpperCase(), M.x, my, { size: 8.5, bold: true, color: ACCENT });
  doc.line(M.x, my + 12, M.x + M.w, my + 12, ACCENT, 0.8);
  my += 18;
  for (const id of SKILLS) {
    const s = d.skills[id];
    if (!s) continue;
    doc.dot(M.x + 4, my + 5.5, s.prof);
    doc.text(s.value, M.x + 11, my, { size: 8.5, bold: true, width: 22, align: "right" });
    doc.text(rs.skills.get(id)?.name.it ?? id, M.x + 38, my, { size: 8.5 });
    doc.line(M.x, my + 13, M.x + M.w, my + 13, LINE, 0.3);
    my += 15.5;
  }

  // colonna destra: combattimento, attacchi, competenze
  let ry = top;
  const bw = (R.w - 20) / 3;
  const row = (items: [string, string, number?][]) => { items.forEach(([l, v, big], i) => doc.box(R.x + i * (bw + 10), ry, bw, 46, l, v, { big: big ?? 17 })); ry += 54; };
  row([[P.ac, d.ac], [P.initiative, d.initiative], [P.speed, d.speed, 12]]);
  row([[`${P.hp} · ${P.hpMax}`, d.hpMax], [`${P.hp} · ${P.hpNow}`, d.hpNow], [P.hitDice, d.hitDice || "—", 12]]);
  row([[P.pb, d.pb], [P.passive, d.passive], [P.inspiration, ""]]);
  if (d.inspiration) doc.dot(R.x + 2 * (bw + 10) + bw / 2, ry - 54 + 31, "proficient", 6);
  else doc.dot(R.x + 2 * (bw + 10) + bw / 2, ry - 54 + 31, "none", 6);

  doc.text(P.attacks.toUpperCase(), R.x, ry, { size: 8.5, bold: true, color: ACCENT });
  doc.line(R.x, ry + 12, R.x + R.w, ry + 12, ACCENT, 0.8);
  ry += 16;
  const cols = { n: R.x, b: R.x + 88, dmg: R.x + 118 };
  doc.text(P.atkName, cols.n, ry, { size: 7, color: MUTED }); doc.text(P.atkBonus, cols.b, ry, { size: 7, color: MUTED }); doc.text(P.atkDamage, cols.dmg, ry, { size: 7, color: MUTED });
  ry += 10;
  if (!d.attacks.length) { doc.text(P.noAttacks, R.x, ry, { size: 8, color: MUTED }); ry += 12; }
  for (const a of d.attacks) {
    doc.text(doc.wrap(a.name, 84, 8.5, true, 1)[0] ?? "", cols.n, ry, { size: 8.5, bold: true });
    doc.text(a.bonus, cols.b, ry, { size: 8.5 });
    doc.text(doc.wrap(a.damage, R.w - 118, 8.5, false, 1)[0] ?? "", cols.dmg, ry, { size: 8.5 });
    ry += 11;
    if (a.notes) for (const l of doc.wrap(a.notes, R.w, 7, false, 2)) { doc.text(l, R.x, ry, { size: 7, color: MUTED }); ry += 8.5; }
    doc.line(R.x, ry + 1, R.x + R.w, ry + 1, LINE, 0.3);
    ry += 4;
  }
  ry += 4;
  const armor = [d.armor.light && P.armorLight, d.armor.medium && P.armorMedium, d.armor.heavy && P.armorHeavy, d.armor.shield && P.armorShield].filter(Boolean).join(", ");
  for (const [label, text] of [[P.armor, armor], [P.weapons, d.weapons], [P.tools, d.tools], [P.languages, d.languages]] as const) {
    if (!text) continue;
    doc.text(label.toUpperCase(), R.x, ry, { size: 7, bold: true, color: ACCENT });
    ry += 9;
    for (const l of doc.wrap(text, R.w, 8)) { doc.text(l, R.x, ry, { size: 8 }); ry += 10.5; }
    ry += 3;
  }

  doc.y = Math.max(ly, my, ry) + 4;
  flow(doc, d, P);
  footer(doc, lang, P);
  return doc.pdf.save();
}

function header(doc: Doc, d: SheetData, P: Pdf) {
  doc.rect(MARGIN, MARGIN, CW, 52, { fill: SOFT, stroke: LINE });
  doc.rect(MARGIN, MARGIN, 5, 52, { fill: ACCENT });
  doc.text(d.name || "—", MARGIN + 16, MARGIN + 6, { size: 21, bold: true });
  const cls = `${d.klass} ${P.level} ${d.level}${d.subclass ? ` · ${d.subclass}` : ""}`;
  doc.text(cls, MARGIN + 16, MARGIN + 31, { size: 10, bold: true, color: ACCENT });
  const meta = [d.species, d.background, d.alignment, d.xp && `${P.xp} ${d.xp}`].filter(Boolean).join(" · ");
  doc.text(meta, MARGIN + 16 + doc.width(cls, 10, true) + 14, MARGIN + 32.5, { size: 8.5, color: MUTED });
  doc.y = MARGIN + 62;
}

// Parti che scorrono (anche su più pagine)
function flow(doc: Doc, d: SheetData, P: Pdf) {
  const list = (title: string, items: string[]) => {
    if (!items.length) return;
    doc.heading(title);
    for (const it of items) doc.para(it, MARGIN, CW, { size: 8, gap: 2.5 });
  };
  list(P.classFeatures, d.classFeatures);
  list(P.speciesTraits, d.speciesTraits);
  list(P.feats, d.feats);

  doc.heading(P.equipment);
  const bw = 60;
  doc.ensure(40);
  (["pp", "gp", "ep", "sp", "cp"] as const).forEach((k, i) => doc.box(MARGIN + i * (bw + 8), doc.y, bw, 34, k.toUpperCase(), d.coins[k], { big: 13 }));
  doc.y += 42;
  if (d.equipment.length) doc.para(d.equipment.join(", "), MARGIN, CW, { size: 8.5 });
  if (d.attunement.length) doc.para(`${P.attuned}: ${d.attunement.join(", ")}`, MARGIN, CW, { size: 8, color: MUTED });

  if (!d.spellAbility) return;
  doc.heading(P.spellcasting);
  doc.ensure(44);
  const items: [string, string][] = [[P.spellAbility, d.spellAbility], [P.spellMod, d.spellMod], [P.spellDc, d.spellDc], [P.spellAtk, d.spellAtk]];
  items.forEach(([l, v], i) => doc.box(MARGIN + i * 86, doc.y, 78, 36, l, v, { big: i === 0 ? 10 : 15 }));
  doc.text(P.slots, MARGIN + 350, doc.y - 1, { size: 6.5, color: MUTED });
  d.slots.forEach((n, i) => { if (n) doc.box(MARGIN + 350 + i * 20, doc.y + 8, 18, 28, `${i + 1}°`, n, { big: 11 }); });
  doc.y += 46;
  const c = { lv: MARGIN, name: MARGIN + 26, time: MARGIN + 200, range: MARGIN + 270, flags: MARGIN + 350, notes: MARGIN + 380 };
  const head = () => {
    doc.ensure(30);
    for (const [k, t] of [["lv", P.spellLevel], ["name", P.spellName], ["time", P.spellTime], ["range", P.spellRange]] as const) doc.text(t!, c[k], doc.y, { size: 7, bold: true, color: MUTED });
    doc.y += 10;
  };
  head();
  for (const s of d.spells) {
    if (doc.y + 12 > doc.bottom) { doc.newPage(); head(); }
    doc.text(s.level, c.lv, doc.y, { size: 8.5, bold: true });
    doc.text(doc.wrap(s.name, 168, 8.5, false, 1)[0] ?? "", c.name, doc.y, { size: 8.5 });
    doc.text(doc.wrap(s.time, 66, 8, false, 1)[0] ?? "", c.time, doc.y, { size: 8 });
    doc.text(doc.wrap(s.range, 76, 8, false, 1)[0] ?? "", c.range, doc.y, { size: 8 });
    doc.text([s.concentration && "C", s.ritual && "R", s.material && "M"].filter(Boolean).join(" "), c.flags, doc.y, { size: 8, bold: true, color: ACCENT });
    doc.text(doc.wrap(s.notes, A4.w - MARGIN - c.notes, 7, false, 1)[0] ?? "", c.notes, doc.y + 0.5, { size: 7, color: MUTED });
    doc.line(MARGIN, doc.y + 11, MARGIN + CW, doc.y + 11, LINE, 0.3);
    doc.y += 12.5;
  }
  doc.para(P.spellLegend, MARGIN, CW, { size: 7, color: MUTED });
}

// Su ogni pagina: dicitura CC-BY dell'SRD e numero di pagina
function footer(doc: Doc, lang: Lang, P: Pdf) {
  const n = doc.pages.length;
  doc.pages.forEach((page, i) => {
    doc.page = page;
    const top = A4.h - MARGIN - 21;
    doc.line(MARGIN, top - 3, MARGIN + CW, top - 3, LINE, 0.5);
    let y = top;
    for (const l of doc.wrap(SRD_NOTICE[lang], CW - 70, 5.8)) { doc.text(l, MARGIN, y, { size: 5.8, color: MUTED }); y += 6.8; }
    doc.text(P.page.replace("{n}", String(i + 1)).replace("{t}", String(n)), MARGIN, top, { size: 7, color: INK, width: CW, align: "right" });
  });
}
