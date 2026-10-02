// Tipi e costruttori per i dati delle classi (step 2d). I dati veri stanno in classes-*.ts, la verifica sui PDF in class-verify.ts.
export type Json = Record<string, unknown>;
export type Bi = { it: string; en: string };
export type Table = Record<string, (number | string)[]>; // colonne della tabella 1-20 (20 valori ciascuna)
export const B = (it: string, en: string): Bi => ({ it, en });

export interface FeatureDef {
  level: number; id: string; name: Bi; description: Bi;
  row?: Bi;            // testo nella tabella dei livelli, se diverso dal nome ("Azione impetuosa (un utilizzo)")
  tableOnly?: boolean; // compare nella tabella ma nel testo non ha un'intestazione propria (es. Maestria al 6°)
  effects?: Json[]; choices?: Json[]; usage?: Json; activation?: Json;
  build?: (t: Table) => { effects?: Json[]; choices?: Json[]; usage?: Json; activation?: Json }; // parti che dipendono dalla tabella letta dal PDF
}
export interface SubclassDef { id: string; name: Bi; heading: Bi; description: Bi; features: FeatureDef[]; checkPhrases?: { it: string[]; en: string[] } }
export interface ItemDef { item: string; qty?: number; it: string; en: string } // it/en: frammento di testo che deve comparire nel PDF
export interface EquipmentDef { gp: number; items: ItemDef[] }
export interface ColumnDef { id: string; name: Bi } // colonna della tabella dopo "Privilegi di classe", nell'ordine del PDF

export interface ClassDef {
  id: string; name: Bi; description: Bi; hitDie: 6 | 8 | 10 | 12;
  primary: string[]; saves: [string, string];
  skills: { count: number; from: string[] | "any" };
  armor: string[]; weapons: string[]; tools?: string[]; toolChoice?: { count: number; source: string };
  multiclass: { weapons?: string[]; armor?: string[]; skills?: number; toolChoices?: number; tools?: string[] };
  multiclassPhrases: { it: string[]; en: string[] }; // frasi di "Come personaggio multiclasse" da trovare nel PDF
  equipment: { A: EquipmentDef; B: EquipmentDef; C?: EquipmentDef };
  columns: ColumnDef[];
  extraRows?: { level: number; label: Bi }[]; // voci della tabella che non sono privilegi (es. "Indomabile (due utilizzi)")
  features: FeatureDef[]; subclass: SubclassDef;
  caster?: { type: "full" | "half" | "third" | "pact"; ability: string; list: string; spellbook?: boolean }; // spellbook: gli incantesimi preparati si scelgono dal libro (Mago)
  checkPhrases?: { it: string[]; en: string[] }; // nomi che devono comparire nel PDF (es. le opzioni di un elenco: Metamagia, Suppliche occulte)
  // frasi del blocco "Tratti" nel PDF (dado vita, caratteristica primaria, ecc.) controllate in ogni lingua
  core: { primaryIt: string; primaryEn: string; savesIt: string; savesEn: string; skillsIt: string; skillsEn: string; weaponsIt: string; weaponsEn: string; armorIt: string; armorEn: string; toolsIt?: string; toolsEn?: string };
}

export const f = (level: number, id: string, name: [string, string], description: [string, string], extra: Partial<FeatureDef> = {}): FeatureDef =>
  ({ level, id, name: B(...name), description: B(...description), ...extra });

// Aumento dei punteggi di caratteristica (talento) e Dono epico: scelte sui privilegi, una per livello
export const asi = (cls: string, level: number, tableOnly = true): FeatureDef => f(level, `ability_score_improvement_${level}`, ["Aumento dei punteggi di caratteristica", "Ability Score Improvement"],
  ["Ottieni il talento Aumento dei punteggi di caratteristica o un altro talento di cui hai i prerequisiti.", "You gain the Ability Score Improvement feat or another feat of your choice for which you qualify."],
  { tableOnly, choices: [{ id: `asi_${cls}_${level}`, label: B("Aumento dei punteggi di caratteristica", "Ability Score Improvement"), count: 1, source: "feats:general" }] });
export const epicBoon = (cls: string, recommended: Bi): FeatureDef => f(19, "epic_boon", ["Dono epico", "Epic Boon"],
  [`Ottieni un Dono epico o un altro talento di cui hai i prerequisiti. Consigliato: ${recommended.it}.`, `You gain an Epic Boon feat or another feat of your choice for which you qualify. Recommended: ${recommended.en}.`],
  { choices: [{ id: `epic_boon_${cls}`, label: B("Dono epico", "Epic Boon"), count: 1, source: "feats:epic_boon" }] });
export const subclassFeature = (cls: string, it: string, en: string): FeatureDef => f(3, `${cls}_subclass`, [`Sottoclasse ${it}`, `${en} Subclass`],
  ["Scegli una sottoclasse; ottieni i suoi privilegi ai livelli indicati.", "You gain a subclass of your choice; you gain its features at the levels shown."]);

// Un effetto per ogni aumento della colonna `col`, attivo dal livello in cui compare (es. danni dell'ira)
export const steps = (col: string, make: (delta: number, level: number) => Json) => (t: Table): Json[] => {
  let prev = 0;
  return (t[col] ?? []).flatMap((v, i) => { const d = Number(v) - prev; prev = Number(v); return d > 0 ? [make(d, i + 1)] : []; });
};

// Colonna di dadi (1d6, 1d8...): un effetto "dado dei colpi senz'armi" ai livelli in cui il valore cambia
export const dieSteps = (col: string, classId: string) => (t: Table): Json[] => {
  let prev = "";
  return (t[col] ?? []).flatMap((v, i) => { const d = String(v); const out = d !== prev ? [{ op: "unarmedDie", die: d, when: `classLevel:${classId}>=${i + 1} && wearingArmor:none && !shield` }] : []; prev = d; return out; });
};

// Opzioni di competenza in abilità: il nome viene preso dai dati delle abilità (segnaposto "$skill:<id>" risolto dall'estrattore)
export const skillOpts = (ids: string[]): Json[] => ids.map((id) => ({ id, name: { it: `$skill:${id}`, en: `$skill:${id}` }, effects: [{ op: "grantSkillProficiency", skills: [id] }] }));

// Colonne degli slot incantesimo (1°..n°) della tabella: diventano `spellSlots` e non restano nella tabella
export const slotCols = (n: number): ColumnDef[] => Array.from({ length: n }, (_, i) => ({ id: `slot_${i + 1}`, name: B(`Slot di ${i + 1}° livello`, `Level ${i + 1} spell slots`) }));
export const SLOT_COL = /^slot_(\d)$/;

// Opzione di una scelta (Metamagia, Suppliche occulte...): `cost` in punti, `requires` = condizione del motore
export const opt = (id: string, name: [string, string], description: [string, string], extra: Json = {}): Json => ({ id, name: B(...name), description: B(...description), ...extra });
