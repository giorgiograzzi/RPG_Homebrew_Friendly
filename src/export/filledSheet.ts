import type { PDFForm } from "pdf-lib";
import type { Ruleset } from "../engine/ruleset";
import { ABILITIES, SKILLS } from "../engine/schema";
import type { Character } from "../engine/types";
import type { Lang } from "../i18n";
import { buildBlankSheet } from "./blankSheet";
import type { FontBytes } from "./pdfKit";
import { buildContinuation } from "./sheetPdf";
import { buildSheetData, type SheetData } from "./sheetData";

// Scheda compilabile (italiano): riempie i campi del modulo con i dati del personaggio e accoda le pagine di continuazione con i testi completi.
// I numeri vengono da buildSheetData, cioè dal motore: la scheda stampata coincide con quella dell'app.
const AB_NAME: Record<(typeof ABILITIES)[number], string> = { str: "Forza", dex: "Destrezza", con: "Costituzione", int: "Intelligenza", wis: "Saggezza", cha: "Carisma" };
const SPELL_ROWS = 24;
const short = (s: string) => s.split(": ")[0]!; // nei campi del modulo bastano i nomi; il testo intero sta nelle pagine di continuazione

export const makeFilledSheet = (ch: Character, rs: Ruleset, lang: Lang, fonts: FontBytes) => buildFilledSheet(buildSheetData(ch, rs, lang), rs, lang, fonts);

export async function buildFilledSheet(d: SheetData, rs: Ruleset, lang: Lang, fonts: FontBytes): Promise<Uint8Array> {
  const extra = await buildContinuation(d, lang, fonts);
  return buildBlankSheet(fonts, { lang, extra, fill: (form) => fillForm(form, d, rs) });
}

export function fillForm(form: PDFForm, d: SheetData, rs: Ruleset): void {
  const put = (name: string, v: string) => { if (v) form.getTextField(name).setText(v); };
  const tick = (name: string, on: boolean) => { if (on) form.getCheckBox(name).check(); };

  put("nome_personaggio", d.name); put("classe", d.klass); put("livello", d.level); put("pe", d.xp);
  put("background", d.background); put("specie", d.species); put("sottoclasse", d.subclass); put("allineamento", d.alignment);
  put("classe_armatura", d.ac); tick("scudo", d.shield);
  put("pf_attuali", d.hpNow); put("pf_max", d.hpMax); put("dadi_vita_max", d.hitDice); put("dadi_vita_spesi", d.hitDiceUsed);
  put("bonus_competenza", d.pb); put("iniziativa", d.initiative); put("velocita", d.speed); put("taglia", d.size); put("percezione_passiva", d.passive);
  tick("ispirazione_eroica", d.inspiration);

  for (const a of ABILITIES) {
    const s = d.scores[a], n = AB_NAME[a];
    put(`${n}_punteggio`, s.score); put(`${n}_mod`, s.mod); put(`${n}_ts`, s.save); tick(`${n}_ts_competenza`, s.saveProf);
  }
  // le abilità hanno il nome della lingua del ruleset: si cerca il campo con lo stesso nome nel gruppo della caratteristica
  const byName = new Map(SKILLS.flatMap((id) => (d.skills[id] ? [[rs.skills.get(id)?.name.it ?? id, d.skills[id]!] as const] : [])));
  for (const f of form.getFields()) {
    const m = /^([^_]+)_(.+)_bonus$/.exec(f.getName());
    const sk = m && byName.get(m[2]!);
    if (!m || !sk) continue;
    put(f.getName(), sk.value); tick(`${m[1]}_${m[2]}_competenza`, sk.prof === "proficient" || sk.prof === "expertise");
  }

  d.attacks.forEach((a, i) => { const r = i + 1; if (r <= 8) { put(`arma_${r}_0`, a.name); put(`arma_${r}_1`, a.bonus); put(`arma_${r}_2`, a.damage); put(`arma_${r}_3`, a.notes); } });

  put("privilegi", d.classFeatures.map(short).join("\n"));
  put("tratti_specie", d.speciesTraits.map(short).join("\n"));
  put("talenti", d.feats.map(short).join("\n"));
  tick("armature_Leggera", d.armor.light); tick("armature_Media", d.armor.medium); tick("armature_Pesante", d.armor.heavy); tick("armature_Scudi", d.armor.shield);
  put("competenze_armi", d.weapons); put("competenze_strumenti", d.tools); put("lingue", d.languages);
  put("equipaggiamento", d.equipment.join(", "));
  d.attunement.slice(0, 3).forEach((x, i) => put(`sintonia_${i + 1}`, x));
  put("denari_MR", d.coins.cp); put("denari_MA", d.coins.sp); put("denari_ME", d.coins.ep); put("denari_MO", d.coins.gp); put("denari_MP", d.coins.pp);
  put("storia", d.details.join("\n"));

  put("caratteristica_incantatore", d.spellAbility); put("mod_incantatore", d.spellMod); put("cd_incantesimi", d.spellDc); put("bonus_attacco_incantesimi", d.spellAtk);
  d.slots.forEach((n, i) => put(`slot_${i + 1}_totali`, n));
  d.spells.slice(0, SPELL_ROWS).forEach((s, i) => {
    const r = i + 1;
    put(`incantesimo_${r}_0`, s.level); put(`incantesimo_${r}_1`, s.name); put(`incantesimo_${r}_2`, s.time); put(`incantesimo_${r}_3`, s.range); put(`incantesimo_${r}_7`, s.notes.length > 34 ? `${s.notes.slice(0, 33)}…` : s.notes);
    tick(`incantesimo_${r}_C`, s.concentration); tick(`incantesimo_${r}_R`, s.ritual); tick(`incantesimo_${r}_M`, s.material);
  });
}
