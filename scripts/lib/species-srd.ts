// Specie dell'SRD 5.2.1 (step 2c): dati, effetti per il motore e descrizioni brevi riscritte (IT+EN).
// I fatti verificabili (taglia, velocità, scurovisione, tabelle di lignaggi e antenati, frasi chiave dei tratti) sono
// confrontati con i due PDF da extract-species.ts. I testi { it, en } diventano la stringa della lingua del file.
type Json = Record<string, unknown>;
const B = (it: string, en: string) => ({ it, en });

export interface SpeciesDef {
  id: string; en: string; it: string;
  sizes: ("small" | "medium")[]; speed: number; darkvision?: number; // velocità e scurovisione in piedi (come nell'SRD EN)
  description: { it: string; en: string };
  effects?: Json[]; choices?: Json[]; traits?: Json[];
  // frasi che devono comparire nel testo del PDF (EN e IT) del blocco della specie
  expect: { en: string[]; it: string[] };
  // frasi delle tabelle (lignaggi, retaggi): nel PDF finiscono in mezzo ad altre specie, si cercano in tutta la sezione
  tables?: { en: string[]; it: string[] };
}

const trait = (id: string, name: { it: string; en: string }, description: { it: string; en: string }, extra: Json = {}): Json => ({ id, name, description, level: 1, ...extra });
const abil = (id: string, it: string, en: string) => ({ id, name: B(it, en) });
const SPELL_ABILITY: Json = { id: "spell_ability", label: B("Caratteristica da incantatore", "Spellcasting ability"), count: 1, options: [abil("int", "Intelligenza", "Intelligence"), abil("wis", "Saggezza", "Wisdom"), abil("cha", "Carisma", "Charisma")] };
const cantrip = (spell: string): Json => ({ op: "grantSpell", spell, mode: "cantrip", abilityFrom: "spell_ability" });
// incantesimo di livello superiore del lignaggio: sempre preparato, 1 lancio gratuito per riposo lungo
const gain = (spell: string, level: number): Json => ({ op: "grantSpell", spell, mode: "alwaysPrepared", abilityFrom: "spell_ability", freeCast: { uses: 1, recharge: "long_rest" }, when: `level>=${level}` });
const DARK = (range: number): Json => ({ op: "sense", kind: "darkvision", range });
const PB_LONG = { uses: "pb", recharge: "long_rest" };

const DRAGONS: [string, string, string, string][] = [ // id, IT, EN, tipo di danno
  ["black", "Nero", "Black", "acid"], ["blue", "Blu", "Blue", "lightning"], ["brass", "Ottone", "Brass", "fire"], ["bronze", "Bronzo", "Bronze", "lightning"],
  ["copper", "Rame", "Copper", "acid"], ["gold", "Oro", "Gold", "fire"], ["green", "Verde", "Green", "poison"], ["red", "Rosso", "Red", "fire"],
  ["silver", "Argento", "Silver", "cold"], ["white", "Bianco", "White", "cold"],
];
export const DRAGON_TABLE = DRAGONS.map(([id, it, en, dmg]) => ({ id, it, en, dmg }));
export const LINEAGES = {
  elf: { drow: ["dancing_lights", "faerie_fire", "darkness"], high_elf: ["prestidigitation", "detect_magic", "misty_step"], wood_elf: ["druidcraft", "longstrider", "pass_without_trace"] },
  tiefling: { abyssal: ["poison_spray", "ray_of_sickness", "hold_person"], chthonic: ["chill_touch", "false_life", "ray_of_enfeeblement"], infernal: ["fire_bolt", "hellish_rebuke", "darkness"] },
} as const;
const lineage = (id: string, it: string, en: string, spells: readonly string[], base: Json[], description?: { it: string; en: string }) =>
  ({ id, name: B(it, en), ...(description ? { description } : {}), effects: [...base, cantrip(spells[0]!), gain(spells[1]!, 3), gain(spells[2]!, 5)] });

