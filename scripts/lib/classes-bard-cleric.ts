// Bardo e Chierico (SRD 5.2.1). Vedi classes-barbarian-fighter.ts per le convenzioni. Le liste degli incantesimi di classe
// sono dello step 2e; qui solo gli incantesimi che i privilegi concedono (id da verificare in 2e).
import { asi, B, epicBoon, f, slotCols, subclassFeature, type ClassDef } from "./class-types";

const grant = (spell: string, extra: Record<string, unknown> = {}) => ({ op: "grantSpell", spell, mode: "alwaysPrepared", ...extra });

export const BARD: ClassDef = {
  id: "bard", name: B("Bardo", "Bard"), hitDie: 8, primary: ["cha"], saves: ["dex", "cha"],
  description: B("Artista incantatore: Ispirazione bardica, maestria nelle abilità e incantesimi dalle liste di più classi.", "A performer and spellcaster: Bardic Inspiration, Expertise, and spells from several class lists."),
  skills: { count: 3, from: "any" }, armor: ["light"], weapons: ["simple"], toolChoice: { count: 3, source: "tools:musical" },
  multiclass: { armor: ["light"], skills: 1, toolChoices: 1 },
  multiclassPhrases: { it: ["competenza in un'abilità a scelta, competenza in uno strumento musicale a scelta e competenza nelle armature leggere"], en: ["proficiency in one skill of your choice, proficiency with one Musical Instrument of your choice, and training with Light armor"] },
  caster: { type: "full", ability: "cha", list: "bard" },
  core: { primaryIt: "Carisma", primaryEn: "Charisma", savesIt: "Destrezza e Carisma", savesEn: "Dexterity and Charisma", skillsIt: "Tre abilità a scelta", skillsEn: "Choose any 3 skills",
    weaponsIt: "Armi semplici", weaponsEn: "Simple weapons", armorIt: "Armature leggere", armorEn: "Light armor", toolsIt: "Tre strumenti musicali a scelta", toolsEn: "Choose 3 Musical Instruments" },
  equipment: {
    A: { gp: 19, items: [{ item: "leather_armor", it: "un'armatura di cuoio", en: "Leather Armor" }, { item: "dagger", qty: 2, it: "2 pugnali", en: "2 Daggers" }, { item: "$instrument", it: "uno strumento musicale (a scelta)", en: "Musical Instrument of your choice" }, { item: "entertainers_pack", it: "una dotazione da intrattenitore", en: "Entertainer's Pack" }] },
    B: { gp: 90, items: [] },
  },
  columns: [{ id: "bardic_die", name: B("Dado bardico", "Bardic Die") }, { id: "cantrips", name: B("Trucchetti", "Cantrips") }, { id: "prepared", name: B("Incantesimi preparati", "Prepared Spells") }, ...slotCols(9)],
  features: [
    f(1, "bardic_inspiration", ["Ispirazione bardica", "Bardic Inspiration"], ["Come azione bonus dai a una creatura entro 18 m che ti vede o ti sente un dado di Ispirazione bardica (colonna Dado bardico): entro 1 ora, quando fallisce una prova con d20, può tirarlo e aggiungerlo al risultato. Una creatura ne ha uno alla volta. Usi pari al modificatore di Carisma (minimo 1) per riposo lungo.", "As a Bonus Action give a creature within 60 feet that can see or hear you a Bardic Inspiration die (Bardic Die column): within 1 hour, when it fails a D20 Test it can roll the die and add it. A creature holds one at a time. Uses equal your Charisma modifier (minimum 1) per Long Rest."],
      { usage: { uses: "max(1, mod:cha)", recharge: "long_rest" } }),
    f(1, "spellcasting", ["Incantesimi", "Spellcasting"], ["Lanci incantesimi da bardo con Carisma, usando uno strumento musicale come focus. Conosci 2 trucchetti (altri al 4° e 10°) e prepari incantesimi (colonna Incantesimi preparati) dalla lista del bardo, di un livello per cui hai slot; ad ogni livello da bardo puoi sostituirne uno. Gli slot tornano con un riposo lungo.", "You cast Bard spells using Charisma, with a musical instrument as a focus. You know 2 cantrips (more at levels 4 and 10) and prepare spells (Prepared Spells column) from the Bard list, of a level you have slots for; whenever you gain a Bard level you can swap one. Slots return after a Long Rest."]),
    f(2, "expertise", ["Maestria", "Expertise"], ["Maestria in due abilità in cui hai competenza (consigliate Intrattenere e Persuasione). Al 9° livello altre due.", "Expertise in two skills you're proficient in (Performance and Persuasion are recommended). Two more at level 9."],
      { choices: [{ id: "bard_expertise_2", label: B("Maestria", "Expertise"), count: 2, source: "expertise" }] }),
    f(2, "jack_of_all_trades", ["Factotum", "Jack of All Trades"], ["Aggiungi metà del bonus di competenza (per difetto) alle prove di caratteristica in cui non sei già competente.", "You add half your Proficiency Bonus (rounded down) to any ability check that doesn't already include it."]),
    subclassFeature("bard", "del bardo", "Bard"),
    asi("bard", 4, false), asi("bard", 8), asi("bard", 12), asi("bard", 16),
    f(5, "font_of_inspiration", ["Fonte di ispirazione", "Font of Inspiration"], ["Recuperi tutti gli usi di Ispirazione bardica con un riposo breve o lungo; inoltre puoi spendere uno slot incantesimo (senza azione) per recuperarne uno.", "You regain all expended Bardic Inspiration uses after a Short or Long Rest; you can also expend a spell slot (no action) to regain one use."],
      { build: () => ({ usage: { uses: "max(1, mod:cha)", recharge: "short_rest" } }) }),
    f(7, "countercharm", ["Controfascino", "Countercharm"], ["Con la reazione, quando tu o una creatura entro 9 m fallite un tiro salvezza contro un effetto che applica affascinato o spaventato, il tiro si ripete con Vantaggio.", "As a Reaction, when you or a creature within 30 feet fails a save against an effect that applies Charmed or Frightened, the save is rerolled with Advantage."]),
    f(9, "expertise_9", ["Maestria", "Expertise"], ["Maestria in altre due abilità in cui hai competenza.", "Expertise in two more skills you're proficient in."], { tableOnly: true, choices: [{ id: "bard_expertise_9", label: B("Maestria", "Expertise"), count: 2, source: "expertise" }] }),
    f(10, "magical_secrets", ["Segreti magici", "Magical Secrets"], ["Quando aumenta il numero di incantesimi preparati puoi sceglierne uno qualsiasi dalle liste di bardo, chierico, druido e mago: per te contano come incantesimi da bardo. Puoi sostituire un preparato con uno di queste liste.", "When your number of prepared spells increases you can choose any spell from the Bard, Cleric, Druid, and Wizard lists: they count as Bard spells for you. You can swap a prepared spell for one from these lists."]),
    f(18, "superior_inspiration", ["Ispirazione superiore", "Superior Inspiration"], ["Quando tiri l'iniziativa e hai meno di due usi di Ispirazione bardica, ne recuperi fino ad averne due.", "When you roll Initiative with fewer than two Bardic Inspiration uses, you regain uses until you have two."]),
    epicBoon("bard", B("Dono del richiamo degli incantesimi", "Boon of Spell Recall")),
    f(20, "words_of_creation", ["Parole della creazione", "Words of Creation"], ["Parola del potere guarire e Parola del potere uccidere sono sempre preparate; quando le lanci puoi bersagliare una seconda creatura entro 3 m dal primo bersaglio.", "Power Word Heal and Power Word Kill are always prepared; when you cast either you can target a second creature within 10 feet of the first."],
      { effects: [grant("power_word_heal"), grant("power_word_kill")] }),
  ],
  subclass: {
    id: "lore", name: B("Collegio della Sapienza", "College of Lore"), heading: B("Sottoclasse del bardo: Collegio della Sapienza", "Bard Subclass: College of Lore"),
    description: B("Raccoglie conoscenze e segreti magici da ogni fonte: competenze extra, parole taglienti e scoperte magiche.", "Gathers lore and magical secrets from every source: extra proficiencies, cutting words, and magical discoveries."),
    features: [
      f(3, "bonus_proficiencies", ["Competenze bonus", "Bonus Proficiencies"], ["Competenza in tre abilità a tua scelta.", "You gain proficiency in three skills of your choice."], { choices: [{ id: "lore_bonus_skills", label: B("Abilità", "Skills"), count: 3, source: "skills" }] }),
      f(3, "cutting_words", ["Parole taglienti", "Cutting Words"], ["Con la reazione, quando una creatura entro 18 m fa un tiro per i danni o supera una prova di caratteristica o un tiro per colpire, spendi un uso di Ispirazione bardica e sottrai il tiro del dado al suo risultato.", "As a Reaction, when a creature within 60 feet makes a damage roll or succeeds on an ability check or attack roll, spend a Bardic Inspiration use and subtract the die roll from its result."]),
      f(6, "magical_discoveries", ["Scoperte magiche", "Magical Discoveries"], ["Impari due incantesimi (trucchetti o di un livello per cui hai slot) dalle liste di chierico, druido e mago: sono sempre preparati e puoi sostituirne uno a ogni livello da bardo.", "You learn two spells (cantrips or of a level you have slots for) from the Cleric, Druid, and Wizard lists: they're always prepared and you can swap one whenever you gain a Bard level."]),
      f(14, "peerless_skill", ["Abilità impareggiabile", "Peerless Skill"], ["Quando fallisci una prova di caratteristica o un tiro per colpire puoi spendere un uso di Ispirazione bardica e sommare il dado al d20; se fallisce ancora, l'uso non viene speso.", "When you fail an ability check or attack roll you can spend a Bardic Inspiration use and add the die to the d20; if you still fail, the use isn't expended."]),
    ],
  },
};

