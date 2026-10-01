// Step 2a — Fondamenti: termini di glossario, armi, armature, strumenti, equipaggiamento.
// Legge SOLO i due PDF in docs/srd/. I numeri (danni, costi, pesi, CA) vengono dalla tabella EN e sono
// riverificati riga per riga sulla tabella IT; i nomi IT sono accoppiati agli id da mappe esplicite qui sotto:
// se un numero non coincide lo script si ferma.
import { copper, kgToPounds, pageText, pounds, rowStart, snake, splitTop, writeKind, type Entry } from "./lib/srd";

const errors: string[] = [];
const notes: string[] = [];
const fail = (m: string) => errors.push(m);
const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
const en = await Promise.all([pageText("en", 9, 9), pageText("en", 14), pageText("en", 20), pageText("en", 89, 91), pageText("en", 92), pageText("en", 93, 94), pageText("en", 95), pageText("en", 96, 97), pageText("en", 180)]);
const [enSkills, enSizes, enLang, enWeaponRules, enWeaponArmor, enTools, enGear, enGearDesc, enDamage] = en;
const it = await Promise.all([pageText("it", 10, 11), pageText("it", 16), pageText("it", 22, 23), pageText("it", 101, 103), pageText("it", 103, 104), pageText("it", 105, 107), pageText("it", 108), pageText("it", 109, 112), pageText("it", 217)]);
const [itSkills, itSizes, itLang, itWeaponRules, itWeaponArmor, itTools, itGear, itGearDesc, itDamage] = it;

// ---------- Glossario ----------
const need = (text: string, name: string, where: string) => { if (!rowStart(name).test(text)) fail(`${where}: "${name}" non trovato`); };
const term = (id: string, enName: string, itName: string, extra: Record<string, string | number> = {}): Entry =>
  ({ id, name: { en: enName, it: itName }, extra });

const ABIL_IT: Record<string, string> = { Strength: "Forza", Dexterity: "Destrezza", Constitution: "Costituzione", Intelligence: "Intelligenza", Wisdom: "Saggezza", Charisma: "Carisma" };
const abilId = (n: string) => n.slice(0, 3).toLowerCase();

// Abilità: nome EN + caratteristica dalla tabella EN; nome IT da mappa, caratteristica IT verificata
const SKILL_IT: Record<string, string> = {
  Acrobatics: "Acrobazia", "Animal Handling": "Addestrare animali", Arcana: "Arcano", Athletics: "Atletica", Deception: "Inganno",
  History: "Storia", Insight: "Intuizione", Intimidation: "Intimidire", Investigation: "Indagare", Medicine: "Medicina",
  Nature: "Natura", Perception: "Percezione", Performance: "Intrattenere", Persuasion: "Persuasione", Religion: "Religione",
  "Sleight of Hand": "Rapidità di mano", Stealth: "Furtività", Survival: "Sopravvivenza",
};
const skills: Entry[] = [];
for (const m of enSkills.matchAll(/^([A-Z][A-Za-z ]+?)   (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)   /gm)) {
  const [, name, ab] = m as unknown as [string, string, string];
  const itName = SKILL_IT[name];
  if (!itName) { fail(`abilità senza nome IT: ${name}`); continue; }
  const row = rowStart(itName).exec(itSkills);
  if (row) {
    if (!itSkills.slice(row.index, row.index + 80).includes(ABIL_IT[ab]!)) fail(`abilità ${itName}: riga IT non coerente con ${ab}`);
  } else {
    // nel PDF IT mancano le ultime due righe della tabella: si verifica dall'elenco "Caratteristica (abilità, ...)" del testo
    const list = new RegExp(`${ABIL_IT[ab]!} \\(([^)]*)\\)`, "g");
    const found = [...collapse(itSkills).matchAll(list)].some((x) => x[1]!.includes(itName));
    if (found) notes.push(`abilità ${itName}: riga assente dalla tabella IT del PDF, verificata dall'elenco per caratteristica`);
    else fail(`abilità ${itName}: non verificabile sul PDF IT`);
  }
  skills.push(term(snake(name), name, itName, { ability: abilId(ab) }));
}
if (skills.length !== 18) fail(`abilità: attese 18, trovate ${skills.length}`);

const LANG_STD: [string, string][] = [["Common", "Comune"], ["Common Sign Language", "Lingua dei segni comune"], ["Draconic", "Draconico"], ["Dwarvish", "Nanico"], ["Elvish", "Elfico"], ["Giant", "Gigante"], ["Gnomish", "Gnomesco"], ["Goblin", "Goblin"], ["Halfling", "Halfling"], ["Orc", "Orchesco"]];
const LANG_RARE: [string, string][] = [["Abyssal", "Abissale"], ["Celestial", "Celestiale"], ["Deep Speech", "Gergo delle profondità"], ["Druidic", "Druidico"], ["Infernal", "Infernale"], ["Primordial", "Primordiale"], ["Sylvan", "Silvano"], ["Thieves’ Cant", "Gergo ladresco"], ["Undercommon", "Sottocomune"]];
const languages: Entry[] = [];
for (const [rarity, list] of [["standard", LANG_STD], ["rare", LANG_RARE]] as const) {
  for (const [e, i] of list) {
    if (!enLang.includes(e)) fail(`lingua EN non trovata: ${e}`);
    if (!itLang.includes(i)) fail(`lingua IT non trovata: ${i}`);
    languages.push(term(snake(e), e, i, { rarity }));
  }
}