// Nomi degli incantesimi citati dalle specie, come nei due PDF (verificati da extract-species.ts; in 2e devono esistere con questi id)
export const SPELL_NAMES: Record<string, [en: string, it: string]> = {
  dancing_lights: ["Dancing Lights", "luci danzanti"], faerie_fire: ["Faerie Fire", "luminescenza"], darkness: ["Darkness", "oscurità"],
  prestidigitation: ["Prestidigitation", "prestidigitazione"], detect_magic: ["Detect Magic", "individuazione del magico"], misty_step: ["Misty Step", "passo velato"],
  druidcraft: ["Druidcraft", "artificio druidico"], longstrider: ["Longstrider", "passo veloce"], pass_without_trace: ["Pass without Trace", "passare senza tracce"],
  poison_spray: ["Poison Spray", "spruzzo velenoso"], ray_of_sickness: ["Ray of Sickness", "raggio di infermità"], hold_person: ["Hold Person", "blocca persone"],
  chill_touch: ["Chill Touch", "tocco gelido"], false_life: ["False Life", "vita falsata"], ray_of_enfeeblement: ["Ray of Enfeeblement", "raggio di affaticamento"],
  fire_bolt: ["Fire Bolt", "dardo di fuoco"], hellish_rebuke: ["Hellish Rebuke", "intimorire infernale"], thaumaturgy: ["Thaumaturgy", "taumaturgia"],
  minor_illusion: ["Minor Illusion", "illusione minore"], speak_with_animals: ["Speak with Animals", "parlare con gli animali"], mending: ["Mending", "riparare"],
};

