// Step 7: classi e sottoclassi dal PDF "01_Dati_Gioco" → data/private/{classes,subclasses}.json
// Uso: tsx scripts/extract-classes.ts [id,id,...]   (default: le classi con regole in class-rules.ts)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CLASS_RULES, type FeatureRule, type OptionList, type Table } from "./lib/class-rules";
import { equipment, itemNames, readKind } from "./lib/equipment";
import { bodyLines, pdfPages } from "./lib/pdf-text";
import { fixSpellModes } from "./lib/spells";

const SRC = process.env.RULES_DIR ?? "docs/rules";
const OUT = "data/private";
const only = process.argv[2]?.split(",") ?? Object.keys(CLASS_RULES);
const lines = bodyLines(await pdfPages(`${SRC}/01_Dati_Gioco_DnD2024.pdf`));

type Json = Record<string, any>;
const ABIL: Record<string, string> = { Forza: "str", Destrezza: "dex", Costituzione: "con", Intelligenza: "int", Saggezza: "wis", Carisma: "cha" };
const ARMOR: Record<string, string> = { leggere: "light", medie: "medium", pesanti: "heavy", scudi: "shield" };
// Armi: categorie semplici; "marziali con proprietà X" = categoria + filtro (lo interpreta il motore, step 9)
const WEAPON: Record<string, string> = {
  semplici: "simple", marziali: "martial",
  "marziali con proprietà Leggera": "martial[light]", "marziali Accurate o Leggere": "martial[finesse|light]",
};
const LIST: Record<string, string> = { Mago: "wizard", Chierico: "cleric", Druido: "druid" };
const skillId = new Map<string, string>(readKind("skills").map((s) => [s.name.it as string, s.id as string]));
const toolId = new Map<string, string>(readKind("tools").map((t) => [t.name.it as string, t.id as string]));
const items = itemNames();
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const abil = (s: string) => s.split(/, | o | e /).map((a) => ABIL[a.trim()] ?? (() => { throw new Error(`Caratteristica sconosciuta: "${a}"`); })());
const isHeader = (l: string) => /^Liv\s{3}Privilegio\s{3}Descrizione/.test(l);

// ---------- individuazione dei blocchi ----------
const CLASS_HEAD = /^(.+?) \((.+?)\)\s+\[(\w+)\]\s*$/;
const from = lines.findIndex((l) => l.trim() === "4. Classi");
const heads = lines.flatMap((l, i) => (i > from && CLASS_HEAD.test(l.trim()) && lines[i + 1]?.startsWith("Voce   Valore") ? [{ i, m: CLASS_HEAD.exec(l.trim())! }] : []));
const endOfClasses = lines.findIndex((l, i) => i > from && l.trim() === "5. Talenti");
if (heads.length !== 12) throw new Error(`Classi trovate: ${heads.length} (attese 12)`);

// ---------- privilegi (classe e sottoclasse) ----------
const ALWAYS = / ?Sempre preparati: ([a-z_]+(?:, [a-z_]+)*)/g; // "Sempre preparati: speak_with_animals"
const USI = / ?Usi: (\S+(?: \S+)*?) \/ Riposo (Lungo|Breve o Lungo|Breve)/g;

