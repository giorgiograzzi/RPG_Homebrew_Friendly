// Effetti numerici delle specie (file "Modificatori" §3b e §4d). Il resto è testo in `description`.
// Gli usi dei tratti ("Usi: ...") e gli incantesimi dei lignaggi sono presi dal PDF dall'estrattore.
type Json = Record<string, unknown>;
const T = (it: string) => ({ it });

// Effetti fissi della specie; `when` sblocca a livello personaggio (file 02 §2b: livello TOTALE)
export const SPECIES_EFFECTS: Record<string, Json[]> = {
  aasimar: [
    { op: "resistance", types: ["necrotic", "radiant"] },
    { op: "sense", kind: "darkvision", range: 60 },
    { op: "grantSpell", spell: "light", mode: "cantrip", ability: "cha" },
  ],
  dragonborn: [{ op: "sense", kind: "darkvision", range: 60 }],
  dwarf: [
    { op: "sense", kind: "darkvision", range: 120 },
    { op: "resistance", types: ["poison"] },
    { op: "saveAdvantage", against: "condizione Avvelenato" },
    { op: "hpMaxPerLevel", value: 1 }, // +1 PF per livello, retroattivo
  ],
  elf: [
    { op: "sense", kind: "darkvision", range: 60 },
    { op: "saveAdvantage", against: "condizione Affascinato" },
  ],
  gnome: [
    { op: "sense", kind: "darkvision", range: 60 },
    { op: "saveAdvantage", abilities: ["int", "wis", "cha"] },
  ],
  goliath: [],
  halfling: [{ op: "saveAdvantage", against: "condizione Spaventato" }],
  human: [],
  orc: [{ op: "sense", kind: "darkvision", range: 120 }],
  tiefling: [
    { op: "sense", kind: "darkvision", range: 60 },
    { op: "grantSpell", spell: "thaumaturgy", mode: "cantrip", abilityFrom: "spell_ability" },
  ],
};

// Effetti extra delle opzioni, chiave "<scelta>/<opzione>". Incantesimi e resistenze
// dell'ascendenza draconica arrivano dal PDF.
export const OPTION_EFFECTS: Record<string, Json[]> = {
  "elven_lineage/drow": [{ op: "sense", kind: "darkvision", range: 120 }],
  "elven_lineage/wood_elf": [{ op: "setSpeed", mode: "walk", value: 35 }],
  "fiendish_legacy/abyssal": [{ op: "resistance", types: ["poison"] }],
  "fiendish_legacy/chthonic": [{ op: "resistance", types: ["necrotic"] }],
  "fiendish_legacy/infernal": [{ op: "resistance", types: ["fire"] }],
};

export const DRAGON_DAMAGE: Record<string, string> = {
  Acido: "acid", Fulmine: "lightning", Fuoco: "fire", Veleno: "poison", Freddo: "cold",
};

// Lanci gratuiti con usi diversi da 1 (Gnomo delle foreste: bonus competenza)
export const FREE_CAST_USES: Record<string, number | string> = { speak_with_animals: "pb" };

const abilityOptions = ["int", "wis", "cha"].map((id) => ({ id, name: T({ int: "Intelligenza", wis: "Saggezza", cha: "Carisma" }[id]!) }));
const skillOptions = (ids: [string, string][]) =>
  ids.map(([id, it]) => ({ id, name: T(it), effects: [{ op: "grantSkillProficiency", skills: [id] }] }));

// Scelte semplici (nel PDF solo una riga di testo), per id della scelta
export const SIMPLE_CHOICES: Record<string, Json> = {
  spell_ability: { id: "spell_ability", label: T("Caratteristica da incantatore"), count: 1, options: abilityOptions },
  keen_senses: {
    id: "keen_senses", label: T("Sensi acuti"), count: 1,
    options: skillOptions([["insight", "Intuizione"], ["perception", "Percezione"], ["survival", "Sopravvivenza"]]),
  },
  skillful: { id: "skillful", label: T("Abile"), count: 1, source: "skills" },
  versatile: { id: "versatile", label: T("Versatile"), count: 1, source: "feats:origin" },
};
