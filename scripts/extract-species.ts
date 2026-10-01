// Step 2c — Specie. I dati stanno in scripts/lib/species-srd.ts; questo script li VERIFICA contro i due PDF in docs/srd/
// (taglia, velocità, scurovisione, frasi chiave di ogni tratto, tabella degli antenati draconici, tabelle di lignaggi e
// retaggi con i loro incantesimi) e poi scrive data/srd/<lingua>/species.json. Se un controllo fallisce non scrive nulla.
import { DRAGON_TABLE, LINEAGES, SPECIES, SPELL_NAMES } from "./lib/species-srd";
import { pageText, writeKind, type Entry, type Lang } from "./lib/srd";
import { joinProse } from "./lib/srd-clean";

const errors: string[] = [];
const fail = (m: string) => errors.push(m);
const norm = (s: string) => s.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();

const CFG = {
  en: { pages: [84, 87] as [number, number], head: (n: string) => `${n} creature type:`, header: /size: (.+?) speed: (\d+) feet/, ft: (n: string) => Number(n), dark: /darkvision with a range of (\d+) feet/, small: "small", medium: "medium", end: "feats feat descriptions" },
  it: { pages: [93, 97] as [number, number], head: (n: string) => `${n} tipo di creatura:`, header: /taglia: (.+?) velocità: ([\d,]+) metri/, ft: (n: string) => Math.round((Number(n.replace(",", ".")) * 10) / 3), dark: /scurovisione fino a un raggio di ([\d,]+) metri/, small: "piccola", medium: "media", end: "talenti descrizioni dei talenti" },
} as const;
const NAME = (l: Lang, d: { en: string; it: string }) => norm(d[l]);