// Testo continuo "N Nome [id] descrizione N Nome [id] ..." → privilegi
function features(text: string, ctx: string): Json[] {
  const marks = [...text.matchAll(/\[([a-z_0-9 ]+?)\]/g)];
  if (!marks.length) throw new Error(`${ctx}: nessun privilegio`);
  const out: Json[] = [];
  let head = norm(text.slice(0, marks[0]!.index));
  marks.forEach((m, i) => {
    const gapEnd = i + 1 < marks.length ? marks[i + 1]!.index! : text.length;
    const gap = text.slice(m.index! + m[0].length, gapEnd);
    const usi = [...gap.matchAll(USI)][0];
    const always = [...gap.matchAll(ALWAYS)][0];
    const clean = norm(gap.replace(USI, "").replace(ALWAYS, ""));
    let desc = clean, next = "";
    if (i + 1 < marks.length) {
      const k = clean.lastIndexOf(". ");
      if (k < 0) throw new Error(`${ctx}/${m[1]}: confine col privilegio successivo non trovato`);
      desc = clean.slice(0, k + 1); next = clean.slice(k + 2);
    }
    const h = /^(\d{1,2}) (.+)$/.exec(head);
    if (!h) throw new Error(`${ctx}/${m[1]}: livello/nome non riconosciuti in "${head}"`);
    out.push({
      id: m[1]!.replace(/ /g, ""), name: { it: h[2] }, level: Number(h[1]), description: desc,
      effects: always ? always[1]!.split(", ").map((spell) => ({
        op: "grantSpell", spell, mode: "alwaysPrepared",
        ...(/senza slot 1 volta per Riposo Lungo/.test(desc) ? { freeCast: { uses: 1, recharge: "long_rest" } } : {}), // "lanciabile senza slot 1 volta per Riposo Lungo"
      })) : [], choices: [],
      _usi: usi ? [usi[1], usi[2]] : undefined,
    });
    head = next;
  });
  return out;
}

const usedRules = new Set<FeatureRule>();
const rulesFor = (rs: Record<string, FeatureRule> | undefined, f: Json): FeatureRule | undefined => {
  const r = rs?.[`${f.id}@${f.level}`] ?? rs?.[f.id];
  if (r) usedRules.add(r);
  return r;
};

function applyRules(fs: Json[], rs: Record<string, FeatureRule> | undefined, columns: Table) {
  for (const f of fs) {
    const r = rulesFor(rs, f);
    const fx = typeof r?.effects === "function" ? r.effects(columns) : r?.effects ?? [];
    f.effects.push(...fx);
    f.choices.push(...(r?.choices ?? []));
    if (f._usi) {
      const [what, rech] = f._usi as [string, string];
      const uses = columns[what] ? { table: columns[what] } : what.startsWith("max(") ? what.replace(/max\(1,(\w+)\)/, "max(1, mod:$1)") : Number(what) || what.replace(/livello/g, "level"); // "5*livello" (Imposizione delle mani)
      if (typeof uses === "object" && uses.table.some((v) => typeof v !== "number")) throw new Error(`${f.id}: colonna non numerica`);
      f.effects.push({ op: "resource", resourceId: f.id, uses, recharge: rech === "Lungo" ? "long_rest" : "short_rest", ...(r?.resource?.partialShortRest ? { partialShortRest: r.resource.partialShortRest } : {}) });
    }
    delete f._usi;
  }
}

// ---------- tabelle ----------
const val = (v: string): number | string => (v === "—" ? 0 : /^\+?\d+$/.test(v) ? Number(v.replace("+", "")) : v);

// Righe "livello   v1   v2 ..." di una tabella di sottoclasse → colonne da 20 valori (0/"" dove manca il livello)
function subTable(rows: string[], labels: string[], ctx: string) {
  const table: Table = {}; let slots: number[][] | undefined;
  const by = new Map<number, string[]>();
  for (const r of rows) {
    const t = r.trim().split(/\s{3,}/);
    if (!/^\d{1,2}$/.test(t[0]!) || t.length !== labels.length + 1) throw new Error(`${ctx}: riga di tabella non valida "${r}"`);
    by.set(Number(t[0]), t.slice(1));
  }
  labels.forEach((label, c) => {
    if (label === "Slot") slots = Array.from({ length: 20 }, (_, i) => (by.get(i + 1)?.[c] ?? "").split("/").filter(Boolean).map(Number));
    else table[slug(label)] = Array.from({ length: 20 }, (_, i) => { const v = by.get(i + 1)?.[c]; return v === undefined ? (label.startsWith("dado") ? "" : 0) : val(v); });
  });
  return { table, slots };
}