const SIZE_IT: Record<string, string> = { Tiny: "Minuscola", Small: "Piccola", Medium: "Media", Large: "Grande", Huge: "Enorme", Gargantuan: "Mastodontica" };
const sizes: Entry[] = [];
for (const m of enSizes.matchAll(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)   (\d+(?: ½)?)(?: ½)?\s+by/gm)) {
  const [, name, ft] = m as unknown as [string, string, string];
  need(itSizes, SIZE_IT[name]!, "taglie IT");
  sizes.push(term(snake(name), name, SIZE_IT[name]!, { spaceFeet: pounds(ft) }));
}
if (sizes.length !== 6) fail(`taglie: attese 6, trovate ${sizes.length}`);

const DAMAGE_IT: Record<string, string> = { Acid: "Acido", Bludgeoning: "Contundente", Cold: "Freddo", Fire: "Fuoco", Force: "Forza", Lightning: "Fulmine", Necrotic: "Necrotico", Piercing: "Perforante", Poison: "Veleno", Psychic: "Psichico", Radiant: "Radioso", Slashing: "Tagliente", Thunder: "Tuono" };
const damageTypes = Object.entries(DAMAGE_IT).map(([e, i]) => {
  need(enDamage, e, "danni EN"); need(itDamage, i, "danni IT");
  return term(snake(e), e, i);
});

const PROP_IT: [string, string][] = [["Ammunition", "Munizioni"], ["Finesse", "Accurata"], ["Heavy", "Pesante"], ["Light", "Leggera"], ["Loading", "Ricarica"], ["Range", "Gittata"], ["Reach", "Portata"], ["Thrown", "Lancio"], ["Two-Handed", "A due mani"], ["Versatile", "Versatile"]];
const MASTERY_IT: [string, string][] = [["Cleave", "Doppio fendente"], ["Graze", "Colpo di striscio"], ["Nick", "Graffio"], ["Push", "Spinta"], ["Sap", "Fiaccare"], ["Slow", "Lentezza"], ["Topple", "Rovesciamento"], ["Vex", "Vessazione"]];
const weaponProperties = PROP_IT.map(([e, i]) => { need(enWeaponRules, e, "proprietà EN"); need(itWeaponRules, i, "proprietà IT"); return term(snake(e), e, i); });
const masteries = MASTERY_IT.map(([e, i]) => { need(enWeaponRules, e, "maestrie EN"); need(itWeaponRules, i, "maestrie IT"); return term(snake(e), e, i); });
const masteryByIt = new Map(MASTERY_IT.map(([e, i]) => [i.toLowerCase(), snake(e)]));

const COINS: [string, string, string, string, number][] = [
  ["Copper Piece", "Moneta di rame", "CP", "mr", 1], ["Silver Piece", "Moneta d'argento", "SP", "ma", 10], ["Electrum Piece", "Moneta di electrum", "EP", "me", 50],
  ["Gold Piece", "Moneta d'oro", "GP", "mo", 100], ["Platinum Piece", "Moneta di platino", "PP", "mp", 1000],
];
const coins = COINS.map(([e, i, ea, ia, cp]) => ({ id: ea.toLowerCase(), name: { en: e, it: i }, extra: { abbrEn: ea, abbrIt: ia, copper: cp } }) as Entry);
const coinsEn = await pageText("en", 89);
const coinsIt = await pageText("it", 101);
for (const [e, i, ea, ia] of COINS) {
  if (!coinsEn.includes(`${e} (${ea})`)) fail(`moneta EN: ${e}`);
  if (!coinsIt.includes(`${i} (${ia})`)) fail(`moneta IT: ${i}`);
}

// ---------- Armi ----------
const WEAPON_IT: Record<string, string> = {
  Club: "Randello", Dagger: "Pugnale", Greatclub: "Randello pesante", Handaxe: "Ascia", Javelin: "Giavellotto", "Light Hammer": "Martello leggero",
  Mace: "Mazza", Quarterstaff: "Bastone ferrato", Sickle: "Falcetto", Spear: "Lancia", Dart: "Dardo", "Light Crossbow": "Balestra leggera",
  Shortbow: "Arco corto", Sling: "Fionda", Battleaxe: "Ascia da battaglia", Flail: "Mazzafrusto", Glaive: "Falcione", Greataxe: "Ascia bipenne",
  Greatsword: "Spadone", Halberd: "Alabarda", Lance: "Lancia da cavaliere", Longsword: "Spada lunga", Maul: "Maglio", Morningstar: "Mazza chiodata",
  Pike: "Picca", Rapier: "Stocco", Scimitar: "Scimitarra", Shortsword: "Spada corta", Trident: "Tridente", Warhammer: "Martello da guerra",
  "War Pick": "Piccone da guerra", Whip: "Frusta", Blowgun: "Cerbottana", "Hand Crossbow": "Balestra a mano", "Heavy Crossbow": "Balestra pesante",
  Longbow: "Arco lungo", Musket: "Moschetto", Pistol: "Pistola",
};
const DMG_IT: Record<string, string> = { taglienti: "slashing", tagliente: "slashing", contundenti: "bludgeoning", contundente: "bludgeoning", perforanti: "piercing", perforante: "piercing" };
const AMMO_ID: Record<string, string> = { Arrow: "arrows", Bolt: "bolts", Needle: "needles" };

