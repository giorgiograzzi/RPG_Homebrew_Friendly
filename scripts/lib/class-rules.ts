// Effetti e scelte delle classi (file "Modificatori" §3c-3d, §4). Tabelle, privilegi, sottoclassi e
// incantesimi sempre preparati vengono dal PDF; qui solo ciò che il PDF dice a parole.
// Id noti al motore (step 9/17): extra_attack, weapon_mastery, jack_of_all_trades.
type Json = Record<string, unknown>;
const T = (it: string) => ({ it });
const ABIL_IT: Record<string, string> = { int: "Intelligenza", wis: "Saggezza", cha: "Carisma" };

export type Table = Record<string, (number | string)[]>;
export interface FeatureRule {
  effects?: Json[] | ((table: Table) => Json[]); // funzione: effetti derivati dalla tabella di classe
  choices?: Json[]; resource?: { partialShortRest?: number };
}
// Elenco di opzioni dopo i privilegi (Metamagia, Suppliche occulte) o in una sottoclasse (Manovre)
export interface OptionList {
  heading: string; choiceId: string; label: string; countFrom?: string;
  kind: "cost" | "invocation" | "plain"; trailer?: string; // trailer: testo di chiusura non appartenente all'ultima opzione
}
export interface ClassRule {
  columns: string[]; // etichette delle colonne dopo "Privilegi" (nell'ordine del PDF)
  optionList?: OptionList;
  featureRules?: Record<string, FeatureRule>; // chiave "<id>" oppure "<id>@<livello>"
  subclassRules?: Record<string, Record<string, FeatureRule>>; // sottoclasse → privilegio
}

const skillOpts = (ids: [string, string][]) =>
  ids.map(([id, it]) => ({ id, name: T(it), effects: [{ op: "grantSkillProficiency", skills: [id] }] }));
const orderOptions = (armor: "heavy" | "medium", skills: [string, string][]) => [
  { id: "protector", name: T(armor === "heavy" ? "Protettore" : "Custode"), effects: [
    { op: "grantWeaponProficiency", weapons: ["martial"] }, { op: "grantArmorTraining", training: [armor] }] },
  { id: armor === "heavy" ? "thaumaturge" : "magician", name: T(armor === "heavy" ? "Taumaturgo" : "Mago naturale"), effects: [
    { op: "extraCantrips", count: 1 },
    { op: "checkBonus", value: "max(1, mod:wis)", skills: skills.map(([id]) => id) }] },
];
const plain = (ids: [string, string][]) => ids.map(([id, it]) => ({ id, name: T(it) }));

const expertise = (id: string, count: number): FeatureRule => ({ choices: [{ id, label: T("Maestria"), count, source: "expertise" }] });
const style = (id: string): FeatureRule => ({ choices: [{ id, label: T("Stile di combattimento"), count: 1, source: "feats:fighting_style" }] });
// Stile di combattimento (talento) OPPURE Guerriero benedetto/druidico (2 trucchetti): scelte alternative dello stesso gruppo
const styleOrWarrior = (prefix: string, list: "cleric" | "druid", ability: "cha" | "wis", name: string): FeatureRule => ({
  choices: [
    { id: `${prefix}_fighting_style`, label: T("Stile di combattimento"), count: 1, source: "feats:fighting_style", group: `${prefix}_style` },
    { id: `${prefix}_${name}_warrior`, label: T(list === "cleric" ? "Guerriero benedetto" : "Guerriero druidico"), count: 2, source: `cantrips:${list}`, ability, group: `${prefix}_style` },
  ],
});
const spellFx = (spell: string, extra: Json = {}): Json => ({ op: "grantSpell", spell, mode: "alwaysPrepared", ...extra });
const FREE_LR = { freeCast: { uses: 1, recharge: "long_rest" } };
const res = (resourceId: string, uses: number | string, recharge: string): Json => ({ op: "resource", resourceId, uses, recharge });
const resist = (...types: string[]): FeatureRule => ({ effects: [{ op: "resistance", types }] });
// Un effetto per ogni aumento della colonna `col` (delta), attivo dal livello in cui compare
const steps = (col: string, make: (delta: number, level: number) => Json) => (t: Table): Json[] => {
  let prev = 0;
  return (t[col] ?? []).flatMap((v, i) => { const d = Number(v) - prev; prev = Number(v); return d > 0 ? [make(d, i + 1)] : []; });
};
const NOARMOR = "!wearingArmor:any && !shield";