// ---------- elenchi di opzioni (Metamagia, Suppliche, Manovre) ----------
function optionList(text: string, ol: OptionList, ctx: string): { options: Json[]; trailer: string } {
  let body = text;
  let trailer = "";
  if (ol.trailer) { const k = body.indexOf(ol.trailer); if (k >= 0) { trailer = body.slice(k).trim(); body = body.slice(0, k); } }
  const marks = [...body.matchAll(/\[([a-z_0-9 ]+?)\]/g)];
  if (!marks.length) throw new Error(`${ctx}: elenco vuoto`);
  const raw: { id: string; name: string; rest: string }[] = [];
  let name = norm(body.slice(0, marks[0]!.index));
  marks.forEach((m, i) => {
    const seg = norm(body.slice(m.index! + m[0].length, i + 1 < marks.length ? marks[i + 1]!.index : undefined));
    let own = seg, next = "";
    if (i + 1 < marks.length) {
      const k = seg.lastIndexOf(". ");
      if (k < 0) throw new Error(`${ctx}/${m[1]}: confine col successivo non trovato`);
      own = seg.slice(0, k + 1); next = seg.slice(k + 2);
    }
    raw.push({ id: m[1]!.replace(/ /g, ""), name, rest: own });
    name = next;
  });
  const names = raw.map((r) => r.name);
  // prerequisiti delle invocazioni: "—", nome di un'altra invocazione, o "un trucchetto da Warlock ... danni"
  const prereq = new RegExp(`^(—|un trucchetto da Warlock(?: con tiro per colpire)? che infligge danni|${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}) `);
  const byName = new Map(raw.map((r) => [r.name, r.id]));
  const options = raw.map((r) => {
    if (ol.kind === "cost") {
      const m = /^(\d+) (.*)$/.exec(r.rest)!;
      return { id: r.id, name: { it: r.name }, description: m[2], cost: Number(m[1]), effects: [] };
    }
    if (ol.kind === "plain") return { id: r.id, name: { it: r.name }, description: r.rest, effects: [] };
    const m = /^(\d+) (.*)$/.exec(r.rest);
    const p = m && prereq.exec(m[2]!);
    if (!m || !p) throw new Error(`${ctx}/${r.id}: prerequisito non riconosciuto in "${r.rest.slice(0, 70)}"`);
    const conds = [`classLevel:warlock>=${m[1]}`];
    let pre = p[1]!;
    const req = byName.get(pre);
    if (req) conds.push(`hasFeature:${req}`);
    else if (pre !== "—") pre = `${pre}`;
    return { id: r.id, name: { it: r.name }, description: (pre !== "—" && !req ? `Prerequisito: ${pre}. ` : "") + m[2]!.slice(p[0].length), requires: conds.join(" && "), effects: [] };
  });
  return { options, trailer };
}

