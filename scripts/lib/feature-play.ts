// Step 14b: contatori e stati attivabili dei privilegi. Si applica DOPO le altre estrazioni ai file in data/private.
type Json = Record<string, any>;

const MOD_ID: Record<string, string> = { For: "str", Des: "dex", Cos: "con", Int: "int", Sag: "wis", Car: "cha" };
const rechargeOf = (s: string): "short_rest" | "long_rest" => (/Breve/.test(s) ? "short_rest" : "long_rest");

// Usi limitati dal testo del privilegio (i riepiloghi in docs/rules): solo formule esplicite, niente interpretazioni.
//   "Usi = mod Sag (min 1) per Riposo Lungo" · "mod Car volte per Riposo Lungo" · "1 volta per Riposo Breve o Lungo"
// Restano fuori "1 volta per turno" e gli incantesimi lanciabili senza slot (hanno già `freeCast`).
export function deriveUsage(text: string): { uses: number | string; recharge: "short_rest" | "long_rest" } | undefined {
  const rest = "Riposo (Breve\\s*(?:o|/)\\s*(?:Riposo )?Lungo|Lungo\\s*o\\s*Breve|Lungo|Breve)";
  // il minimo di 1 c'è solo dove il testo lo dice ("(min 1)"): niente minimi non scritti
  const byMod = (m: RegExpExecArray) => ({ uses: m[2] ? `max(1, mod:${MOD_ID[m[1]!]})` : `mod:${MOD_ID[m[1]!]}`, recharge: rechargeOf(m[3]!) });
  let m = new RegExp(`[Uu]si = mod (For|Des|Cos|Int|Sag|Car)( \\(min 1\\))?\\)? per ${rest}`).exec(text);
  if (m) return byMod(m);
  m = new RegExp(`mod (For|Des|Cos|Int|Sag|Car)( \\(min 1\\))? volte per ${rest}`).exec(text);
  if (m) return byMod(m);
  m = new RegExp(`(?:1 volta|Una volta) per ${rest}(?!\\s*(?:senza|per turno))`).exec(text);
  if (m) return { uses: 1, recharge: rechargeOf(m[1]!) };
  return undefined;
}

const hasResource = (f: Json) => (f.effects ?? []).some((e: Json) => e.op === "resource") || !!f.usage;
const hasFreeCast = (f: Json) => (f.effects ?? []).some((e: Json) => e.op === "grantSpell" && e.freeCast);
const once = (text: string) => /1 volta per turno|una volta per turno/i.test(text) && !/Riposo/.test(text);

// Un effetto per ogni aumento della colonna `col` (delta), attivo dal livello in cui compare, solo con lo stato attivo
const stepEffects = (table: (number | string)[], id: string, classId: string, extra: string, op = "damageBonus"): Json[] => {
  let prev = 0;
  return table.flatMap((v, i) => {
    const d = Number(v) - prev; prev = Number(v);
    return d > 0 ? [{ op, value: d, attackType: "any", when: `active:${id} && ${extra} && classLevel:${classId}>=${i + 1}` }] : [];
  });
};

type Patch = (f: Json, owner: Json) => void;
const T = (it: string) => ({ it });
const active = (id: string) => `active:${id}`;