export const CLASS_RULES: Record<string, ClassRule> = {
  barbarian: {
    columns: ["Ire", "Danno ira", "Maestria armi"],
    featureRules: {
      rage: { resource: { partialShortRest: 1 } }, // "Recuperi 1 uso con Riposo Breve, tutti con Riposo Lungo"
      unarmored_defense: { effects: [{ op: "acFormula", formula: "10 + mod:dex + mod:con", shieldAllowed: true, when: "wearingArmor:none" }] },
      danger_sense: { effects: [{ op: "saveAdvantage", abilities: ["dex"] }] },
      fast_movement: { effects: [{ op: "speedBonus", value: 10, when: "!wearingArmor:heavy" }] },
      primal_knowledge: { choices: [{ id: "barbarian_primal_knowledge", label: T("Competenza aggiuntiva"), count: 1,
        options: skillOpts([["animal_handling", "Addestrare Animali"], ["athletics", "Atletica"], ["intimidation", "Intimidire"],
          ["nature", "Natura"], ["perception", "Percezione"], ["survival", "Sopravvivenza"]]) }] },
      primal_champion: { effects: [{ op: "abilityScoreIncrease", abilities: ["str", "con"], amount: 4, cap: 25 }] },
    },
  },
  bard: {
    columns: ["Dado ispirazione", "Trucchetti", "Preparati", "Slot"],
    featureRules: {
      words_of_creation: { effects: [spellFx("power_word_heal"), spellFx("power_word_kill")] },
      "expertise@2": { choices: [{ id: "bard_expertise_2", label: T("Maestria"), count: 2, source: "expertise" }] },
      "expertise_2@9": { choices: [{ id: "bard_expertise_9", label: T("Maestria"), count: 2, source: "expertise" }] },
    },
    subclassRules: {
      dance: { dazzling_footwork: { effects: [{ op: "acFormula", formula: "10 + mod:dex + mod:cha", shieldAllowed: false, when: "wearingArmor:none" }] } },
      glamour: {
        beguiling_magic: { effects: [spellFx("charm_person"), spellFx("mirror_image")] },
        mantle_of_majesty: { effects: [spellFx("command", FREE_LR)] },
      },
      valor: { martial_training: { effects: [{ op: "grantWeaponProficiency", weapons: ["martial"] }, { op: "grantArmorTraining", training: ["medium", "shield"] }] } },
      lore: {
        bonus_proficiencies: { choices: [{ id: "lore_bonus_skills", label: T("Competenze bonus"), count: 3, source: "skills" }] },
        magical_discoveries: { choices: [{ id: "lore_magical_discoveries", label: T("Scoperte magiche"), count: 2, source: "alwaysspells", filter: { classes: ["cleric", "druid", "wizard"] } }] },
      },
    },
  },
  cleric: {
    columns: ["Incanalare divinita", "Trucchetti", "Preparati", "Slot"],
    featureRules: {
      channel_divinity: { resource: { partialShortRest: 1 } }, // "recuperi 1 uso con Riposo Breve"
      divine_order: { choices: [{ id: "divine_order", label: T("Ordine divino"), count: 1, options: orderOptions("heavy", [["arcana", "Arcano"], ["religion", "Religione"]]) }] },
      blessed_strikes: { choices: [{ id: "blessed_strikes", label: T("Colpi benedetti"), count: 1,
        options: plain([["divine_strike", "Colpo divino"], ["potent_spellcasting", "Incantesimi potenti"]]) }] },
    },
  },
  druid: {
    columns: ["Forma selvatica", "Trucchetti", "Preparati", "Slot"],
    subclassRules: {
      stars: { star_map: { effects: [spellFx("guidance"), spellFx("guiding_bolt", { freeCast: { uses: "max(1, mod:wis)", recharge: "long_rest" } })] } },
    },
    featureRules: {
      wild_shape: { resource: { partialShortRest: 1 } },
      primal_order: { choices: [{ id: "primal_order", label: T("Ordine primordiale"), count: 1, options: orderOptions("medium", [["arcana", "Arcano"], ["nature", "Natura"]]) }] },
      elemental_fury: { choices: [{ id: "elemental_fury", label: T("Furia elementale"), count: 1,
        options: plain([["potent_spellcasting", "Incantesimi potenti"], ["primal_strike", "Colpo primordiale"]]) }] },
    },
  },
  // ---- 7b ----
  fighter: {
    columns: ["Recupero energie", "Maestria armi", "Azione impetuosa", "Indomito", "Attacchi"],
    featureRules: { fighting_style: style("fighter_fighting_style"), second_wind: { resource: { partialShortRest: 1 } } },
    subclassRules: {
      champion: {
        improved_critical: { effects: [{ op: "critRange", min: 19 }] },
        additional_fighting_style: style("champion_fighting_style"),
        superior_critical: { effects: [{ op: "critRange", min: 18 }] },
      },
      battle_master: {
        combat_superiority: { effects: (t) => [{ op: "resource", resourceId: "superiority_dice", uses: { table: t.dadi_superiorita as number[] }, recharge: "short_rest" }] },
        student_of_war: { choices: [
          { id: "battle_master_tool", label: T("Strumento da artigiano"), count: 1, source: "tools:artisan" },
          { id: "battle_master_skill", label: T("Abilità (lista del Guerriero)"), count: 1, source: "classSkills" }] },
      },
      psi_warrior: {
        telekinetic_master: { effects: [spellFx("telekinesis", { ability: "int", ...FREE_LR })] },
        psionic_power: { effects: (t) => [{ op: "resource", resourceId: "psionic_energy", uses: { table: t.dadi_energia as number[] }, recharge: "long_rest", partialShortRest: 1 }] },
      },
    },
  },
  monk: {
    columns: ["Arti marziali", "Punti disciplina", "Movimento senza armatura"],
    featureRules: {
      unarmored_defense: { effects: [{ op: "acFormula", formula: "10 + mod:dex + mod:wis", shieldAllowed: false, when: "wearingArmor:none" }] },
      martial_arts: { effects: (t) => { let prev = ""; return (t.arti_marziali ?? []).flatMap((v, i) => (String(v) !== prev ? ((prev = String(v)), [{ op: "unarmedDie", die: v, when: `classLevel:monk>=${i + 1} && ${NOARMOR}` }]) : [])); } },
      unarmored_movement: { effects: steps("movimento_senza_armatura", (d, l) => ({ op: "speedBonus", value: d, when: `classLevel:monk>=${l} && ${NOARMOR}` })) },
      disciplined_survivor: { effects: [{ op: "grantSaveProficiency", abilities: ["str", "dex", "con", "int", "wis", "cha"] }] },
      body_and_mind: { effects: [{ op: "abilityScoreIncrease", abilities: ["dex", "wis"], amount: 4, cap: 25 }] },
    },
    subclassRules: {
      mercy: { implements_of_mercy: { effects: [{ op: "grantSkillProficiency", skills: ["insight", "medicine"], expertise: false }, { op: "grantToolProficiency", tools: ["herbalism_kit"] }] } },
      shadow: { shadow_arts: { effects: [{ op: "sense", kind: "darkvision", range: 60, additive: true }] } },
      open_hand: { wholeness_of_body: { effects: [res("wholeness_of_body", "max(1, mod:wis)", "long_rest")] } },
    },
  },
  paladin: {
    columns: ["Incanalare divinita", "Maestria armi", "Preparati", "Slot"],
    featureRules: {
      fighting_style: styleOrWarrior("paladin", "cleric", "cha", "blessed"),
      channel_divinity: { resource: { partialShortRest: 1 } },
      aura_of_protection: { effects: [{ op: "saveBonus", value: "max(1, mod:cha)" }] }, // su di sé; agli alleati entro 10 ft: testo
    },
    subclassRules: {
      ancients: { aura_of_warding: resist("necrotic", "psychic", "radiant") },
      glory: { aura_of_alacrity: { effects: [{ op: "speedBonus", value: 10 }] } },
    },
  },
  ranger: {
    columns: ["Nemico prescelto", "Maestria armi", "Preparati", "Slot"],
    featureRules: {
      deft_explorer: { choices: [...expertise("ranger_deft_explorer", 1).choices!, { id: "ranger_languages", label: T("Linguaggi"), count: 2, source: "languages:standard" }] },
      fighting_style: styleOrWarrior("ranger", "druid", "wis", "druidic"),
      "expertise@9": expertise("ranger_expertise_9", 2),
      roving: { effects: [{ op: "speedBonus", value: 10, when: "!wearingArmor:heavy" }] },
      tireless: { effects: [res("tireless", "max(1, mod:wis)", "long_rest")] },
      natures_veil: { effects: [res("natures_veil", "max(1, mod:wis)", "long_rest")] },
      feral_senses: { effects: [{ op: "sense", kind: "blindsight", range: 30 }] },
    },
    subclassRules: {
      gloom_stalker: {
        dread_ambusher: { effects: [{ op: "initiativeBonus", value: "mod:wis" }] },
        umbral_sight: { effects: [{ op: "sense", kind: "darkvision", range: 60, additive: true }] }, // 60 ft, oppure +60 se già ce l'hai
        // Competenza nei TS di Saggezza; se già ce l'hai (dalla classe di partenza) scegli Intelligenza o Carisma
        iron_mind: { choices: [{ id: "iron_mind", label: T("Competenza nei tiri salvezza"), count: 1, options: [
          { id: "wis", name: T("Saggezza"), requires: "!saveProficient:wis", effects: [{ op: "grantSaveProficiency", abilities: ["wis"] }] },
          { id: "int", name: T("Intelligenza"), requires: "saveProficient:wis", effects: [{ op: "grantSaveProficiency", abilities: ["int"] }] },
          { id: "cha", name: T("Carisma"), requires: "saveProficient:wis", effects: [{ op: "grantSaveProficiency", abilities: ["cha"] }] },
        ] }] },
      },
      fey_wanderer: {
        otherworldly_glamour: {
          effects: [{ op: "checkBonus", value: "max(1, mod:wis)", skills: ["deception", "intimidation", "performance", "persuasion"] }],
          choices: [{ id: "fey_wanderer_skill", label: T("Competenza"), count: 1, options: skillOpts([["deception", "Inganno"], ["performance", "Intrattenere"], ["persuasion", "Persuasione"]]) }],
        },
      },
    },
  },
  rogue: {
    columns: ["Attacco furtivo", "Maestria armi"],
    featureRules: {
      "expertise@1": expertise("rogue_expertise_1", 2),
      "expertise_2@6": expertise("rogue_expertise_6", 2),
      thieves_cant: { choices: [{ id: "rogue_extra_language", label: T("Linguaggio aggiuntivo"), count: 1, source: "languages:standard" }] },
      slippery_mind: { effects: [{ op: "grantSaveProficiency", abilities: ["wis", "cha"] }] },
    },
    subclassRules: { assassin: { assassins_tools: { effects: [{ op: "grantToolProficiency", tools: ["disguise_kit", "poisoners_kit"] }] } } },
  },
  sorcerer: {
    columns: ["Punti stregoneria", "Metamagie note", "Trucchetti", "Preparati", "Slot"],
    subclassRules: {
      draconic: { draconic_resilience: { effects: [
        { op: "hpMaxPerLevel", value: 1, classId: "sorcerer" },
        { op: "acFormula", formula: "10 + mod:dex + mod:cha", shieldAllowed: true, when: "wearingArmor:none" }] } },
      aberrant: { psychic_defenses: resist("psychic") },
    },
    optionList: { heading: "Opzioni di Metamagia", choiceId: "sorcerer_metamagic", label: "Metamagia", countFrom: "metamagie_note", kind: "cost", trailer: "Creare slot con punti stregoneria" },
  },
  warlock: {
    columns: ["Invocazioni", "Trucchetti", "Preparati", "Slot"],
    featureRules: { magical_cunning: { effects: [res("magical_cunning", 1, "long_rest")] } },
    subclassRules: {
      celestial: { radiant_soul: resist("radiant"), healing_light: { effects: [res("healing_light", "1 + classLevel:warlock", "long_rest")] } },
      great_old_one: { thought_shield: resist("psychic"), eldritch_hex: { effects: [spellFx("hex")] } },
    },
    optionList: { heading: "Suppliche occulte (invocazioni)", choiceId: "warlock_invocations", label: "Invocazioni occulte", countFrom: "invocazioni", kind: "invocation" },
  },
  wizard: {
    columns: ["Trucchetti", "Preparati", "Slot"],
    featureRules: {
      spellcasting: { choices: [{ id: "wizard_spellbook", label: T("Libro degli incantesimi"), count: 6, countFormula: "4 + 2 * classLevel:wizard", source: "spells:wizard" }] }, // 6 al 1°, +2 a ogni livello
      arcane_recovery: { effects: [res("arcane_recovery", 1, "long_rest")] },
      scholar: expertise("wizard_scholar", 1),
    },
    subclassRules: {
      abjurer: { spell_breaker: { effects: [spellFx("counterspell"), spellFx("dispel_magic")] } },
      illusionist: { phantasmal_creatures: { effects: [spellFx("summon_beast", FREE_LR), spellFx("summon_fey", FREE_LR)] } },
    },
  },
};

export { ABIL_IT };