export const SPECIES: SpeciesDef[] = [
  {
    id: "dragonborn", en: "Dragonborn", it: "Dragonide", sizes: ["medium"], speed: 30, darkvision: 60,
    description: B("Discendenti di draghi: soffio di energia, resistenza e, dal 5° livello, ali spettrali.", "Descended from dragons: breath of energy, resistance, and from level 5 spectral wings."),
    effects: [DARK(60)],
    choices: [{ id: "draconic_ancestry", label: B("Discendenza draconica", "Draconic Ancestry"), count: 1,
      options: DRAGONS.map(([id, it, en, dmg]) => ({ id, name: B(it, en), effects: [{ op: "resistance", types: [dmg] }] })) }],
    traits: [
      trait("breath_weapon", B("Soffio", "Breath Weapon"), B("Al posto di un attacco esali energia in un cono di 4,5 m o in una linea di 9 m × 1,5 m: TS su Destrezza (CD 8 + Cos + competenza), 1d10 danni del tipo della discendenza (metà se superato). I dadi salgono a 2d10 al 5°, 3d10 all'11°, 4d10 al 17°. Usi pari al bonus di competenza, si ricaricano con un riposo lungo.", "In place of an attack, exhale energy in a 15-ft Cone or 30-ft × 5-ft Line: Dexterity save (DC 8 + Con + Proficiency), 1d10 damage of your ancestry's type (half on a save). Dice rise to 2d10 at 5th, 3d10 at 11th, 4d10 at 17th. Uses equal your Proficiency Bonus; regained on a Long Rest."), { usage: PB_LONG }),
      trait("draconic_flight", B("Volo draconico", "Draconic Flight"), B("Dal 5° livello, come azione bonus fai spuntare ali spettrali per 10 minuti: hai una velocità di volo pari alla tua velocità. Una volta per riposo lungo.", "From level 5, as a Bonus Action sprout spectral wings for 10 minutes: you have a Fly Speed equal to your Speed. Once per Long Rest."),
        { level: 5, usage: { uses: 1, recharge: "long_rest" }, activation: { resource: "draconic_flight", duration: B("10 minuti", "10 minutes") }, effects: [{ op: "setSpeed", mode: "fly", value: 30, when: "active:draconic_flight" }] }),
    ],
    expect: {
      en: ["Creature Type: Humanoid", "1d10 damage", "levels 5 (2d10), 11 (3d10), and 17 (4d10)", "Fly Speed equal to your Speed", "Resistance to the damage type determined"],
      it: ["1d10 danni", "5º livello (2d10), l'11º livello (3d10) e il 17º livello (4d10)", "velocità di volo pari alla sua velocità", "resistenza ai danni del tipo"],
    },
  },
  {
    id: "dwarf", en: "Dwarf", it: "Nano", sizes: ["medium"], speed: 30, darkvision: 120,
    description: B("Resistenti e tenaci: scurovisione ampia, resistenza al veleno e punti ferita extra a ogni livello.", "Hardy and tough: wide Darkvision, poison resistance, and extra Hit Points every level."),
    effects: [DARK(120), { op: "resistance", types: ["poison"] }, { op: "saveAdvantage", against: B("la condizione Avvelenato", "the Poisoned condition") }, { op: "hpMaxPerLevel", value: 1 }],
    traits: [
      trait("dwarven_resilience", B("Resilienza nanica", "Dwarven Resilience"), B("Resistenza ai danni da veleno e Vantaggio ai tiri salvezza per evitare o terminare la condizione Avvelenato.", "Resistance to Poison damage and Advantage on saves to avoid or end the Poisoned condition.")),
      trait("dwarven_toughness", B("Robustezza nanica", "Dwarven Toughness"), B("I punti ferita massimi aumentano di 1, e di 1 a ogni livello acquisito.", "Your Hit Point maximum increases by 1, and by 1 again each time you gain a level.")),
      trait("stonecunning", B("Esperto minatore", "Stonecunning"), B("Come azione bonus ottieni percezione tellurica entro 18 m (60 piedi) per 10 minuti, se sei su pietra o la tocchi. Usi pari al bonus di competenza, si ricaricano con un riposo lungo.", "As a Bonus Action gain Tremorsense out to 60 feet for 10 minutes while on or touching stone. Uses equal your Proficiency Bonus; regained on a Long Rest."), { usage: PB_LONG }),
    ],
    expect: {
      en: ["Darkvision with a range of 120 feet", "Resistance to Poison damage", "Hit Point maximum increases by 1", "Tremorsense with a range of 60 feet"],
      it: ["scurovisione fino a un raggio di 36 metri", "resistenza ai danni da veleno", "punti ferita massimi di un nano aumentano di 1", "percezione tellurica con un raggio di 18 metri"],
    },
  },
  {
    id: "elf", en: "Elf", it: "Elfo", sizes: ["medium"], speed: 30, darkvision: 60,
    description: B("Longevi e agili, con un lignaggio magico (Drow, Elfo alto o Elfo dei boschi), sensi acuti e trance al posto del sonno.", "Long-lived and graceful, with a magical lineage (Drow, High Elf, or Wood Elf), keen senses, and Trance in place of sleep."),
    effects: [DARK(60), { op: "saveAdvantage", against: B("la condizione Affascinato", "the Charmed condition") }],
    choices: [
      SPELL_ABILITY,
      { id: "elven_lineage", label: B("Lignaggio elfico", "Elven Lineage"), count: 1, options: [
        lineage("drow", "Drow", "Drow", LINEAGES.elf.drow, [DARK(120)], B("La scurovisione sale a 36 m (120 piedi).", "Your Darkvision range increases to 120 feet.")),
        lineage("high_elf", "Elfo alto", "High Elf", LINEAGES.elf.high_elf, [], B("A ogni riposo lungo puoi sostituire il trucchetto Prestidigitazione con un altro trucchetto della lista del mago.", "Whenever you finish a Long Rest, you can replace Prestidigitation with another cantrip from the Wizard list.")),
        lineage("wood_elf", "Elfo dei boschi", "Wood Elf", LINEAGES.elf.wood_elf, [{ op: "setSpeed", mode: "walk", value: 35 }]),
      ] },
      { id: "keen_senses", label: B("Sensi acuti", "Keen Senses"), count: 1, options: [["insight", "Intuizione", "Insight"], ["perception", "Percezione", "Perception"], ["survival", "Sopravvivenza", "Survival"]].map(([id, it, en]) => ({ id, name: B(it!, en!), effects: [{ op: "grantSkillProficiency", skills: [id] }] })) },
    ],
    traits: [
      trait("fey_ancestry", B("Retaggio fatato", "Fey Ancestry"), B("Vantaggio ai tiri salvezza per evitare o terminare la condizione Affascinato.", "Advantage on saves to avoid or end the Charmed condition.")),
      trait("trance", B("Trance", "Trance"), B("Non hai bisogno di dormire e la magia non può addormentarti. Fai un riposo lungo in 4 ore di meditazione restando cosciente.", "You don't need sleep and magic can't put you to sleep. You finish a Long Rest in 4 hours of trancelike meditation, staying conscious.")),
    ],
    expect: {
      en: ["Darkvision with a range of 60 feet", "Advantage on saving throws you make to avoid or end the Charmed condition", "proficiency in the", "finish a Long Rest in 4 hours"],
      it: ["scurovisione fino a un raggio di 18 metri", "vantaggio ai tiri salvezza eseguiti per evitare o terminare la condizione affascinato", "competenza nelle abilità", "riposo lungo in 4 ore"],
    },
    tables: { en: ["Speed increases to 35 feet", "range of your Darkvision increases to 120 feet"], it: ["velocità del personaggio aumenta a 10,5 metri", "scurovisione aumenta fino a 36 metri"] },
  },
  {
    id: "gnome", en: "Gnome", it: "Gnomo", sizes: ["small"], speed: 30, darkvision: 60,
    description: B("Piccoli e ingegnosi: Vantaggio ai TS mentali e un lignaggio magico (Gnomo delle foreste o delle rocce).", "Small and inventive: Advantage on mental saves and a magical lineage (Forest or Rock Gnome)."),
    effects: [DARK(60), { op: "saveAdvantage", abilities: ["int", "wis", "cha"] }],
    choices: [
      SPELL_ABILITY,
      { id: "gnomish_lineage", label: B("Lignaggio gnomesco", "Gnomish Lineage"), count: 1, options: [
        { id: "forest_gnome", name: B("Gnomo delle foreste", "Forest Gnome"), effects: [cantrip("minor_illusion"), { op: "grantSpell", spell: "speak_with_animals", mode: "alwaysPrepared", abilityFrom: "spell_ability", freeCast: PB_LONG }] },
        { id: "rock_gnome", name: B("Gnomo delle rocce", "Rock Gnome"), effects: [cantrip("mending"), cantrip("prestidigitation")],
          description: B("Con 10 minuti di lancio di Prestidigitazione crei un piccolo congegno meccanico (CA 5, 1 PF) che ripete uno degli effetti dell'incantesimo quando qualcuno usa un'azione bonus per attivarlo a contatto. Fino a tre congegni, ciascuno dura 8 ore.", "Spending 10 minutes casting Prestidigitation creates a Tiny clockwork device (AC 5, 1 HP) that repeats one of the spell's effects when someone uses a Bonus Action to touch-activate it. Up to three devices, each lasting 8 hours.") },
      ] },
    ],
    expect: {
      en: ["Darkvision with a range of 60 feet", "Advantage on Intelligence, Wisdom, and Charisma saving throws", "Minor Illusion", "Speak with Animals", "Mending and Prestidigitation", "AC 5"],
      it: ["scurovisione fino a un raggio di 18 metri", "vantaggio a i tiri salvezza su Intelligenza, Saggezza e Carisma", "illusione minore", "parlare con gli animali", "riparare e prestidigitazione", "CA 5"],
    },
  },
  {
    id: "goliath", en: "Goliath", it: "Goliath", sizes: ["medium"], speed: 35,
    description: B("Discendenti dei giganti: un dono del loro retaggio, costituzione robusta e, dal 5° livello, la Forma Grande.", "Descended from giants: a boon of your ancestry, powerful build, and from level 5 Large Form."),
    choices: [{ id: "giant_ancestry", label: B("Discendenza gigantica", "Giant Ancestry"), count: 1, options: [
      { id: "clouds_jaunt", name: B("Salta-nuvole (gigante delle nuvole)", "Cloud's Jaunt (Cloud Giant)"), description: B("Come azione bonus ti teletrasporti fino a 9 m in uno spazio libero che vedi.", "As a Bonus Action, teleport up to 30 feet to an unoccupied space you can see.") },
      { id: "fires_burn", name: B("Fuoco bruciante (gigante del fuoco)", "Fire's Burn (Fire Giant)"), description: B("Quando colpisci e infliggi danni, infliggi anche 1d10 danni da fuoco.", "When you hit and deal damage, also deal 1d10 Fire damage.") },
      { id: "frosts_chill", name: B("Brivido gelante (gigante del gelo)", "Frost's Chill (Frost Giant)"), description: B("Quando colpisci e infliggi danni, infliggi anche 1d6 danni da freddo e riduci la velocità del bersaglio di 3 m fino all'inizio del tuo turno.", "When you hit and deal damage, also deal 1d6 Cold damage and reduce the target's Speed by 10 feet until the start of your next turn.") },
      { id: "hills_tumble", name: B("Forza della collina (gigante delle colline)", "Hill's Tumble (Hill Giant)"), description: B("Quando colpisci una creatura Grande o più piccola e infliggi danni, puoi farla cadere Prona.", "When you hit a Large or smaller creature and deal damage, you can give it the Prone condition.") },
      { id: "stones_endurance", name: B("Resistenza della pietra (gigante delle pietre)", "Stone's Endurance (Stone Giant)"), description: B("Quando subisci danni, con una reazione tira 1d12, aggiungi il modificatore di Costituzione e riduci i danni di quel totale.", "When you take damage, use a Reaction to roll 1d12, add your Constitution modifier, and reduce the damage by that total.") },
      { id: "storms_thunder", name: B("Tuono tempestoso (gigante delle tempeste)", "Storm's Thunder (Storm Giant)"), description: B("Quando una creatura entro 18 m ti infligge danni, con una reazione le infliggi 1d8 danni da tuono.", "When a creature within 60 feet damages you, use a Reaction to deal 1d8 Thunder damage to it.") },
    ] }],
    traits: [
      trait("giant_ancestry_uses", B("Discendenza gigantica: usi", "Giant Ancestry: uses"), B("Puoi usare il dono scelto un numero di volte pari al bonus di competenza; gli usi tornano con un riposo lungo.", "You can use your chosen boon a number of times equal to your Proficiency Bonus; uses return on a Long Rest."), { usage: PB_LONG }),
      trait("powerful_build", B("Costituzione robusta", "Powerful Build"), B("Vantaggio alle prove di caratteristica per non essere afferrato; conti come una taglia più grande per la capacità di trasporto.", "Advantage on ability checks to end the Grappled condition; you count as one size larger for carrying capacity.")),
      trait("large_form", B("Forma Grande", "Large Form"), B("Dal 5° livello, come azione bonus diventi Grande per 10 minuti (se c'è spazio): Vantaggio alle prove di Forza e velocità +3 m (10 piedi). Una volta per riposo lungo.", "From level 5, as a Bonus Action become Large for 10 minutes (if there's room): Advantage on Strength checks and Speed +10 feet. Once per Long Rest."),
        { level: 5, usage: { uses: 1, recharge: "long_rest" }, activation: { resource: "large_form", duration: B("10 minuti", "10 minutes") }, effects: [{ op: "speedBonus", value: 10, when: "active:large_form" }] }),
    ],
    expect: {
      en: ["Speed: 35 feet", "number of times equal to your Proficiency Bonus", "1d10 Fire damage", "1d6 Cold damage", "1d12", "1d8 Thunder damage", "30 feet to an unoccupied space", "Large Form", "Advantage on any ability check you make to end the Grappled"],
      it: ["Velocità: 10,5 metri", "numero di volte pari al valore del suo bonus di competenza", "1d10 danni da fuoco", "1d6 danni da freddo", "1d12", "1d8 danni da tuono", "teletrasportarsi magicamente di un massimo di 9 metri", "Forma Grande", "vantaggio a qualsiasi prova di caratteristica effettuata per non essere afferrato"],
    },
  },
  {
    id: "halfling", en: "Halfling", it: "Halfling", sizes: ["small"], speed: 30,
    description: B("Piccoli e fortunati: coraggio, agilità tra le creature più grandi e furtività innata.", "Small and lucky: courage, nimbleness among larger creatures, and natural stealth."),
    effects: [{ op: "saveAdvantage", against: B("la condizione Spaventato", "the Frightened condition") }],
    traits: [
      trait("brave", B("Coraggioso", "Brave"), B("Vantaggio ai tiri salvezza per evitare o terminare la condizione Spaventato.", "Advantage on saves to avoid or end the Frightened condition.")),
      trait("halfling_nimbleness", B("Agilità halfling", "Halfling Nimbleness"), B("Puoi attraversare lo spazio di una creatura più grande di te, ma non fermarti lì.", "You can move through the space of any creature larger than you, but can't stop there.")),
      trait("luck", B("Fortuna", "Luck"), B("Quando ottieni 1 sul d20 di una prova con d20 puoi ritirare il dado e devi usare il nuovo risultato.", "When you roll a 1 on the d20 of a D20 Test, you can reroll it and must use the new roll.")),
      trait("naturally_stealthy", B("Furtività innata", "Naturally Stealthy"), B("Puoi Nascondersi anche se sei oscurato solo da una creatura più grande di te di almeno una taglia.", "You can Hide even when obscured only by a creature at least one size larger than you.")),
    ],
    expect: {
      en: ["Frightened condition", "move through the space of any creature that is a size larger", "roll a 1 on the d20", "Hide action"],
      it: ["condizione spaventato", "attraversare lo spazio occupato da qualsiasi creatura più grande", "ottieni 1", "azione di Nascondersi"],
    },
  },
  {
    id: "human", en: "Human", it: "Umano", sizes: ["medium", "small"], speed: 30,
    description: B("Versatili: Ispirazione eroica a ogni riposo lungo, una competenza in più e un talento Origini.", "Versatile: Heroic Inspiration every Long Rest, an extra skill, and an Origin feat."),
    choices: [
      { id: "skillful", label: B("Pluriabilità", "Skillful"), count: 1, source: "skills" },
      { id: "versatile", label: B("Versatile", "Versatile"), count: 1, source: "feats:origin" },
    ],
    traits: [
      trait("resourceful", B("Intraprendente", "Resourceful"), B("Ottieni Ispirazione eroica ogni volta che completi un riposo lungo.", "You gain Heroic Inspiration whenever you finish a Long Rest.")),
      trait("skillful", B("Pluriabilità", "Skillful"), B("Competenza in un'abilità a scelta.", "Proficiency in one skill of your choice.")),
      trait("versatile", B("Versatile", "Versatile"), B("Ottieni un talento Origini a scelta (consigliato: Abile).", "You gain an Origin feat of your choice (Skilled is recommended).")),
    ],
    expect: {
      en: ["Heroic Inspiration whenever you finish a Long Rest", "proficiency in one skill of your choice", "Origin feat of your choice"],
      it: ["Ispirazione eroica ogni volta che completa un riposo lungo", "competenza in un'abilità a sua scelta", "talento Origini a sua scelta"],
    },
  },
  {
    id: "orc", en: "Orc", it: "Orco", sizes: ["medium"], speed: 30, darkvision: 120,
    description: B("Resistenti e instancabili: scatto con punti ferita temporanei, scurovisione ampia e resistenza implacabile.", "Tireless and tough: a Dash that grants Temporary Hit Points, wide Darkvision, and Relentless Endurance."),
    effects: [DARK(120)],
    traits: [
      trait("adrenaline_rush", B("Scarica di adrenalina", "Adrenaline Rush"), B("Puoi usare Scatto come azione bonus e ottieni punti ferita temporanei pari al bonus di competenza. Usi pari al bonus di competenza, si ricaricano con un riposo breve o lungo.", "You can Dash as a Bonus Action and gain Temporary Hit Points equal to your Proficiency Bonus. Uses equal your Proficiency Bonus; regained on a Short or Long Rest."), { usage: { uses: "pb", recharge: "short_rest" } }),
      trait("relentless_endurance", B("Resistenza implacabile", "Relentless Endurance"), B("Quando scendi a 0 punti ferita senza morire sul colpo, puoi restare a 1 PF. Una volta per riposo lungo.", "When reduced to 0 Hit Points but not killed outright, you can drop to 1 instead. Once per Long Rest."), { usage: { uses: 1, recharge: "long_rest" } }),
    ],
    expect: {
      en: ["Darkvision with a range of 120 feet", "Dash action as a Bonus Action", "Temporary", "drop to 1 Hit Point"],
      it: ["scurovisione fino a un raggio di 36 metri", "azione di Scatto come azione bonus", "punti ferita temporanei pari al suo bonus di competenza", "rimanere a 1 punto ferita"],
    },
  },
  {
    id: "tiefling", en: "Tiefling", it: "Tiefling", sizes: ["medium", "small"], speed: 30, darkvision: 60,
    description: B("Segnati da un retaggio immondo (Abissale, Ctonio o Infernale): resistenza, magie innate e Taumaturgia.", "Marked by a fiendish legacy (Abyssal, Chthonic, or Infernal): a resistance, innate spells, and Thaumaturgy."),
    effects: [DARK(60), cantrip("thaumaturgy")],
    choices: [
      SPELL_ABILITY,
      { id: "fiendish_legacy", label: B("Retaggio immondo", "Fiendish Legacy"), count: 1, options: [
        lineage("abyssal", "Abissale", "Abyssal", LINEAGES.tiefling.abyssal, [{ op: "resistance", types: ["poison"] }]),
        lineage("chthonic", "Ctonio", "Chthonic", LINEAGES.tiefling.chthonic, [{ op: "resistance", types: ["necrotic"] }]),
        lineage("infernal", "Infernale", "Infernal", LINEAGES.tiefling.infernal, [{ op: "resistance", types: ["fire"] }]),
      ] },
    ],
    traits: [
      trait("otherworldly_presence", B("Presenza ultraterrena", "Otherworldly Presence"), B("Conosci il trucchetto Taumaturgia, lanciato con la stessa caratteristica del retaggio immondo.", "You know the Thaumaturgy cantrip, cast with the same ability as your Fiendish Legacy.")),
    ],
    expect: {
      en: ["Darkvision with a range of 60 feet", "Thaumaturgy cantrip"],
      it: ["scurovisione fino a un raggio di 18 metri", "taumaturgia"],
    },
    tables: { en: ["Resistance to Poison damage", "Resistance to Necrotic damage", "Resistance to Fire damage"], it: ["resistenza ai danni da veleno", "resistenza ai danni necrotici", "resistenza ai danni da fuoco"] },
  },
];