// ---------- una classe ----------
const classes: Json[] = [], subclasses: Json[] = [];
heads.forEach((h, hi) => {
  const id = h.m[3]!;
  if (!only.includes(id)) return;
  const rule = CLASS_RULES[id];
  if (!rule) throw new Error(`Classe senza regole: ${id}`);
  const block = lines.slice(h.i + 1, hi + 1 < heads.length ? heads[hi + 1]!.i : endOfClasses).map((l) => l.replace(/\s+$/, ""));
  const idx = (t: string) => block.findIndex((l) => l.trim() === t);
  const iProg = idx("Progressione"), iFeat = idx("Privilegi di classe"), iSub = block.findIndex((l) => l.startsWith("Sottoclassi del"));
  const iOpt = rule.optionList ? idx(rule.optionList.heading) : -1;

  // -- tabella Voce / Valore --
  const F: Record<string, string> = {}; let cur = "";
  for (const l of block.slice(1, iProg)) {
    const m = /^(Dado Vita|Caratteristica primaria|Tiri salvezza|Abilità|Armi|Armature|Strumenti|Equipaggiamento|Multiclasse|Incantesimi|Note)\s{3}(.*)$/.exec(l);
    if (m) { cur = m[1]!; F[cur] = m[2]!; } else F[cur] += " " + l.trim();
  }
  for (const k of Object.keys(F)) F[k] = norm(F[k]!);
  const hitDie = Number(/^d(\d+)/.exec(F["Dado Vita"]!)![1]);
  const sk = /^(\d+) tra: (.+)$/.exec(F["Abilità"]!)!;
  const skillList = sk[2] === "qualsiasi" ? "any" : sk[2]!.split(", ").map((n) => skillId.get(n) ?? (() => { throw new Error(`Abilità sconosciuta: ${n}`); })());
  const eq: Json = {};
  for (const o of F["Equipaggiamento"]!.split(/(?:^| )(?=[ABC] : )/).filter(Boolean)) eq[o[0]!] = equipment(o.slice(4), items);
  const tools = F["Strumenti"] === "nessuno" ? [] : F["Strumenti"]!.split(", ");
  const fixedTools = tools.filter((t) => toolId.has(t)).map((t) => toolId.get(t)!);
  const picks = tools.flatMap((t) => {
    const m = /^(\d+) (Strumento musicale|Strumenti da artigiano o Strumento musicale)$/.exec(t);
    return m ? [{ count: Number(m[1]), source: m[2] === "Strumento musicale" ? "tools:musical" : "tools:artisan_musical" }] : [];
  });
  const unknownTool = tools.find((t) => !toolId.has(t) && !/^(\d+) (Strumento musicale|Strumenti da artigiano o Strumento musicale)$/.test(t));
  if (unknownTool) throw new Error(`${id}: strumento sconosciuto "${unknownTool}"`);
  const mc = /^Requisito: (.+?)\. Ottieni: (.+)$/.exec(F["Multiclasse"]!)!;
  // Competenze che si ottengono prendendo un livello in questa classe come NON prima (riga "Ottieni:" del file 01)
  const multiclass = parseMulticlass(mc[2]!, id, new Set(toolId.values()));
  const req = mc[1]!.replace(/ oppure /g, " || ").replace(/ e /g, " && ").replace(/(\w+) 13/g, (_, a) => `ability:${ABIL[a]}>=13`);
  const spell = F["Incantesimi"] ? /^Tipo: (.+?); caratteristica (\w+); lista (\w+); (.*)$/.exec(F["Incantesimi"]!) : null;
  if (F["Incantesimi"] && !spell) throw new Error(`${id}: riga Incantesimi non riconosciuta: ${F["Incantesimi"]}`);
  const CASTER: Record<string, string> = { completo: "full", mezzo: "half", terzo: "third", "magia del patto": "pact" };
  if (spell && !CASTER[spell[1]!]) throw new Error(`${id}: tipo di incantatore sconosciuto "${spell[1]}"`);
  const notes = [F["Note"], spell?.[4]].filter(Boolean).join(" ");

  // -- tabella di progressione --
  const firstRow = block.findIndex((l, i) => i > iProg && /^\d{1,2}\s{3}\+\d/.test(l));
  const hdr = norm(block.slice(iProg + 1, firstRow).join(" "));
  const wantHdr = "Liv Comp. Privilegi " + rule.columns.join(" ");
  if (slug(hdr).replace(/_/g, "") !== slug(wantHdr).replace(/_/g, "")) throw new Error(`${id}: intestazione tabella "${hdr}" ≠ "${wantHdr}"`);
  const rows: { lv: number; pb: number; names: string[]; vals: string[] }[] = [];
  let acc = "";
  const flush = () => {
    if (!acc) return;
    const m = /^(\d{1,2})\s{3}\+(\d)\s{3}(.*)$/.exec(acc)!;
    const toks = m[3]!.split(/\s{3,}/);
    if (toks.length !== rule.columns.length + 1) throw new Error(`${id}: riga livello ${m[1]}: ${toks.length} celle, attese ${rule.columns.length + 1} ("${acc}")`);
    rows.push({ lv: Number(m[1]), pb: Number(m[2]), names: toks[0] === "—" ? [] : toks[0]!.split(", "), vals: toks.slice(1) });
    acc = "";
  };
  for (const l of block.slice(firstRow, iFeat)) {
    if (/^\d{1,2}\s{3}\+\d/.test(l)) { flush(); acc = l.trim(); }
    else if (acc && !l.startsWith("Slot =")) {
      // riga di soli valori (le colonne finite a capo) → si unisce con 3 spazi, altrimenti è testo dei privilegi
      acc += (/^[\d+—dD/×.a-z ]+$/.test(l.trim()) && /\s{3}/.test(l) && /^[\d+—d]/.test(l.trim()) ? "   " : " ") + l.trim();
    }
  }
  flush();
  if (rows.length !== 20 || rows.some((r, i) => r.lv !== i + 1)) throw new Error(`${id}: righe della tabella: ${rows.length}`);
  const table: Table = {}; let slots: number[][] | undefined; let pact: { count: number; level: number }[] | undefined;
  rule.columns.forEach((label, c) => {
    const col = rows.map((r) => r.vals[c]!);
    if (label === "Slot") {
      if (col.every((v) => /^\d+ × liv\.\d+$/.test(v))) pact = col.map((v) => { const m = /^(\d+) × liv\.(\d+)$/.exec(v)!; return { count: Number(m[1]), level: Number(m[2]) }; });
      else slots = col.map((v) => v.split("/").map(Number));
      return;
    }
    table[slug(label)] = col.map(val);
  });

  // -- privilegi di classe (e, se c'è, elenco di opzioni) --
  const featEnd = [iOpt, iSub].filter((x) => x >= 0).sort((a, b) => a - b)[0];
  const featText = block.slice(iFeat + 1, featEnd).filter((l) => !isHeader(l)).join(" ");
  const fs = features(featText, id);
  applyRules(fs, rule.featureRules, table);
  // Aumento dei punteggi di caratteristica / Dono epico: il talento si sceglie in una scelta per livello (chiave <tipo>_<classe>_<livello>)
  for (const f of fs) {
    if (f.id === "ability_score_improvement") f.choices.push({ id: `asi_${id}_${f.level}`, label: { it: "Talento (Aumento dei punteggi o talento generale)" }, count: 1, source: "feats:general" });
    if (f.id === "epic_boon") f.choices.push({ id: `epic_boon_${id}_${f.level}`, label: { it: "Dono epico" }, count: 1, source: "feats:epic_boon" });
  }
  for (const r of rows) {
    const have = fs.filter((f) => f.level === r.lv).map((f) => f.name.it as string).sort().join("|");
    const want = r.names.filter((n) => n !== "Privilegio di sottoclasse").sort().join("|");
    if (have !== want) throw new Error(`${id} liv.${r.lv}: privilegi ${have} ≠ tabella ${want}`);
  }

  // -- scelte di classe --
  const choices: Json[] = [];
  choices.push(skillList === "any"
    ? { id: `${id}_skills`, label: { it: "Abilità" }, count: Number(sk[1]), source: "skills" }
    : { id: `${id}_skills`, label: { it: "Abilità" }, count: Number(sk[1]), options: skillList.map((s) => ({ id: s, name: { it: s }, effects: [{ op: "grantSkillProficiency", skills: [s] }] })) });
  picks.forEach((p, i) => choices.push({ id: `${id}_tools${i ? i + 1 : ""}`, label: { it: "Strumenti" }, count: p.count, source: p.source }));
  if (table["maestria_armi"]) choices.push({ id: `${id}_weapon_mastery`, label: { it: "Maestria nelle armi" }, count: 1, countFrom: "maestria_armi", source: "weaponMastery", ...(id === "barbarian" ? { weaponFilter: { kind: "melee" } } : {}) }); // Barbaro: solo armi da mischia (file 03 §3c)
  if (spell) {
    if (table["trucchetti"]) choices.push({ id: `${id}_cantrips`, label: { it: "Trucchetti" }, count: 1, countFrom: "trucchetti", source: `cantrips:${spell[3]}` });
    choices.push({ id: `${id}_prepared`, label: { it: "Incantesimi preparati" }, count: 1, countFrom: "preparati", source: `spells:${spell[3]}` });
  }
  let optionsNote = "";
  if (rule.optionList) {
    const ol = rule.optionList;
    const optLines = block.slice(iOpt + 1, iSub).filter((l) => !/^(Opzione|Invocazione|Manovra)\s{3}/.test(l) && l.trim() !== "min" && !/^Prerequisito\s{3}Effetto/.test(l));
    const { options, trailer } = optionList(optLines.join(" "), ol, `${id}/${ol.choiceId}`);
    choices.push({ id: ol.choiceId, label: { it: ol.label }, count: 1, ...(ol.countFrom ? { countFrom: ol.countFrom } : {}), options });
    optionsNote = trailer;
  }

  // -- sottoclassi --
  const subs = iSub < 0 ? [] : block.slice(iSub + 1);
  const sh = subs.flatMap((l, i) => (CLASS_HEAD.test(l.trim()) ? [{ i, m: CLASS_HEAD.exec(l.trim())! }] : []));
  sh.forEach((s, si) => {
    const sid = s.m[3]!;
    const sb = subs.slice(s.i + 1, si + 1 < sh.length ? sh[si + 1]!.i : undefined);
    const iH = sb.findIndex((l) => isHeader(l));
    if (iH < 0) throw new Error(`${id}/${sid}: intestazione privilegi non trovata`);
    const iMan = sb.findIndex((l) => l.trim() === "Manovre");
    // tabella dei compagni (Signore delle bestie): resta come testo nella descrizione della sottoclasse
    const iComp = sb.findIndex((l) => /^Compagno\s{3}/.test(l));
    const fend = [iMan, iComp].filter((x) => x >= 0).sort((a, b) => a - b)[0];
    const compText = iComp >= 0 ? norm(sb.slice(iComp).join(" ")) : "";
    // testo prima della tabella dei privilegi: incantesimi, titolo e tabella propria della sottoclasse
    const preLines = sb.slice(0, iH);
    const iT = preLines.findIndex((l) => /^Liv\.(\s|$)/.test(l));
    const textLines = iT < 0 ? preLines : preLines.slice(0, iT);
    const tableLines = iT < 0 ? [] : preLines.slice(iT);
    const title = /^Tabella incantesimi \((.+?)\)$/.exec(norm(textLines.filter((l) => l.startsWith("Tabella incantesimi")).join(" ")));
    const pre = norm(textLines.filter((l) => !l.startsWith("Tabella incantesimi")).join(" "));
    const effects: Json[] = [], subChoices: Json[] = [];
    const sp = /^Incantesimi sempre preparati — (.+)$/.exec(pre);
    const terr = /^Incantesimi per terreno — (.+)$/.exec(pre); // Circolo della Terra: un elenco per ogni terreno
    if (pre && !sp && !terr) throw new Error(`${id}/${sid}: testo prima della tabella non riconosciuto: "${pre}"`);
    const spellsAt = (list: string, fx: Json[]) => {
      for (const part of list.split("; ")) {
        const m = /^(?:liv\.\s*)?(\d+): (.+)$/.exec(part.trim())!;
        for (const spellId of m[2]!.split(", ")) fx.push({ op: "grantSpell", spell: spellId, mode: "alwaysPrepared", when: `classLevel:${id}>=${m[1]}` });
      }
    };
    if (sp) spellsAt(sp[1]!, effects);
    if (terr) {
      subChoices.push({ id: `${sid}_terrain`, label: { it: "Terreno" }, count: 1, options: terr[1]!.split(" | ").map((t) => {
        const [tid, rest] = t.split(/: (.*)/s) as [string, string];
        const fx: Json[] = []; spellsAt(rest, fx);
        return { id: tid, name: { it: tid }, effects: fx };
      }) });
    }
    let st: ReturnType<typeof subTable> | undefined;
    const extra: Json = {};
    if (tableLines.length) {
      const labels = tableLines[0]!.trim().split(/\s{3,}/).slice(1);
      st = subTable(tableLines.slice(1).filter((l) => !/^Liv\.(\s|$)/.test(l)), labels, `${id}/${sid}`);
      extra.table = st.table;
      if (title) {
        const m = /^terzo incantatore, (\w+), lista (\w+)$/.exec(title[1]!)!;
        Object.assign(extra, { caster: "third", spellAbility: ABIL[m[1]!], spellList: LIST[m[2]!], spellSlots: st.slots });
        subChoices.push({ id: `${sid}_cantrips`, label: { it: "Trucchetti" }, count: 1, countFrom: "trucchetti", source: `cantrips:${LIST[m[2]!]}` });
        subChoices.push({ id: `${sid}_prepared`, label: { it: "Incantesimi preparati" }, count: 1, countFrom: "preparati", source: `spells:${LIST[m[2]!]}` });
      }
    }
    const sf = features(sb.slice(iH + 1, fend).filter((l) => !isHeader(l)).join(" "), `${id}/${sid}`);
    applyRules(sf, rule.subclassRules?.[sid], { ...table, ...(st?.table ?? {}) }); // le regole vedono anche la tabella della sottoclasse
    // scelta "abilità della lista di classe" → le abilità della classe (o qualsiasi)
    for (const f of sf) for (const c of f.choices) {
      if (c.source !== "classSkills") continue;
      if (skillList === "any") c.source = "skills";
      else { delete c.source; c.options = skillList.map((sk2) => ({ id: sk2, name: { it: sk2 }, effects: [{ op: "grantSkillProficiency", skills: [sk2] }] })); }
    }
    // Circolo della Terra: la resistenza di "Protezione della natura" dipende dal terreno scelto
    const ward = sf.find((f) => f.id === "natures_ward");
    const terrChoice = subChoices.find((c) => c.id === `${sid}_terrain`);
    if (ward && terrChoice) {
      const TERR: Record<string, string> = { Arido: "arid", Polare: "polar", Temperato: "temperate", Tropicale: "tropical" };
      const DMG: Record<string, string> = { fuoco: "fire", freddo: "cold", fulmine: "lightning", veleno: "poison" };
      const found = [...ward.description.matchAll(/(Arido|Polare|Temperato|Tropicale) (fuoco|freddo|fulmine|veleno)/g)];
      if (found.length !== 4) throw new Error(`${id}/${sid}: resistenze per terreno non riconosciute in natures_ward`);
      for (const m of found) terrChoice.options.find((o: Json) => o.id === TERR[m[1]!])!.effects.push({ op: "resistance", types: [DMG[m[2]!]], when: `classLevel:${id}>=${ward.level}` });
    }
    if (iMan >= 0) {
      const ol: OptionList = { heading: "Manovre", choiceId: `${sid}_maneuvers`, label: "Manovre", countFrom: "manovre_note", kind: "plain" };
      const txt = sb.slice(iMan + 1).filter((l) => !/^Manovra\s{3}/.test(l)).join(" ");
      subChoices.push({ id: ol.choiceId, label: { it: ol.label }, count: 1, countFrom: ol.countFrom, options: optionList(txt, ol, `${id}/${sid}`).options });
    }
    subclasses.push({ id: sid, name: { it: s.m[1], en: s.m[2] }, classId: id, description: compText, effects, choices: subChoices, features: sf, ...extra });
  });

  classes.push({
    id, name: { it: h.m[1], en: h.m[2] }, hitDie, primaryAbility: abil(F["Caratteristica primaria"]!), saves: abil(F["Tiri salvezza"]!),
    skillChoices: { count: Number(sk[1]), from: skillList }, armorTraining: F["Armature"] === "nessuna" ? [] : F["Armature"]!.split(", ").map((a) => ARMOR[a] ?? (() => { throw new Error(`Armatura sconosciuta: ${a}`); })()),
    weaponProficiency: F["Armi"]!.split(/, (?=semplici|marziali)/).map((w) => WEAPON[w] ?? (() => { throw new Error(`Armi sconosciute: "${w}"`); })()), toolProficiency: fixedTools,
    ...(spell ? { caster: CASTER[spell[1]!], spellAbility: ABIL[spell[2]!], spellList: spell[3] } : {}),
    description: [notes, optionsNote].filter(Boolean).join(" "),
    ...(slots ? { spellSlots: slots } : {}), ...(pact ? { pactSlots: pact } : {}), multiclassRequirement: req, multiclass, equipment: eq,
    features: fs, table, subclassLevel: 3, choices,
  });
});