// Stati attivabili curati (id del privilegio → modifica). `owner` = classe, sottoclasse o specie che lo contiene.
export const ACTIVATIONS: Record<string, Patch> = {
  // Ira: bonus ai danni con la Forza (colonna Danno ira), resistenze, Vantaggio ai TS di Forza, niente incantesimi (dal testo del privilegio)
  "barbarian/rage": (f, cls) => {
    f.activation = { resource: "rage", requires: "!wearingArmor:heavy", duration: "fino alla fine del tuo prossimo turno (massimo 10 minuti)" };
    f.effects.push(...stepEffects(cls.table.danno_ira, "rage", "barbarian", "attackAbility:str"),
      { op: "resistance", types: ["bludgeoning", "piercing", "slashing"], when: active("rage") },
      { op: "saveAdvantage", abilities: ["str"], when: active("rage") },
      { op: "restriction", forbids: "spellcasting", when: active("rage"), reason: "Non puoi lanciare incantesimi né concentrarti mentre sei in Ira" });
  },
  "druid/wild_shape": (f) => { f.activation = { resource: "wild_shape", duration: "in base alla forma scelta" }; },
  // Rivelazione celestiale: ali = volo pari alla Velocità (30 ft, la Velocità dell'Aasimar); le altre due opzioni sono solo testo
  "aasimar/celestial_revelation": (f, sp) => {
    const opts = /Ali celestiali.*?(?=•|$)/s.exec(f.description) ? [
      { id: "celestial_wings", name: T("Ali celestiali"), description: "Velocità di volare pari alla tua Velocità.", effects: [{ op: "setSpeed", mode: "fly", value: sp.speed }] },
      { id: "inner_radiance", name: T("Radiosità interiore"), description: "Luce intensa 10 ft e fioca per altri 10 ft; a fine turno chi è entro 10 ft subisce danni radiosi pari al bonus competenza.", effects: [] },
      { id: "necrotic_shroud", name: T("Sudario necrotico"), description: "Le creature non alleate entro 10 ft: TS Carisma (CD 8 + mod Car + competenza) o Spaventate fino alla fine del tuo prossimo turno.", effects: [] },
    ] : [];
    f.activation = { resource: "celestial_revelation", label: T("Aspetto"), duration: "1 minuto", options: opts };
  },
  "dragonborn/draconic_flight": (f, sp) => {
    f.activation = { resource: "draconic_flight", duration: "10 minuti" };
    f.effects.push({ op: "setSpeed", mode: "fly", value: sp.speed, when: active("draconic_flight") });
  },
  "goliath/large_form": (f) => {
    f.activation = { resource: "large_form", duration: "10 minuti" };
    f.effects.push({ op: "speedBonus", value: 10, when: active("large_form") });
  },
  "draconic/dragon_wings": (f) => { f.activation = { resource: "dragon_wings", duration: "1 ora" }; f.effects.push({ op: "setSpeed", mode: "fly", value: 60, when: active("dragon_wings") }); },
  "vengeance/avenging_angel": (f) => { f.activation = { resource: "avenging_angel", duration: "10 minuti" }; f.effects.push({ op: "setSpeed", mode: "fly", value: 60, when: active("avenging_angel") }); },
};

export interface PlayReport { usage: string[]; activations: string[]; missing: string[] }

// Applica contatori e attivazioni a classi, sottoclassi, specie e talenti (oggetti già letti da data/private)
export function applyFeaturePlay(data: { classes: Json[]; subclasses: Json[]; species: Json[]; feats: Json[] }): PlayReport {
  const rep: PlayReport = { usage: [], activations: [], missing: [] };
  const ownerOf = (kind: string, o: Json, list: Json[]) => list.forEach((f) => {
    f.effects ??= [];
    if (!hasResource(f) && !hasFreeCast(f) && !once(f.description ?? "")) {
      const u = deriveUsage(f.description ?? "");
      if (u) { f.usage = u; rep.usage.push(`${kind}/${o.id}/${f.id}: ${u.uses} · ${u.recharge}`); }
    }
    const patch = ACTIVATIONS[`${o.id}/${f.id}`];
    if (patch) { patch(f, o); rep.activations.push(`${kind}/${o.id}/${f.id}`); }
  });
  for (const c of data.classes) ownerOf("classi", c, c.features ?? []);
  for (const s of data.subclasses) ownerOf("sottoclassi", s, s.features ?? []);
  for (const s of data.species) ownerOf("specie", s, s.traits ?? []);
  for (const f of data.feats) ownerOf("talenti", f, [f]);
  // ogni attivazione dichiarata deve aver trovato il suo privilegio
  const done = new Set(rep.activations.map((a) => a.split("/").slice(1).join("/")));
  for (const k of Object.keys(ACTIVATIONS)) if (!done.has(k)) rep.missing.push(k);
  return rep;
}