export const CLERIC: ClassDef = {
  id: "cleric", name: B("Chierico", "Cleric"), hitDie: 8, primary: ["wis"], saves: ["wis", "cha"],
  description: B("Incantatore sacro: Ordine divino, Incanalare divinità e guarigione o potere offensivo sacro.", "A divine spellcaster: Divine Order, Channel Divinity, and holy healing or offense."),
  skills: { count: 2, from: ["history", "insight", "medicine", "persuasion", "religion"] }, armor: ["light", "medium", "shield"], weapons: ["simple"],
  multiclass: { armor: ["light", "medium", "shield"] },
  multiclassPhrases: { it: ["competenza nelle armature leggere, medie e negli scudi"], en: ["training with Light and Medium armor and Shields"] },
  caster: { type: "full", ability: "wis", list: "cleric" },
  core: { primaryIt: "Saggezza", primaryEn: "Wisdom", savesIt: "Saggezza e Carisma", savesEn: "Wisdom and Charisma", skillsIt: "Due a scelta tra: Intuizione, Medicina, Persuasione, Religione o Storia", skillsEn: "Choose 2: History, Insight, Medicine, Persuasion, or Religion",
    weaponsIt: "Armi semplici", weaponsEn: "Simple weapons", armorIt: "Armature leggere e medie; scudi", armorEn: "Light and Medium armor and Shields" },
  equipment: {
    A: { gp: 7, items: [{ item: "chain_shirt", it: "un giaco di maglia", en: "Chain Shirt" }, { item: "shield", it: "uno scudo", en: "Shield" }, { item: "mace", it: "una mazza", en: "Mace" }, { item: "$holy_symbol", it: "un simbolo sacro", en: "Holy Symbol" }, { item: "priests_pack", it: "una dotazione da sacerdote", en: "Priest's Pack" }] },
    B: { gp: 110, items: [] },
  },
  columns: [{ id: "channel_divinity", name: B("Incanalare divinità", "Channel Divinity") }, { id: "cantrips", name: B("Trucchetti", "Cantrips") }, { id: "prepared", name: B("Incantesimi preparati", "Prepared Spells") }, ...slotCols(9)],
  features: [
    f(1, "spellcasting", ["Incantesimi", "Spellcasting"], ["Lanci incantesimi da chierico con Saggezza, usando un simbolo sacro come focus. Conosci 3 trucchetti (altri al 4° e 10°) e prepari incantesimi (colonna Incantesimi preparati) dalla lista del chierico; dopo un riposo lungo puoi cambiare la lista. Gli slot tornano con un riposo lungo.", "You cast Cleric spells using Wisdom, with a holy symbol as a focus. You know 3 cantrips (more at levels 4 and 10) and prepare spells (Prepared Spells column) from the Cleric list; after a Long Rest you can change the list. Slots return after a Long Rest."]),
    f(1, "divine_order", ["Ordine divino", "Divine Order"], ["Scegli un ruolo sacro: Protettore (competenza con armi da guerra e armature pesanti) o Taumaturgo (un trucchetto extra e bonus alle prove di Intelligenza (Arcano o Religione) pari al modificatore di Saggezza, minimo +1).", "Choose a sacred role: Protector (proficiency with Martial weapons and Heavy armor) or Thaumaturge (one extra cantrip and a bonus to Intelligence (Arcana or Religion) checks equal to your Wisdom modifier, minimum +1)."],
      { choices: [{ id: "cleric_divine_order", label: B("Ordine divino", "Divine Order"), count: 1, options: [
        { id: "protector", name: B("Protettore", "Protector"), effects: [{ op: "grantWeaponProficiency", weapons: ["martial"] }, { op: "grantArmorTraining", training: ["heavy"] }] },
        { id: "thaumaturge", name: B("Taumaturgo", "Thaumaturge"), effects: [{ op: "extraCantrips", count: 1 }, { op: "checkBonus", value: "max(1, mod:wis)", skills: ["arcana", "religion"] }] },
      ] }] }),
    f(2, "channel_divinity", ["Incanalare divinità", "Channel Divinity"], ["Incanali energia divina con due effetti: Scintilla divina (azione di Magia: una creatura entro 9 m recupera 1d8 + Sag PF, o subisce danni necrotici/radiosi con TS su Costituzione; più dadi al 7°, 13°, 18°) e Scacciare non morti (TS su Saggezza o i non morti entro 9 m sono spaventati e incapacitati 1 minuto). Usi nella colonna Incanalare divinità: ne recuperi 1 con un riposo breve, tutti con uno lungo.", "You channel divine energy with two effects: Divine Spark (Magic action: a creature within 30 feet regains 1d8 + Wis Hit Points, or takes Necrotic/Radiant damage with a Constitution save; more dice at 7, 13, 18) and Turn Undead (Wisdom save or Undead within 30 feet are Frightened and Incapacitated for 1 minute). Uses are in the Channel Divinity column: regain one on a Short Rest, all on a Long Rest."],
      { build: (t) => ({ usage: { uses: { table: t.channel_divinity }, recharge: "long_rest", partialShortRest: 1 } }) }),
    subclassFeature("cleric", "del chierico", "Cleric"),
    asi("cleric", 4, false), asi("cleric", 8), asi("cleric", 12), asi("cleric", 16),
    f(5, "sear_undead", ["Bruciare i non morti", "Sear Undead"], ["Quando usi Scacciare non morti tira un numero di d8 pari al modificatore di Saggezza (minimo 1): i non morti che falliscono il tiro salvezza subiscono quei danni radiosi.", "When you use Turn Undead, roll a number of d8s equal to your Wisdom modifier (minimum 1): Undead that fail the save take that Radiant damage."]),
    f(7, "blessed_strikes", ["Colpi benedetti", "Blessed Strikes"], ["Scegli: Colpo divino (una volta per turno, quando colpisci con un'arma, +1d8 danni necrotici o radiosi) oppure Incantesimi potenti (aggiungi Saggezza ai danni dei trucchetti da chierico).", "Choose: Divine Strike (once per turn, when you hit with a weapon, +1d8 Necrotic or Radiant damage) or Potent Spellcasting (add your Wisdom modifier to Cleric cantrip damage)."],
      { choices: [{ id: "cleric_blessed_strikes", label: B("Colpi benedetti", "Blessed Strikes"), count: 1, options: [{ id: "divine_strike", name: B("Colpo divino", "Divine Strike") }, { id: "potent_spellcasting", name: B("Incantesimi potenti", "Potent Spellcasting") }] }] }),
    f(10, "divine_intervention", ["Intervento divino", "Divine Intervention"], ["Come azione di Magia lanci un incantesimo da chierico qualsiasi di 5° livello o inferiore (senza reazione) senza slot né componenti materiali. Una volta per riposo lungo.", "As a Magic action you cast any Cleric spell of level 5 or lower (that doesn't need a Reaction) without a slot or Material components. Once per Long Rest."], { usage: { uses: 1, recharge: "long_rest" } }),
    f(14, "improved_blessed_strikes", ["Colpi benedetti migliorati", "Improved Blessed Strikes"], ["Colpo divino: +2d8. Incantesimi potenti: quando un tuo trucchetto da chierico infligge danni, puoi dare a te o a una creatura entro 18 m PF temporanei pari al doppio del modificatore di Saggezza.", "Divine Strike: +2d8. Potent Spellcasting: when a Cleric cantrip deals damage you can give yourself or a creature within 60 feet Temporary Hit Points equal to twice your Wisdom modifier."]),
    epicBoon("cleric", B("Dono del fato", "Boon of Fate")),
    f(20, "greater_divine_intervention", ["Intervento divino superiore", "Greater Divine Intervention"], ["Con Intervento divino puoi scegliere Desiderio; se lo fai non puoi usare di nuovo Intervento divino finché non completi 2d4 riposi lunghi.", "When you use Divine Intervention you can choose Wish; if you do, you can't use Divine Intervention again until you finish 2d4 Long Rests."]),
  ],
  subclass: {
    id: "life_domain", name: B("Dominio della Vita", "Life Domain"), heading: B("Sottoclasse del chierico: Dominio della Vita", "Cleric Subclass: Life Domain"),
    description: B("Energia positiva e guarigione: incantesimi sempre preparati, cure potenziate e Preservare vita.", "Positive energy and healing: always-prepared spells, boosted cures, and Preserve Life."),
    checkPhrases: { it: ["Aiuto , benedizione , cura ferite e ristorare inferiore", "Parola guaritrice di massa e rinascita", "Aura di vita e interdizione alla morte", "Ristorare superiore e cura ferite di massa"], en: ["Aid, Bless, Cure Wounds, Lesser Restoration", "Mass Healing Word, Revivify", "Aura of Life, Death Ward", "Greater Restoration, Mass Cure Wounds"] },
    features: [
      f(3, "disciple_of_life", ["Discepolo della vita", "Disciple of Life"], ["Quando un tuo incantesimo con slot ripristina PF, la creatura recupera 2 + il livello dello slot PF aggiuntivi.", "When a spell you cast with a slot restores Hit Points, the creature regains additional Hit Points equal to 2 plus the slot's level."]),
      f(3, "life_domain_spells", ["Incantesimi del Dominio della Vita", "Life Domain Spells"], ["Incantesimi sempre preparati: 3° Aiuto, Benedizione, Cura ferite, Ristorare inferiore; 5° Parola guaritrice di massa, Rinascita; 7° Aura di vita, Interdizione alla morte; 9° Ristorare superiore, Cura ferite di massa.", "Always-prepared spells: level 3 Aid, Bless, Cure Wounds, Lesser Restoration; 5 Mass Healing Word, Revivify; 7 Aura of Life, Death Ward; 9 Greater Restoration, Mass Cure Wounds."],
        { effects: [[3, ["aid", "bless", "cure_wounds", "lesser_restoration"]], [5, ["mass_healing_word", "revivify"]], [7, ["aura_of_life", "death_ward"]], [9, ["greater_restoration", "mass_cure_wounds"]]]
          .flatMap(([lv, sp]) => (sp as string[]).map((s) => grant(s, { when: `classLevel:cleric>=${lv}` }))) }),
      f(3, "preserve_life", ["Preservare vita", "Preserve Life"], ["Azione di Magia, spendendo un uso di Incanalare divinità: ripristini PF pari a 5 × livello da chierico, divisi tra creature sanguinanti entro 9 m (nessuna oltre metà dei PF massimi).", "As a Magic action, expending a Channel Divinity use: restore Hit Points equal to five times your Cleric level, divided among Bloodied creatures within 30 feet (none above half its Hit Point maximum)."]),
      f(6, "blessed_healer", ["Guaritore benedetto", "Blessed Healer"], ["Quando curi altri con un incantesimo con slot, recuperi anche tu 2 + il livello dello slot PF.", "When you heal others with a spell using a slot, you also regain 2 plus the slot's level Hit Points."]),
      f(17, "supreme_healing", ["Guarigione suprema", "Supreme Healing"], ["Quando tiri dadi per ripristinare PF con un incantesimo o con Incanalare divinità, usi il massimo di ogni dado.", "When you would roll dice to restore Hit Points with a spell or Channel Divinity, use the highest number possible for each die."]),
    ],
  },
};