for (const l of ["en", "it"] as Lang[]) {
  const cfg = CFG[l];
  const all = norm(joinProse(await pageText(l, cfg.pages[0], cfg.pages[1])));
  const start = all.indexOf(l === "en" ? "species descriptions" : "descrizioni delle specie");
  const sec = all.slice(start < 0 ? 0 : start);
  // posizione di ogni specie
  const pos = SPECIES.map((d) => ({ d, i: sec.indexOf(cfg.head(NAME(l, d))) }));
  for (const p of pos) if (p.i < 0) fail(`${l}: specie "${p.d[l]}" non trovata`);
  const sorted = pos.filter((p) => p.i >= 0).sort((a, b) => a.i - b.i);
  const endAt = sec.indexOf(cfg.end) > 0 ? sec.indexOf(cfg.end) : sec.length;
  for (const [k, p] of sorted.entries()) {
    const block = sec.slice(p.i, sorted[k + 1]?.i ?? endAt);
    const where = `${l}/${p.d.id}`;
    const h = cfg.header.exec(block);
    if (!h) { fail(`${where}: intestazione taglia/velocità non letta`); continue; }
    const sizes = [h[1]!.includes(cfg.medium) ? "medium" : null, h[1]!.includes(cfg.small) ? "small" : null].filter(Boolean).sort().join();
    if (sizes !== [...p.d.sizes].sort().join()) fail(`${where}: taglie ${sizes} nel PDF, nei dati ${p.d.sizes}`);
    if (cfg.ft(h[2]!) !== p.d.speed) fail(`${where}: velocità ${cfg.ft(h[2]!)} ft nel PDF, nei dati ${p.d.speed}`);
    const dv = cfg.dark.exec(block);
    const dvFt = dv ? cfg.ft(dv[1]!) : undefined;
    if (dvFt !== p.d.darkvision) fail(`${where}: scurovisione ${dvFt} nel PDF, nei dati ${p.d.darkvision}`);
    for (const ph of p.d.expect[l]) if (!block.includes(norm(ph))) fail(`${where}: frase "${ph}" non trovata nel PDF`);
    for (const ph of p.d.tables?.[l] ?? []) if (!sec.includes(norm(ph))) fail(`${where}: frase di tabella "${ph}" non trovata nel PDF`);
    // i tratti (nome) devono comparire nel blocco della specie
    for (const t of p.d.traits ?? []) {
      const n = norm((t.name as { it: string; en: string })[l]);
      if (!sec.includes(n.split(": ")[0]!)) fail(`${where}: tratto "${n}" non trovato nel PDF`);
    }
  }
  if (sorted.length !== SPECIES.length) fail(`${l}: attese ${SPECIES.length} specie, trovate ${sorted.length}`);

  // antenati draconici
  const dm = l === "en" ? /draconic ancestors dragon damage type dragon damage type (.+?) breath weapon/.exec(sec) : /antenati draconici drago tipo di danni drago tipo di danni (.+?) soffio/.exec(sec);
  if (!dm) fail(`${l}: tabella degli antenati draconici non trovata`);
  else {
    const DMG_IT: Record<string, string> = { freddo: "cold", fuoco: "fire", fulmine: "lightning", acido: "acid", veleno: "poison" };
    const toks = dm[1]!.split(" ");
    const got: Record<string, string> = {};
    for (let i = 0; i + 1 < toks.length; i += 2) got[toks[i]!] = l === "en" ? toks[i + 1]! : DMG_IT[toks[i + 1]!]!;
    for (const r of DRAGON_TABLE) if (got[norm(r[l])] !== r.dmg) fail(`${l}: drago ${r[l]}: danno ${got[norm(r[l])]} nel PDF, nei dati ${r.dmg}`);
    if (Object.keys(got).length !== DRAGON_TABLE.length) fail(`${l}: antenati draconici attesi ${DRAGON_TABLE.length}, trovati ${Object.keys(got).length}`);
  }

  // tabelle dei lignaggi / retaggi: nome del lignaggio, poi (cantrip), livello 3, livello 5, in questo ordine
  const NAMES_L = {
    elf: { en: { drow: "drow", high_elf: "high elf", wood_elf: "wood elf" }, it: { drow: "drow", high_elf: "elfo alto", wood_elf: "elfo dei boschi" } },
    tiefling: { en: { abyssal: "abyssal", chthonic: "chthonic", infernal: "infernal" }, it: { abyssal: "abissale", chthonic: "ctonio", infernal: "infernale" } },
  } as const;
  for (const [sp, set] of Object.entries(LINEAGES) as [keyof typeof LINEAGES, Record<string, readonly string[]>][]) {
    const tableAt = sec.indexOf(l === "en" ? (sp === "elf" ? "elven lineages lineage" : "fiendish legacies legacy") : (sp === "elf" ? "lignaggi elfici lignaggio" : "retaggi immondi retaggio"));
    let from = tableAt;
    if (tableAt < 0) { fail(`${l}: tabella dei ${sp} non trovata`); continue; }
    for (const [id, spells] of Object.entries(set)) {
      const label = (NAMES_L[sp][l] as Record<string, string>)[id]!;
      const seq = [label, ...spells.map((s) => norm(SPELL_NAMES[s]![l === "en" ? 0 : 1]))];
      for (const part of seq) {
        const at = sec.indexOf(part, from);
        if (at < 0) { fail(`${l}: tabella ${sp}/${id}: "${part}" non trovato dopo la posizione ${from}`); break; }
        from = at + part.length;
      }
    }
  }
  // gli altri incantesimi citati dai tratti
  for (const [id, [en, it]] of Object.entries(SPELL_NAMES)) if (!sec.includes(norm(l === "en" ? en : it))) fail(`${l}: incantesimo ${id} ("${l === "en" ? en : it}") non trovato`);
}

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
const entries: Entry[] = SPECIES.map((d) => ({
  id: d.id, name: { en: d.en, it: d.it }, description: d.description, sizes: d.sizes, speed: d.speed,
  ...(d.effects ? { effects: d.effects } : {}), ...(d.choices ? { choices: d.choices } : {}),
  traits: (d.traits ?? []).map((t) => ({ ...t, origin: "srd" })),
}));
writeKind("species", entries);