// ogni regola scritta a mano deve aver trovato il suo privilegio (altrimenti un id è sbagliato)
for (const cid of only) {
  const r = CLASS_RULES[cid];
  const all = [...Object.entries(r?.featureRules ?? {}).map(([k, v]) => [`${cid}/${k}`, v] as const),
    ...Object.entries(r?.subclassRules ?? {}).flatMap(([sc, m]) => Object.entries(m).map(([k, v]) => [`${cid}/${sc}/${k}`, v] as const))];
  const unused = all.filter(([, v]) => !usedRules.has(v)).map(([k]) => k);
  if (unused.length) throw new Error(`Regole senza privilegio corrispondente: ${unused.join(", ")}`);
}

// unisce con quanto già estratto (7a poi 7b)
function merge(kind: string, fresh: Json[]) {
  const path = `${OUT}/${kind}.json`;
  const old: Json[] = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).entries : [];
  const ids = new Set(fresh.map((e) => e.id));
  const all = [...old.filter((e) => !ids.has(e.id)), ...fresh];
  writeFileSync(path, JSON.stringify({ kind, entries: all }, null, 1) + "\n");
  console.log(`${kind.padEnd(17)} ${all.length} (${fresh.length} aggiornate)`);
}
fixSpellModes(classes, "classes");
fixSpellModes(subclasses, "subclasses");
merge("classes", classes);
merge("subclasses", subclasses);