// Righe della tabella EN: le righe spezzate su più linee si riuniscono (le colonne si separano con 3 spazi)
function tableRows(text: string, start: RegExp): string[] {
  const rows: string[] = [];
  for (const line of text.split("\n").map((l) => l.trimEnd())) {
    if (!line) continue;
    if (start.test(line) || /^(Simple|Martial|Light Armor|Medium Armor|Heavy Armor|Shield \()/.test(line)) rows.push(line);
    else if (rows.length) rows[rows.length - 1] += (rows[rows.length - 1]!.endsWith(",") ? " " : "   ") + line;
  }
  return rows;
}

const weapons: Entry[] = [];
{
  const wText = await pageText("en", 91);
  const rows = tableRows(wText.slice(wText.indexOf("Simple Melee Weapons")), /^[A-Z][A-Za-z -]+?   (\d+d\d+|\d+) [A-Z][a-z]+   /);
  let category = "simple", kind = "melee";
  for (const row of rows) {
    const h = /^(Simple|Martial) (Melee|Ranged) Weapons/.exec(row);
    if (h) { category = h[1]!.toLowerCase(); kind = h[2]!.toLowerCase(); continue; }
    const m = /^(.+?)   (\d+d\d+|\d+) ([A-Z][a-z]+)   (.+?)   ([A-Z][a-z]+)   ([^ ]+(?: [^ ]+)? ?(?:lb\.)?|—)   ([\d,]+ [GSC]P)\s*$/.exec(row.replace(/   (\d[\d/ ½]*) +lb\./, "   $1 lb."));
    if (!m) { fail(`arma EN: riga non leggibile: ${row}`); continue; }
    const [, name, dmg, dtype, propsRaw, mastery, weight, cost] = m as unknown as string[];
    const props: string[] = []; let versatile: string | undefined, range: { normal: number; long: number } | undefined, ammunition: string | undefined, twoHandedUnlessMounted = false;
    for (const p of propsRaw === "—" ? [] : splitTop(propsRaw!)) {
      const pm = /^([A-Za-z-]+)(?: \((.+)\))?$/.exec(p);
      if (!pm) { fail(`arma ${name}: proprietà non leggibile "${p}"`); continue; }
      const pid = snake(pm[1]!), arg = pm[2];
      props.push(pid);
      if (pid === "versatile") versatile = arg;
      if (pid === "two_handed" && arg === "unless mounted") twoHandedUnlessMounted = true;
      if (pid === "thrown" || pid === "ammunition") {
        const r = /Range (\d+)\/(\d+)(?:; (\w+))?/.exec(arg ?? "");
        if (!r) { fail(`arma ${name}: gittata non leggibile "${p}"`); continue; }
        range = { normal: Number(r[1]), long: Number(r[2]) };
        if (r[3]) {
          ammunition = r[3] === "Bullet" ? (name === "Sling" ? "bullets_sling" : "bullets_firearm") : AMMO_ID[r[3]];
          if (!ammunition) fail(`arma ${name}: munizione sconosciuta ${r[3]}`);
        }
      }
    }
    const [wn, cu] = [cost!.split(" ")[0]!, cost!.split(" ")[1]!];
    weapons.push({
      id: snake(name!), name: { en: name!, it: WEAPON_IT[name!] ?? "" }, category, kind, damage: dmg, damageType: dtype!.toLowerCase(),
      properties: props, ...(versatile ? { versatileDamage: versatile } : {}), ...(range ? { range } : {}), mastery: snake(mastery!),
      ...(ammunition ? { ammunition } : {}), ...(twoHandedUnlessMounted ? { twoHandedUnlessMounted } : {}),
      weight: pounds(weight!), cost: copper(wn, cu),
    });
  }
  for (const w of weapons) {
    const itName = w.name.it;
    if (!itName) { fail(`arma ${w.id}: senza nome IT`); continue; }
    const tab = itWeaponArmor + "\n" + (await pageText("it", 103));
    const r = rowStart(itName).exec(tab);
    if (!r) { fail(`arma ${w.id}: riga IT "${itName}" non trovata`); continue; }
    const slice = tab.slice(r.index, r.index + 260);
    const dm = /(\d+d\d+|\d+) ([a-z]+)/.exec(slice.slice(itName.length));
    if (!dm || dm[1] !== w.damage || DMG_IT[dm[2]!] !== w.damageType) fail(`arma ${w.id}: danni IT ${dm?.[0]} ≠ ${w.damage} ${w.damageType}`);
    const wc = /(?:([\d,]+) kg|—)\s+([\d.]+) (mo|ma|mr)\b/.exec(slice);
    if (!wc || kgToPounds(wc[1] ? `${wc[1]} kg` : "—") !== w.weight || copper(wc[2]!, wc[3]!) !== w.cost) fail(`arma ${w.id}: peso/costo IT ${wc?.[0]} ≠ ${w.weight} lb / ${w.cost} cp`);
    const rowText = wc ? slice.slice(0, wc.index + wc[0].length) : slice;
    const mastery = [...masteryByIt].find(([k]) => collapse(rowText.toLowerCase()).includes(k));
    if (!mastery || mastery[1] !== w.mastery) fail(`arma ${w.id}: maestria IT ${mastery?.[0]} ≠ ${w.mastery}`);
  }
}

// ---------- Armature ----------
const ARMOR_IT: Record<string, string> = {
  "Padded Armor": "Armatura imbottita", "Leather Armor": "Armatura di cuoio", "Studded Leather Armor": "Armatura di cuoio borchiato",
  "Hide Armor": "Armatura di pelle", "Chain Shirt": "Giaco di maglia", "Scale Mail": "Corazza a scaglie", Breastplate: "Corazza di piastre",
  "Half Plate Armor": "Mezza armatura", "Ring Mail": "Corazza ad anelli", "Chain Mail": "Cotta di maglia", "Splint Armor": "Corazza a strisce",
  "Plate Armor": "Armatura a piastre", Shield: "Scudo",
};
const armors: Entry[] = [];
{
  const start = enWeaponArmor.indexOf("Armor   Armor Class (AC)");
  let category = "light";
  const TIME: Record<string, [number, number]> = { light: [1, 1], medium: [5, 1], heavy: [10, 5], shield: [0, 0] };
  for (const line of enWeaponArmor.slice(start).split("\n").slice(1).map((l) => l.trim()).filter(Boolean)) {
    const h = /^(Light|Medium|Heavy) Armor|^Shield \(/.exec(line);
    if (h) { category = h[1] ? h[1].toLowerCase() : "shield"; continue; }
    const m = /^(.+?)   (\+?\d+)(?: \+ Dex modifier(?: \(max (\d)\))?)?   (—|Str (\d+))   (—|Disadvantage)   ([\d ½/]+) lb\.   ([\d,]+ [GSC]P)/.exec(line);
    if (!m) { fail(`armatura EN: riga non leggibile: ${line}`); continue; }
    const [, name, ac, cap, , str, stealth, weight, cost] = m as unknown as string[];
    const dex = /Dex modifier/.test(line);
    const [don, doff] = TIME[category]!;
    armors.push({
      id: snake(name!), name: { en: name!, it: ARMOR_IT[name!] ?? "" }, category, baseAc: Number(ac!.replace("+", "")),
      dexCap: category === "light" || category === "shield" ? null : dex ? Number(cap) : 0, strRequired: str ? Number(str) : 0,
      donMinutes: don, doffMinutes: doff, stealthDisadvantage: stealth === "Disadvantage", weight: pounds(weight!), cost: copper(cost!.split(" ")[0]!, cost!.split(" ")[1]!),
    });
  }
  for (const a of armors) {
    if (!a.name.it) { fail(`armatura ${a.id}: senza nome IT`); continue; }
    const tab = itWeaponArmor;
    const r = rowStart(a.name.it).exec(tab.slice(tab.indexOf("Armature   Classe Armatura")));
    if (!r) { fail(`armatura ${a.id}: riga IT non trovata`); continue; }
    const slice = tab.slice(tab.indexOf("Armature   Classe Armatura")).slice(r.index, r.index + 200);
    const ac = /(\+?\d+)(?: \+ modificatore di Des)?/.exec(slice.slice(a.name.it.length).replace(/^\s*borchiato\s*/, ""));
    if (!ac || Number(ac[1]!.replace("+", "")) !== a.baseAc) fail(`armatura ${a.id}: CA IT ${ac?.[1]} ≠ ${a.baseAc}`);
    const wc2 = /([\d,]+) kg\s+([\d.]+) (mo|ma|mr)\b/.exec(slice);
    if (!wc2 || kgToPounds(`${wc2[1]} kg`) !== a.weight || copper(wc2[2]!, wc2[3]!) !== a.cost) fail(`armatura ${a.id}: peso/costo IT ${wc2?.[0]} ≠ ${a.weight} lb / ${a.cost} cp`);
    const rowText = wc2 ? slice.slice(0, wc2.index + wc2[0].length) : slice;
    if (/Svantaggio/.test(rowText) !== (a.stealthDisadvantage as boolean)) fail(`armatura ${a.id}: furtività IT non coerente`);
  }
}

// ---------- Strumenti ----------
const TOOL_IT: Record<string, string> = {
  "Alchemist’s Supplies": "Scorte da alchimista", "Brewer’s Supplies": "Scorte da birraio", "Calligrapher’s Supplies": "Scorte da calligrafo",
  "Carpenter’s Tools": "Strumenti da falegname", "Cartographer’s Tools": "Strumenti da cartografo", "Cobbler’s Tools": "Strumenti da calzolaio",
  "Cook’s Utensils": "Utensili da cuoco", "Glassblower’s Tools": "Strumenti da soffiatore", "Jeweler’s Tools": "Strumenti da gioielliere",
  "Leatherworker’s Tools": "Strumenti da conciatore", "Mason’s Tools": "Strumenti da muratore", "Painter’s Supplies": "Strumenti da pittore",
  "Potter’s Tools": "Strumenti da vasaio", "Smith’s Tools": "Strumenti da fabbro", "Tinker’s Tools": "Strumenti da inventore",
  "Weaver’s Tools": "Strumenti da tessitore", "Woodcarver’s Tools": "Strumenti da intagliatore", "Disguise Kit": "Trucchi per il camuffamento",
  "Forgery Kit": "Arnesi da falsario", "Herbalism Kit": "Borsa da erborista", "Navigator’s Tools": "Strumenti da navigatore",
  "Poisoner’s Kit": "Sostanze da avvelenatore", "Thieves’ Tools": "Arnesi da scasso",
};
const tools: Entry[] = [];
{
  const otherAt = enTools.indexOf("Other Tools");
  for (const m of enTools.matchAll(/^([A-Z][A-Za-z’ ]+?) \(([\d,]+ [GSC]P|Varies)\) *\nAbility:   (\w+)   Weight:   ([^\n]+)/gm)) {
    const [, name, cost, ab, weight] = m as unknown as string[];
    if (cost === "Varies") continue;
    const itName = TOOL_IT[name!];
    if (!itName) { fail(`strumento senza nome IT: ${name}`); continue; }
    tools.push({
      id: snake(name!), name: { en: name!, it: itName }, group: m.index! < otherAt ? "artisan" : "other", ability: abilId(ab!),
      weight: pounds(weight!), cost: copper(cost!.split(" ")[0]!, cost!.split(" ")[1]!),
    });
  }
  // Varianti: giochi e strumenti musicali (ognuno richiede una competenza a parte)
  const variants = (enText: string, label: string) => {
    const txt = collapse(enText.replace(/-\s*\n\s*/g, "").slice(enText.indexOf(label)).replace(/\n[A-Z][^\n]*\n(?=Ability:)/, "\n@@")).split("@@")[0]!;
    return [...txt.matchAll(/([A-Za-z -]+?) \(([\d,]+) ([GSC]P)(?:, ([\d ½/]+) lb\.)?\)/g)];
  };
  const GAMES: [string, string][] = [["Dice", "Dadi"], ["Dragonchess", "Scacchi dei draghi"], ["Playing Cards", "Carte da gioco"], ["Three-Dragon Ante", "Tre draghi al buio"]];
  const MUSIC: [string, string][] = [["Bagpipes", "Cornamusa"], ["Drum", "Tamburo"], ["Dulcimer", "Dulcimer"], ["Flute", "Flauto"], ["Horn", "Corno"], ["Lute", "Liuto"], ["Lyre", "Lira"], ["Pan Flute", "Flauto di pan"], ["Shawm", "Ciaramella"], ["Viol", "Viola"]];
  const gamingEn = variants(enTools.slice(enTools.indexOf("Gaming Set")), "Variants:");
  const musicEn = variants(enTools.slice(enTools.indexOf("Musical Instrument (Varies)")), "Variants:");
  const itGaming = collapse(itTools.slice(itTools.indexOf("Gioco (variabile)")).split("Sostanze da avvelenatore")[0]!);
  const itMusic = collapse(itTools.replace(/-\s*\n\s*/g, "").slice(itTools.indexOf("Strumento musicale (variabile)")).split("Trucchi per il camuffamento")[0]!);
  const build = (en: RegExpMatchArray[], names: [string, string][], group: string, ability: string, itText: string, label: string) => {
    if (en.length !== names.length) fail(`${label}: varianti EN ${en.length} ≠ ${names.length}`);
    for (const v of en) {
      const enName = v[1]!.trim().replace(/^./, (c) => c.toUpperCase()).replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => (a.toUpperCase() + b)).replace("Three-dragon", "Three-Dragon");
      const pair = names.find(([e]) => e.toLowerCase() === enName.toLowerCase());
      if (!pair) { fail(`${label}: variante EN sconosciuta "${enName}"`); continue; }
      const cp = copper(v[2]!, v[3]!), wt = v[4] ? pounds(v[4] + " lb.") : 0;
      const itRe = new RegExp(`${pair[1].replace(/ /g, "\\s+")} \\(([\\d.]+) (mo|ma|mr)(?:, ([\\d,]+) kg)?\\)`, "i").exec(itText);
      if (!itRe || copper(itRe[1]!, itRe[2]!) !== cp || (itRe[3] ? kgToPounds(`${itRe[3]} kg`) : 0) !== wt) fail(`${label}: variante IT "${pair[1]}" non coerente con EN ${cp} cp / ${wt} lb`);
      tools.push({ id: snake(pair[0]), name: { en: pair[0], it: pair[1] }, group, ability, weight: wt, cost: cp });
    }
  };
  build(gamingEn, GAMES, "gaming", "wis", itGaming, "giochi");
  build(musicEn, MUSIC, "musical", "cha", itMusic, "strumenti musicali");
}
// Verifica IT degli strumenti con nome proprio: costo, caratteristica, peso
for (const t of tools.filter((x) => x.group === "artisan" || x.group === "other")) {
  const re = new RegExp(`^${(t.name.it as string).replace(/ /g, "[ \\n]+")} \\(([\\d.]+) (mo|ma|mr)\\) *\\nCaratteristica: +(\\w+) +Peso: +([^\\n]+)`, "m").exec(itTools);
  const abEn = Object.entries(ABIL_IT).find(([, v]) => v === re?.[3])?.[0];
  if (!re || copper(re[1]!, re[2]!) !== t.cost || !abEn || abilId(abEn) !== t.ability || kgToPounds(re[4]!.trim()) !== t.weight) fail(`strumento ${t.id}: riga IT non coerente (${re?.[0]})`);
}

// ---------- Equipaggiamento ----------
const GEAR_IT: Record<string, string> = {
  Acid: "Acido", "Alchemist’s Fire": "Fuoco dell'alchimista", Antitoxin: "Antitossina", Backpack: "Zaino", "Ball Bearings": "Sfere metalliche", Barrel: "Barile",
  Basket: "Cesto", Bedroll: "Giaciglio", Bell: "Campanella", Blanket: "Coperta", "Block and Tackle": "Carrucola e paranco", Book: "Libro",
  "Glass Bottle": "Bottiglia di vetro", Bucket: "Secchio", "Burglar’s Pack": "Dotazione da scassinatore", Caltrops: "Triboli", Candle: "Candela",
  "Crossbow Bolt Case": "Custodia per quadrelli da balestra", "Map or Scroll Case": "Custodia per mappe o pergamene", Chain: "Catena", Chest: "Forziere",
  "Climber’s Kit": "Attrezzi da scalatore", "Fine Clothes": "Abiti eleganti", "Traveler’s Clothes": "Abiti da viaggiatore", "Component Pouch": "Borsa per componenti",
  Costume: "Costume", Crowbar: "Piede di porco", "Diplomat’s Pack": "Dotazione da diplomatico", "Dungeoneer’s Pack": "Dotazione da avventuriero",
  "Entertainer’s Pack": "Dotazione da intrattenitore", "Explorer’s Pack": "Dotazione da esploratore", Flask: "Ampolla", "Grappling Hook": "Rampino",
  "Healer’s Kit": "Borsa del guaritore", "Holy Water": "Acqua santa", "Hunting Trap": "Tagliola", Ink: "Inchiostro", "Ink Pen": "Pennino", Jug: "Brocca",
  Ladder: "Scala a pioli", Lamp: "Lampada", "Bullseye Lantern": "Lanterna a lente sporgente", "Hooded Lantern": "Lanterna schermabile", Lock: "Serratura",
  "Magnifying Glass": "Lente d'ingrandimento", Manacles: "Manette", Map: "Mappa", Mirror: "Specchio", Net: "Rete", Oil: "Olio", Paper: "Carta",
  Parchment: "Pergamena", Perfume: "Profumo", "Basic Poison": "Veleno, base", Pole: "Asta", "Iron Pot": "Pentola di ferro", "Potion of Healing": "Pozione di guarigione",
  Pouch: "Borsa", "Priest’s Pack": "Dotazione da sacerdote", Quiver: "Faretra", "Portable Ram": "Ariete portatile", Rations: "Razioni", Robe: "Tunica",
  Rope: "Corda", Sack: "Sacco", "Scholar’s Pack": "Dotazione da studioso", Shovel: "Pala", "Signal Whistle": "Fischietto da richiamo",
  "Spell Scroll (Cantrip)": "Pergamena magica (trucchetto)", "Spell Scroll (Level 1)": "Pergamena magica (livello 1)", "Iron Spikes": "Spuntoni di ferro",
  Spyglass: "Cannocchiale", String: "Spago", Tent: "Tenda", Tinderbox: "Acciarino e pietra focaia", Torch: "Torcia", Vial: "Fiala", Waterskin: "Otre",
};
const RENAME: Record<string, string> = {
  "Bottle, Glass": "Glass Bottle", "Case, Crossbow Bolt": "Crossbow Bolt Case", "Case, Map or Scroll": "Map or Scroll Case", "Clothes, Fine": "Fine Clothes",
  "Clothes, Traveler’s": "Traveler’s Clothes", "Lantern, Bullseye": "Bullseye Lantern", "Lantern, Hooded": "Hooded Lantern", "Poison, Basic": "Basic Poison",
  "Pot, Iron": "Iron Pot", "Ram, Portable": "Portable Ram", "Spikes, Iron": "Iron Spikes",
};
const items: Entry[] = [];
const itemRow = (itText: string, itName: string, where: string, cp: number, lb: number, id: string, softWeight = false) => {
  const r = rowStart(itName).exec(itText);
  if (!r) { fail(`${where} ${id}: riga IT "${itName}" non trovata`); return; }
  const slice = itText.slice(r.index + itName.length, r.index + itName.length + 140);
  const m = /(?:([\d,]+) kg|—)[ \n]*(?:\(pieno\)[ \n]*)?([\d.]+) (mo|ma|mr)\b/.exec(slice);
  if (!m) { fail(`${where} ${id}: peso/costo IT non leggibile`); return; }
  const itLb = kgToPounds(m[1] ? `${m[1]} kg` : "—");
  if (copper(m[2]!, m[3]!) !== cp) fail(`${where} ${id}: costo IT ${m[2]} ${m[3]} ≠ ${cp} cp`);
  if (itLb !== lb) (softWeight ? notes.push(`${id}: peso IT ${itLb} lb ≠ EN ${lb} lb (si tiene EN)`) : fail(`${where} ${id}: peso IT ${itLb} lb ≠ ${lb} lb`));
};
{
  const tableStart = enGear.indexOf("Item   Weight   Cost");
  const seen = new Set<string>();
  for (const line of enGear.slice(tableStart).split("\n").map((l) => l.trim())) {
    const m = /^(.+?)   (?:(\((?:Cantrip|Level 1)\))   )?(—|Varies|[\d ½/]+ ?lb\.(?: \(full\))?)   (Varies|[\d,]+ [GSC]P)$/.exec(line);
    if (!m) continue;
    const [, rawName, scroll, weight, cost] = m as unknown as string[];
    if (cost === "Varies") continue;
    const name = (RENAME[rawName!] ?? rawName!) + (scroll ? ` ${scroll}` : "");
    const itName = GEAR_IT[name];
    if (!itName) { fail(`oggetto senza nome IT: ${name}`); continue; }
    if (seen.has(name)) continue;
    seen.add(name);
    items.push({ id: snake(name), name: { en: name, it: itName }, category: /Pack$/.test(name) ? "pack" : "adventuring_gear", weight: pounds(weight!.replace(/\s+lb/, " lb")), cost: copper(cost!.split(" ")[0]!, cost!.split(" ")[1]!) });
  }
  for (const n of Object.keys(GEAR_IT)) if (!seen.has(n)) fail(`oggetto in mappa IT ma non nella tabella EN: ${n}`);

  // Munizioni
  const ammoAt = enGearDesc.indexOf("Type   Amount");
  const AMMO_IT: Record<string, string> = { Arrows: "Frecce", Bolts: "Quadrelli", "Bullets, Firearm": "Proiettili, arma da fuoco", "Bullets, Sling": "Proiettili, fionda", Needles: "Aghi" };
  for (const m of enGearDesc.slice(ammoAt, ammoAt + 500).matchAll(/^([A-Z][A-Za-z, ]+?)   (\d+)   (\w+)   ([\d ½/]+ ?lb\.|—)   ([\d,]+ [GSC]P)/gm)) {
    const [, name, amount, , weight, cost] = m as unknown as string[];
    const itName = AMMO_IT[name!];
    if (!itName) { fail(`munizione senza nome IT: ${name}`); continue; }
    items.push({ id: snake(name!.replace(/^(\w+), (\w+)$/, "$1 $2")), name: { en: name!.replace(/^(\w+), (\w+)$/, "$2 $1"), it: itName.replace(/^([^,]+), (.+)$/, "$1 ($2)") }, category: "ammunition", amount: Number(amount), weight: pounds(weight!.replace(/\s+lb/, " lb")), cost: copper(cost!.split(" ")[0]!, cost!.split(" ")[1]!) });
  }
  // Focus arcani/druidici e simboli sacri
  const focus = (heading: string, cat: string, label: string, rows: [string, string, string][]) => {
    const at = enGearDesc.indexOf(heading);
    if (at < 0) { fail(`tabella EN "${heading}" non trovata`); return; }
    for (const [enRow, enName, itName] of rows) {
      const m = new RegExp(`^${enRow.replace(/[()]/g, "\\$&")}.*?   (—|[\\d ½/]+ ?lb\\.)   ([\\d,]+ [GSC]P)`, "m").exec(enGearDesc.slice(at, at + 400));
      if (!m) { fail(`${heading}: riga "${enRow}" non trovata`); continue; }
      items.push({ id: snake(`${label} ${enName}`), name: { en: `${label} (${enName})`, it: `${label === "Arcane Focus" ? "Focus arcano" : label === "Druidic Focus" ? "Focus druidico" : "Simbolo sacro"} (${itName.toLowerCase()})` }, category: cat, weight: pounds(m[1]!.replace(/\s+lb/, " lb")), cost: copper(m[2]!.split(" ")[0]!, m[2]!.split(" ")[1]!), _it: itName } as Entry);
    }
  };
  focus("Arcane Focuses", "arcane_focus", "Arcane Focus", [["Crystal", "Crystal", "Cristallo"], ["Orb", "Orb", "Globo"], ["Rod", "Rod", "Verga"], ["Staff", "Staff", "Bastone (anche bastone ferrato)"], ["Wand", "Wand", "Bacchetta"]]);
  focus("Druidic Focuses", "druidic_focus", "Druidic Focus", [["Sprig of mistletoe", "Sprig of Mistletoe", "Rametto di vischio"], ["Wooden staff", "Wooden Staff", "Bastone di legno (anche bastone ferrato)"], ["Yew wand", "Yew Wand", "Bacchetta in legno di tasso"]]);
  focus("Holy Symbols", "holy_symbol", "Holy Symbol", [["Amulet", "Amulet", "Amuleto (indossato o tenuto in mano)"], ["Emblem", "Emblem", "Emblema (portato su un tessuto o uno scudo)"], ["Reliquary", "Reliquary", "Reliquiario (tenuto in mano)"]]);
  // Verifica IT di munizioni e focus
  const AMMO_ROW: Record<string, string> = { arrows: "Frecce", bolts: "Quadrelli", bullets_firearm: "Proiettili, arma da fuoco", bullets_sling: "Proiettili, fionda", needles: "Aghi" };
  for (const it of items.filter((x) => ["ammunition", "arcane_focus", "druidic_focus", "holy_symbol"].includes(x.category as string))) {
    const row = (it._it as string | undefined) ?? AMMO_ROW[it.id]!;
    itemRow(itGearDesc, row, it.category as string, it.cost as number, it.weight as number, it.id);
    delete it._it;
  }
  for (const it of items) if (!(it.category === "ammunition" || it.category === "arcane_focus" || it.category === "druidic_focus" || it.category === "holy_symbol")) itemRow(itGear, it.name.it, "oggetto", it.cost as number, it.weight as number, it.id, it.category === "pack");
}

// Contenuto delle dotazioni: il testo EN è rovinato (cifre perse), quindi si legge quello IT, che è integro; il totale in monete deve coincidere con il prezzo
{
  const PACK_IT: Record<string, string> = { "Burglar’s Pack": "scassinatore", "Diplomat’s Pack": "diplomatico", "Dungeoneer’s Pack": "avventuriero", "Entertainer’s Pack": "intrattenitore", "Explorer’s Pack": "esploratore", "Priest’s Pack": "sacerdote", "Scholar’s Pack": "studioso" };
  const PHRASE: Record<string, string> = {
    zaino: "backpack", triboli: "caltrops", "piede di porco": "crowbar", "ampolle di olio": "oil", "ampolla di olio": "oil", "razioni giornaliere": "rations", corda: "rope",
    "acciarino con pietra focaia": "tinderbox", torce: "torch", otre: "waterskin", forziere: "chest", "abiti eleganti": "fine_clothes", inchiostro: "ink", pennini: "ink_pen", pennino: "ink_pen",
    lampada: "lamp", "custodie per mappe o pergamene": "map_or_scroll_case", "fogli di carta": "paper", "fogli di pergamena": "parchment", profumo: "perfume",
    giaciglio: "bedroll", campana: "bell", "lanterna a lente sporgente": "bullseye_lantern", costumi: "costume", specchio: "mirror", coperta: "blanket",
    "acqua santa": "holy_water", tunica: "robe", "sfere metalliche": "ball_bearings", candele: "candle", "lanterna schermabile": "hooded_lantern", libro: "book",
  };
  const cost = new Map(items.map((i) => [i.id, i.cost as number]));
  const weight = new Map(items.map((i) => [i.id, i.weight as number]));
  const text = itGearDesc.replace(/(\p{L})\s+-\s+(\p{L})/gu, "$1$2").replace(/\s+/g, " ");
  for (const pack of items.filter((i) => i.category === "pack")) {
    const who = PACK_IT[pack.name.en]!;
    const m = new RegExp(`Dotazione da ${who} \\(\\d+ mo\\) Una dotazione da ${who} [^:]*?oggetti: (.+?)\\.`).exec(text);
    if (!m) { fail(`${pack.id}: contenuto IT non trovato`); continue; }
    const parts = m[1]!.replace(/ e (?!.* e )/, ", ").split(", ");
    const contents: { item: string; qty: number }[] = [];
    let cp = 0, lb = 0;
    for (const p of parts) {
      const q = /^(?:(\d+) |un |una )?(.+)$/.exec(p.trim())!;
      const id = PHRASE[q[2]!];
      if (!id || !cost.has(id)) { fail(`${pack.id}: oggetto sconosciuto "${p}"`); continue; }
      const qty = q[1] ? Number(q[1]) : 1;
      contents.push({ item: id, qty }); cp += qty * cost.get(id)!; lb += qty * weight.get(id)!;
    }
    if (cp !== pack.cost) notes.push(`${pack.id}: somma costi oggetti ${cp} cp ≠ prezzo della dotazione ${pack.cost} cp (si tiene il prezzo del PDF)`);
    if (lb !== pack.weight) notes.push(`${pack.id}: somma pesi oggetti ${lb} lb ≠ peso della dotazione ${pack.weight} lb (si tiene il peso EN)`);
    pack.contents = contents;
  }
}

for (const n of notes) console.warn(`  nota: ${n}`);
if (errors.length) {
  console.error(`\n${errors.length} problemi:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

writeKind("skills", skills);
writeKind("languages", languages);
writeKind("sizes", sizes);
writeKind("damageTypes", damageTypes);
writeKind("weaponProperties", weaponProperties);
writeKind("masteries", masteries);
writeKind("coins", coins);
writeKind("weapons", weapons);
writeKind("armors", armors);
writeKind("tools", tools);
writeKind("items", items);
