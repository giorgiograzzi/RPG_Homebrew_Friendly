// Lettura degli incantesimi dai PDF dell'SRD 5.2.1 (sezione "Spell Descriptions" / "Descrizioni degli incantesimi")
import { srdPages, srdPagesColumns, type Lang } from "./srd";
import { joinProse } from "./srd-clean";

export interface RawSpell {
  name: string; level: number; school: string; classes: string[];
  castingTime: string; range: string; components: string; duration: string;
  body: string; higher: string;
}

// pagine del PDF (1 = prima pagina): le descrizioni finiscono prima del glossario
const PAGES: Record<Lang, [number, number]> = { en: [107, 175], it: [121, 201] };

const HEAD: Record<Lang, RegExp> = {
  en: /^(?:Level (\d) (\w+)|(\w+) Cantrip) \((.*)$/,
  it: /^(?:(\w+) di (\d)º livello|Trucchetto di (\w+)) \((.*)$/,
};
const LABELS: Record<Lang, [string, string, string, string]> = {
  en: ["Casting Time:", "Range:", "Components:", "Duration:"],
  it: ["Tempo di lancio:", "Gittata:", "Componenti:", "Durata:"],
};
const HIGHER: Record<Lang, RegExp> = {
  en: /(?:Using a Higher-Level Spell Slot|Cantrip Upgrade)\.\s*/,
  it: /(?:Utilizzo di uno slot incantesimo di livello superiore|Uso di uno slot incantesimo di livello superiore|Trucchetto potenziato)\.\s*/,
};

const one = (s: string) => joinProse(s).replace(/\s+/g, " ").trim();

export async function readSpells(lang: Lang): Promise<RawSpell[]> {
  const [a, b] = PAGES[lang];
  const lines = (await srdPagesColumns(lang)).slice(a - 1, b).join("\n").split("\n").map((l) => l.replace(/\s+$/, ""));
  // intestazioni: la riga prima del tipo è il nome; la lista delle classi può andare a capo
  const heads: { at: number; name: string; level: number; school: string; classes: string; end: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i]!.trim().match(HEAD[lang]);
    if (!m) continue;
    let cls = m[4]!, end = i;
    while (!cls.includes(")") && end < i + 3) cls += " " + lines[++end]!.trim();
    if (!cls.includes(")")) continue;
    const [level, school] = lang === "en"
      ? (m[1] ? [Number(m[1]), m[2]!] : [0, m[3]!]) : (m[2] ? [Number(m[2]), m[1]!] : [0, m[3]!]);
    heads.push({ at: i - 1, name: one(lines[i - 1]!), level, school: school.toLowerCase(), classes: cls.slice(0, cls.indexOf(")")), end });
  }
  const [lt, lr, lc, ld] = LABELS[lang];
  return heads.map((h, k) => {
    const raw = lines.slice(h.end + 1, k + 1 < heads.length ? heads[k + 1]!.at : lines.length).join("\n");
    // qualche incantesimo ha l'etichetta al singolare ("Component:", "Componente:")
    const labels = [lt, lr, raw.includes(lc) ? lc : lc.replace(/i:$/, "e:").replace(/s:$/, ":"), ld];
    const i = labels.map((l) => raw.indexOf(l));
    if (i.some((x) => x < 0) || i.some((x, j) => j && x < i[j - 1]!)) throw new Error(`${lang}/${h.name}: campi mancanti o fuori ordine`);
    const field = (j: number) => raw.slice(i[j]! + labels[j]!.length, j < 3 ? i[j + 1] : undefined);
    const dur = field(3);
    // la durata è la prima riga (puo' andare a capo solo se la riga dopo non inizia una frase nuova: si controlla a mano nei test)
    const nl = dur.replace(/^\s+/, "").indexOf("\n");
    const durationLine = nl < 0 ? dur : dur.replace(/^\s+/, "").slice(0, nl);
    const rest = nl < 0 ? "" : dur.replace(/^\s+/, "").slice(nl + 1);
    const text = joinProse(rest).replace(/\s+/g, " ").trim();
    const hm = text.match(HIGHER[lang]);
    return {
      name: h.name, level: h.level, school: h.school,
      classes: h.classes.split(",").map((c) => one(c).toLowerCase()).filter(Boolean),
      castingTime: one(field(0)), range: one(field(1)), components: one(field(2)), duration: one(durationLine),
      body: hm ? text.slice(0, hm.index).trim() : text,
      higher: hm ? text.slice(hm.index! + hm[0].length).trim() : "",
    };
  });
}

// Liste degli incantesimi per classe nei capitoli delle classi: classe → livello → righe (nome, scuola, speciale)
export interface ListRow { name: string; school: string; special: string }
export async function readClassLists(lang: Lang): Promise<Record<string, Record<number, ListRow[]>>> {
  const lines = (await srdPages(lang)).join("\n").split("\n").map((l) => l.trim());
  const head = lang === "en"
    ? /^(?:Cantrips \(Level 0 (\w+) Spells\)|Level (\d) (\w+) Spells)$/
    : /^(?:Trucchetti \(incantesimi (?:da|del) (\w+) di livello 0\)|Incantesimi (?:da|del) (\w+) di (\d)º livello)$/;
  const schools = lang === "en" ? "Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation"
    : "Abiurazione|Ammaliamento|Divinazione|Evocazione|Illusione|Invocazione|Necromanzia|Trasmutazione";
  const row = new RegExp(`^(.+?)\\s+(${schools})\\s+(—|–|-|[CRM](?:, [CRM])*)$`);
  const out: Record<string, Record<number, ListRow[]>> = {};
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(head);
    if (!m) continue;
    const [cls, level] = lang === "en" ? (m[1] ? [m[1], 0] : [m[3]!, Number(m[2])]) : (m[1] ? [m[1], 0] : [m[2]!, Number(m[3])]);
    const key = cls!.toLowerCase();
    const rows: ListRow[] = [];
    let pending = "", n = 0;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j]!;
      if (/^(Spell|Incantesimo) +(School|Scuola) +(Special|Speciale)$/.test(l) || l === "") continue;
      const r = (pending ? pending + " " + l : l).match(row);
      if (r) { rows.push({ name: one(r[1]!), school: r[2]!, special: /^[—–-]$/.test(r[3]!) ? "" : r[3]! }); pending = ""; n = 0; }
      else if (n < 3 && !head.test(l)) { pending = pending ? pending + " " + l : l; n++; }
      else break;
    }
    ((out[key] ??= {})[level as number] ??= []).push(...rows);
  }
  return out;
}