// "Dado Vita, armi marziali, armature leggere, medie, scudi, 1 abilità, 1 strumento, Arnesi da scasso" → competenze strutturate
function parseMulticlass(text: string, classId: string, toolIds: Set<string>) {
  const out = { weapons: [] as string[], armor: [] as string[], skills: 0, toolChoices: 0, tools: [] as string[] };
  const parts = text.split(", ").map((x) => x.trim());
  let mode: "armor" | "weapons" | "" = "";
  const ARMOR: Record<string, string> = { leggere: "light", medie: "medium", pesanti: "heavy", scudi: "shield" };
  for (const p of parts) {
    let m: RegExpExecArray | null;
    if (p === "Dado Vita") { mode = ""; continue; }
    if ((m = /^armature (\w+)$/.exec(p)) && ARMOR[m[1]!]) { mode = "armor"; out.armor.push(ARMOR[m[1]!]!); continue; }
    if (mode === "armor" && ARMOR[p]) { out.armor.push(ARMOR[p]!); continue; }
    if ((m = /^armi (semplici|marziali)$/.exec(p))) { mode = "weapons"; out.weapons.push(m[1] === "semplici" ? "simple" : "martial"); continue; }
    if (mode === "weapons" && (m = /^marziali con proprietà Leggera$/.exec(p))) { out.weapons.push("martial[light]"); continue; }
    if ((m = /^(\d+) abilità$/.exec(p))) { out.skills = Number(m[1]); mode = ""; continue; }
    if ((m = /^(\d+) strumento$/.exec(p))) { out.toolChoices = Number(m[1]); mode = ""; continue; }
    if (p === "Arnesi da scasso" && toolIds.has("thieves_tools")) { out.tools.push("thieves_tools"); mode = ""; continue; }
    throw new Error(`${classId}: competenza multiclasse non riconosciuta "${p}" in "${text}"`);
  }
  return out;
}
