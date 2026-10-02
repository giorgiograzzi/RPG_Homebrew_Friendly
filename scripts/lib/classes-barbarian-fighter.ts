// Barbaro e Guerriero (SRD 5.2.1). Nomi, descrizioni brevi (riscritte) ed effetti; tabelle e intestazioni sono verificate
// sui PDF da class-verify.ts. Id delle colonne della tabella in inglese (es. rages, rage_damage).
import { asi, B, epicBoon, f, skillOpts, steps, subclassFeature, type ClassDef } from "./class-types";

const TWO_FROM_TABLE = (cls: string, col: string) => ({ id: `${cls}_weapon_mastery`, label: B("Padronanza d'armi", "Weapon Mastery"), countFrom: col, source: "weaponMastery" });
const lvl = (rows: [number, number][]) => (n: number) => rows.filter(([from]) => n >= from).at(-1)?.[1] ?? 0; // valore per livello da soglie
const tableOf = (rows: [number, number][]) => ({ table: Array.from({ length: 20 }, (_, i) => lvl(rows)(i + 1)) });

export const BARBARIAN: ClassDef = {
  id: "barbarian", name: B("Barbaro", "Barbarian"), hitDie: 12, primary: ["str"], saves: ["str", "con"],
  description: B("Guerriero feroce che attinge a un'ira primordiale: resistenza ai danni, forza bruta e attacchi devastanti.", "A fierce warrior who channels primal Rage: damage resistance, raw strength, and devastating strikes."),
  skills: { count: 2, from: ["animal_handling", "athletics", "intimidation", "nature", "perception", "survival"] },
  armor: ["light", "medium", "shield"], weapons: ["simple", "martial"],
  multiclass: { weapons: ["martial"], armor: ["shield"] },
  multiclassPhrases: { it: ["competenza nelle armi da guerra e negli scudi"], en: ["proficiency with Martial weapons, and training with Shields"] },
  core: { primaryIt: "Forza", primaryEn: "Strength", savesIt: "Forza e Costituzione", savesEn: "Strength and Constitution",
    skillsIt: "Due a scelta tra: Addestrare Animali, Atletica, Intimidire, Natura, Percezione o Sopravvivenza", skillsEn: "Choose 2: Animal Handling, Athletics, Intimidation, Nature, Perception, or Survival",
    weaponsIt: "Armi semplici e da guerra", weaponsEn: "Simple and Martial weapons", armorIt: "Armature leggere e medie; scudi", armorEn: "Light and Medium armor and Shields" },
  equipment: {
    A: { gp: 15, items: [{ item: "greataxe", it: "un'ascia bipenne", en: "Greataxe" }, { item: "handaxe", qty: 4, it: "4 asce", en: "4 Handaxes" }, { item: "explorers_pack", it: "una dotazione da esploratore", en: "Explorer's Pack" }] },
    B: { gp: 75, items: [] },
  },
  columns: [{ id: "rages", name: B("Ire", "Rages") }, { id: "rage_damage", name: B("Danni dell'ira", "Rage Damage") }, { id: "weapon_mastery", name: B("Padronanza d'armi", "Weapon Mastery") }],
  features: [
    f(1, "rage", ["Ira", "Rage"], [
      "Come azione bonus (senza armatura pesante) entri in ira; gli usi sono nella colonna Ire (ne recuperi 1 con un riposo breve, tutti con uno lungo). In ira: resistenza ai danni contundenti, perforanti e taglienti; bonus ai danni degli attacchi basati su Forza (colonna Danni dell'ira); Vantaggio alle prove e ai tiri salvezza su Forza; niente concentrazione né incantesimi. L'ira dura fino alla fine del tuo prossimo turno e si prolunga se attacchi, costringi un nemico a un tiro salvezza o usi un'azione bonus (massimo 10 minuti); finisce se indossi un'armatura pesante o sei incapacitato.",
      "As a Bonus Action (not in Heavy armor) you enter a Rage; uses are in the Rages column (regain one on a Short Rest, all on a Long Rest). While raging: Resistance to Bludgeoning, Piercing, and Slashing damage; a bonus to damage with Strength-based attacks (Rage Damage column); Advantage on Strength checks and saves; no Concentration or spells. It lasts until the end of your next turn and extends if you attack, force a save, or use a Bonus Action (up to 10 minutes); it ends if you don Heavy armor or are Incapacitated."],
      { activation: { resource: "rage", requires: "!wearingArmor:heavy", duration: B("10 minuti", "10 minutes") },
        build: (t) => ({
          usage: { uses: { table: t.rages }, recharge: "long_rest", partialShortRest: 1 },
          effects: [
            { op: "resistance", types: ["bludgeoning", "piercing", "slashing"], when: "active:rage" },
            { op: "saveAdvantage", abilities: ["str"], when: "active:rage" },
            { op: "restriction", forbids: "spellcasting", reason: "Ira", when: "active:rage" },
            ...steps("rage_damage", (d, l) => ({ op: "damageBonus", value: d, attackType: "any", when: `classLevel:barbarian>=${l} && active:rage && attackAbility:str` }))(t),
          ],
        }) }),
    f(1, "unarmored_defense", ["Difesa senza armatura", "Unarmored Defense"], ["Senza armatura la CA base è 10 + Des + Cos; puoi usare uno scudo.", "Without armor your base AC is 10 + Dex + Con; you can use a Shield."],
      { effects: [{ op: "acFormula", formula: "10 + mod:dex + mod:con", shieldAllowed: true, when: "wearingArmor:none" }] }),
    f(1, "weapon_mastery", ["Padronanza d'armi", "Weapon Mastery"], ["Puoi usare le proprietà di padronanza di 2 tipi di armi da mischia semplici o da guerra (altri con i livelli, colonna Padronanza d'armi); a ogni riposo lungo puoi cambiarne uno.", "You can use the mastery properties of 2 kinds of Simple or Martial Melee weapons (more with levels, Weapon Mastery column); after a Long Rest you can change one."],
      { choices: [{ ...TWO_FROM_TABLE("barbarian", "weapon_mastery"), weaponFilter: { kind: "melee" } }] }),
    f(2, "danger_sense", ["Percezione del pericolo", "Danger Sense"], ["Vantaggio ai tiri salvezza su Destrezza, a meno che tu sia incapacitato.", "Advantage on Dexterity saving throws unless you have the Incapacitated condition."], { effects: [{ op: "saveAdvantage", abilities: ["dex"] }] }),
    f(2, "reckless_attack", ["Attacco irruento", "Reckless Attack"], ["Con il primo attacco del tuo turno puoi attaccare con irruenza: Vantaggio ai tiri per colpire con Forza fino all'inizio del tuo prossimo turno, ma anche i tiri contro di te hanno Vantaggio.", "On your first attack of the turn you can attack recklessly: Advantage on Strength-based attack rolls until the start of your next turn, but attack rolls against you have Advantage."]),
    subclassFeature("barbarian", "del barbaro", "Barbarian"),
    f(3, "primal_knowledge", ["Conoscenza primordiale", "Primal Knowledge"], ["Competenza in un'altra abilità della lista del barbaro. In ira puoi fare prove di Acrobazia, Intimidire, Percezione, Furtività o Sopravvivenza usando Forza.", "Proficiency in another skill from the Barbarian list. While raging you can make Acrobatics, Intimidation, Perception, Stealth, or Survival checks using Strength."],
      { choices: [{ id: "barbarian_primal_knowledge", label: B("Competenza aggiuntiva", "Extra proficiency"), count: 1,
        options: skillOpts(["animal_handling", "athletics", "intimidation", "nature", "perception", "survival"]) }] }),
    asi("barbarian", 4, false), asi("barbarian", 8), asi("barbarian", 12), asi("barbarian", 16),
    f(5, "extra_attack", ["Attacco extra", "Extra Attack"], ["Attacchi due volte con l'azione Attacco.", "You can attack twice when you take the Attack action."]),
    f(5, "fast_movement", ["Movimento veloce", "Fast Movement"], ["Velocità +3 m (10 piedi) se non indossi un'armatura pesante.", "Your Speed increases by 10 feet while you aren't wearing Heavy armor."], { effects: [{ op: "speedBonus", value: 10, when: "!wearingArmor:heavy" }] }),
    f(7, "feral_instinct", ["Istinto ferino", "Feral Instinct"], ["Vantaggio ai tiri per l'iniziativa.", "Advantage on Initiative rolls."]),
    f(7, "instinctive_pounce", ["Balzo istintivo", "Instinctive Pounce"], ["Come parte dell'azione bonus per entrare in ira puoi muoverti fino a metà della tua velocità.", "As part of the Bonus Action to enter your Rage, you can move up to half your Speed."]),
    f(9, "brutal_strike", ["Colpo brutale", "Brutal Strike"], ["Se usi Attacco irruento puoi rinunciare al Vantaggio di un attacco basato su Forza: se colpisce infligge 1d10 danni extra e un effetto: Colpo violento (spingi il bersaglio di 4,5 m e ti muovi fino a metà velocità verso di lui senza attacchi di opportunità) o Colpo spaccaossa (velocità del bersaglio −4,5 m fino al tuo prossimo turno).", "If you use Reckless Attack you can forgo Advantage on one Strength-based attack: if it hits it deals 1d10 extra damage plus an effect: Forceful Blow (push the target 15 feet and move half your Speed toward it without Opportunity Attacks) or Hamstring Blow (target's Speed −15 feet until your next turn)."]),
    f(11, "relentless_rage", ["Ira implacabile", "Relentless Rage"], ["In ira, se scendi a 0 PF senza morire sul colpo, fai un tiro salvezza su Costituzione (CD 10): se lo superi, i PF diventano il doppio del tuo livello da barbaro. La CD sale di 5 a ogni uso dopo il primo e torna a 10 con un riposo breve o lungo.", "While raging, if you drop to 0 Hit Points without being killed outright, make a Constitution save (DC 10): on a success your Hit Points become twice your Barbarian level. The DC rises by 5 for each use after the first and resets to 10 after a Short or Long Rest."]),
    f(13, "improved_brutal_strike", ["Colpo brutale migliorato", "Improved Brutal Strike"], ["Nuovi effetti per Colpo brutale: Colpo sbalorditivo (il bersaglio ha Svantaggio al prossimo tiro salvezza e niente attacchi di opportunità fino al tuo prossimo turno) e Colpo di scissione (+5 al prossimo tiro per colpire di un'altra creatura contro il bersaglio).", "New Brutal Strike effects: Staggering Blow (target has Disadvantage on its next save and can't make Opportunity Attacks until your next turn) and Sundering Blow (+5 to the next attack roll against the target by another creature)."]),
    f(15, "persistent_rage", ["Ira persistente", "Persistent Rage"], ["Quando tiri l'iniziativa recuperi tutti gli usi dell'ira (una volta per riposo lungo). L'ira dura 10 minuti senza doverla prolungare e finisce solo se sei privo di sensi o indossi un'armatura pesante.", "When you roll Initiative you regain all expended Rage uses (once per Long Rest). Your Rage lasts 10 minutes without extending it and ends early only if you are Unconscious or don Heavy armor."]),
    f(17, "improved_brutal_strike_17", ["Colpo brutale migliorato", "Improved Brutal Strike"], ["I danni extra di Colpo brutale salgono a 2d10 e puoi usare due effetti diversi.", "The extra damage of Brutal Strike rises to 2d10 and you can apply two different effects."]),
    f(18, "indomitable_might", ["Potenza indomabile", "Indomitable Might"], ["Se il totale di una prova o di un tiro salvezza su Forza è inferiore al tuo punteggio di Forza, puoi usare il punteggio al suo posto.", "If your total for a Strength check or save is less than your Strength score, you can use the score instead."]),
    epicBoon("barbarian", B("Dono dell'offensiva irresistibile", "Boon of Irresistible Offense")),
    f(20, "primal_champion", ["Campione primordiale", "Primal Champion"], ["Forza e Costituzione +4 (massimo 25).", "Your Strength and Constitution scores increase by 4, to a maximum of 25."], { effects: [{ op: "abilityScoreIncrease", abilities: ["str", "con"], amount: 4, cap: 25 }] }),
  ],
  subclass: {
    id: "berserker", name: B("Cammino del berserker", "Path of the Berserker"), heading: B("Sottoclasse del barbaro: Cammino del berserker", "Barbarian Subclass: Path of the Berserker"),
    description: B("Incanala l'ira in furia violenta: danni extra, immunità a paura e charme, ritorsioni e presenza intimidatoria.", "Channel Rage into violent fury: extra damage, immunity to fear and charm, retaliation, and an intimidating presence."),
    features: [
      f(3, "frenzy", ["Frenesia", "Frenzy"], ["Se usi Attacco irruento mentre sei in ira, il primo bersaglio che colpisci nel turno con un attacco basato su Forza subisce danni extra: tira tanti d6 quanto il tuo bonus Danni dell'ira.", "If you use Reckless Attack while raging, the first target you hit on your turn with a Strength-based attack takes extra damage: roll a number of d6s equal to your Rage Damage bonus."]),
      f(6, "mindless_rage", ["Ira incontenibile", "Mindless Rage"], ["Non puoi essere affascinato o spaventato mentre sei in ira; se lo sei quando entri in ira, la condizione termina.", "You can't be Charmed or Frightened while raging; if you are when you enter your Rage, the condition ends."]),
      f(10, "retaliation", ["Ritorsione", "Retaliation"], ["Quando subisci danni da una creatura entro 1,5 m, puoi usare la reazione per attaccarla in mischia con un'arma o un colpo senz'armi.", "When you take damage from a creature within 5 feet, you can use your Reaction to make one melee attack against it with a weapon or Unarmed Strike."]),
      f(14, "intimidating_presence", ["Presenza intimidatoria", "Intimidating Presence"], ["Come azione bonus, ogni creatura a tua scelta in un'emanazione di 9 m deve superare un tiro salvezza su Saggezza (CD 8 + Forza + competenza) o è spaventata per 1 minuto (ripete il tiro a fine turno). Una volta per riposo lungo, o spendendo un uso dell'ira.", "As a Bonus Action, each creature of your choice in a 30-foot Emanation must succeed on a Wisdom save (DC 8 + Strength + Proficiency) or be Frightened for 1 minute (repeats the save at the end of its turns). Once per Long Rest, or by expending a Rage use."],
        { usage: { uses: 1, recharge: "long_rest" } }),
    ],
  },
};

// --- Guerriero ---
export const FIGHTER: ClassDef = {
  id: "fighter", name: B("Guerriero", "Fighter"), hitDie: 10, primary: ["str", "dex"], saves: ["str", "con"],
  description: B("Maestro delle armi e delle armature: più attacchi, Recuperare energie e azioni aggiuntive.", "A master of weapons and armor: more attacks, Second Wind, and extra actions."),
  skills: { count: 2, from: ["acrobatics", "animal_handling", "athletics", "history", "insight", "intimidation", "persuasion", "perception", "survival"] },
  armor: ["light", "medium", "heavy", "shield"], weapons: ["simple", "martial"],
  multiclass: { weapons: ["martial"], armor: ["light", "medium", "shield"] },
  multiclassPhrases: { it: ["competenza nelle armi da guerra, nelle armature leggere, medie e negli scudi"], en: ["proficiency with Martial weapons, and training with Light and Medium armor and Shields"] },
  core: { primaryIt: "Forza o Destrezza", primaryEn: "Strength or Dexterity", savesIt: "Forza e Costituzione", savesEn: "Strength and Constitution",
    skillsIt: "Due a scelta tra: Acrobazia, Addestrare animali, Atletica, Intimidire, Intuizione, Percezione, Persuasione, Sopravvivenza o Storia", skillsEn: "Choose 2: Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Persuasion, Perception, or Survival",
    weaponsIt: "Armi semplici e da guerra", weaponsEn: "Simple and Martial weapons", armorIt: "Armature leggere, medie e pesanti; scudi", armorEn: "Light, Medium, and Heavy armor and Shields" },
  equipment: {
    A: { gp: 4, items: [{ item: "chain_mail", it: "una cotta di maglia", en: "Chain Mail" }, { item: "greatsword", it: "uno spadone", en: "Greatsword" }, { item: "flail", it: "un mazzafrusto", en: "Flail" }, { item: "javelin", qty: 8, it: "8 giavellotti", en: "8 Javelins" }, { item: "dungeoneers_pack", it: "una dotazione da avventuriero", en: "Dungeoneer's Pack" }] },
    B: { gp: 11, items: [{ item: "studded_leather_armor", it: "un'armatura di cuoio borchiato", en: "Studded Leather Armor" }, { item: "scimitar", it: "una scimitarra", en: "Scimitar" }, { item: "shortsword", it: "una spada corta", en: "Shortsword" }, { item: "longbow", it: "un arco lungo", en: "Longbow" }, { item: "arrows", it: "20 frecce", en: "20 Arrows" }, { item: "quiver", it: "una faretra", en: "Quiver" }, { item: "dungeoneers_pack", it: "una dotazione da avventuriero", en: "Dungeoneer's Pack" }] },
    C: { gp: 155, items: [] },
  },
  columns: [{ id: "second_wind", name: B("Recuperare energie", "Second Wind") }, { id: "weapon_mastery", name: B("Padronanza d'armi", "Weapon Mastery") }],
  extraRows: [{ level: 13, label: B("Indomabile (due utilizzi)", "Indomitable (two uses)") }, { level: 17, label: B("Azione impetuosa (due utilizzi), Indomabile (tre utilizzi)", "Action Surge (two uses), Indomitable (three uses)") }],
  features: [
    f(1, "fighting_style", ["Stile di combattimento", "Fighting Style"], ["Ottieni un talento Stile di combattimento a tua scelta (consigliato: Difesa). A ogni livello da guerriero puoi sostituirlo con un altro.", "You gain a Fighting Style feat of your choice (Defense is recommended). Whenever you gain a Fighter level you can replace it with another."],
      { choices: [{ id: "fighter_fighting_style", label: B("Stile di combattimento", "Fighting Style"), count: 1, source: "feats:fighting_style" }] }),
    f(1, "second_wind", ["Recuperare energie", "Second Wind"], ["Come azione bonus recuperi 1d10 + livello da guerriero PF. Gli usi sono nella colonna Recuperare energie: ne recuperi 1 con un riposo breve, tutti con uno lungo.", "As a Bonus Action you regain 1d10 + your Fighter level Hit Points. Uses are in the Second Wind column: regain one on a Short Rest, all on a Long Rest."],
      { build: (t) => ({ usage: { uses: { table: t.second_wind }, recharge: "long_rest", partialShortRest: 1 } }) }),
    f(1, "weapon_mastery", ["Padronanza d'armi", "Weapon Mastery"], ["Puoi usare le proprietà di padronanza di 3 tipi di armi semplici o da guerra (altri con i livelli, colonna Padronanza d'armi); a ogni riposo lungo puoi cambiarne uno.", "You can use the mastery properties of 3 kinds of Simple or Martial weapons (more with levels, Weapon Mastery column); after a Long Rest you can change one."],
      { choices: [TWO_FROM_TABLE("fighter", "weapon_mastery")] }),
    f(2, "action_surge", ["Azione impetuosa", "Action Surge"], ["Nel tuo turno puoi fare un'azione aggiuntiva (non quella di Magia). Una volta per riposo breve o lungo; due volte dal 17° livello, ma una sola nello stesso turno.", "On your turn you can take one additional action (except the Magic action). Once per Short or Long Rest; twice from level 17, but only once per turn."],
      { row: B("Azione impetuosa (un utilizzo)", "Action Surge (one use)"), usage: { uses: tableOf([[1, 1], [17, 2]]), recharge: "short_rest" } }),
    f(2, "tactical_mind", ["Mente tattica", "Tactical Mind"], ["Quando fallisci una prova di caratteristica puoi spendere un uso di Recuperare energie: tira 1d10 e sommalo alla prova. Se fallisce comunque, l'uso non viene speso.", "When you fail an ability check you can expend a Second Wind use: roll 1d10 and add it to the check. If you still fail, the use isn't expended."]),
    subclassFeature("fighter", "del guerriero", "Fighter"),
    asi("fighter", 4, false), asi("fighter", 6), asi("fighter", 8), asi("fighter", 12), asi("fighter", 14), asi("fighter", 16),
    f(5, "extra_attack", ["Attacco extra", "Extra Attack"], ["Attacchi due volte con l'azione Attacco.", "You can attack twice when you take the Attack action."]),
    f(5, "tactical_shift", ["Spostamento tattico", "Tactical Shift"], ["Quando attivi Recuperare energie ti muovi fino a metà della velocità senza provocare attacchi di opportunità.", "Whenever you activate Second Wind you can move up to half your Speed without provoking Opportunity Attacks."]),
    f(9, "indomitable", ["Indomabile", "Indomitable"], ["Se fallisci un tiro salvezza puoi ripeterlo con un bonus pari al tuo livello da guerriero; devi usare il nuovo risultato. Una volta per riposo lungo; 2 volte dal 13° livello, 3 dal 17°.", "If you fail a saving throw you can reroll it with a bonus equal to your Fighter level; you must use the new roll. Once per Long Rest; twice from level 13, three times from level 17."],
      { row: B("Indomabile (un utilizzo)", "Indomitable (one use)"), usage: { uses: tableOf([[9, 1], [13, 2], [17, 3]]), recharge: "long_rest" } }),
    f(9, "tactical_master", ["Signore delle tattiche", "Tactical Master"], ["Con un'arma di cui usi la padronanza puoi sostituirne la proprietà con Spinta, Fiaccare o Lentezza.", "When you attack with a weapon whose mastery you can use, you can replace its property with Push, Sap, or Slow."]),
    f(11, "two_extra_attacks", ["Due attacchi extra", "Two Extra Attacks"], ["Attacchi tre volte con l'azione Attacco.", "You can attack three times when you take the Attack action."]),
    f(13, "studied_attacks", ["Attacchi studiati", "Studied Attacks"], ["Se manchi una creatura con un tiro per colpire, hai Vantaggio al tuo prossimo tiro per colpire contro di essa prima della fine del tuo turno successivo.", "If you miss a creature with an attack roll, you have Advantage on your next attack roll against it before the end of your next turn."]),
    epicBoon("fighter", B("Dono delle abilità di combattimento", "Boon of Combat Prowess")),
    f(20, "three_extra_attacks", ["Tre attacchi extra", "Three Extra Attacks"], ["Attacchi quattro volte con l'azione Attacco.", "You can attack four times when you take the Attack action."]),
  ],
  subclass: {
    id: "champion", name: B("Campione", "Champion"), heading: B("Sottoclasse del guerriero: Campione", "Fighter Subclass: Champion"),
    description: B("Eccellenza fisica nel combattimento: critici più frequenti, atletismo e resistenza.", "Physical excellence in combat: more frequent critical hits, athleticism, and resilience."),
    features: [
      f(3, "improved_critical", ["Critico migliorato", "Improved Critical"], ["I tiri per colpire con armi e colpi senz'armi mettono a segno un critico con 19 o 20.", "Weapon and Unarmed Strike attack rolls score a Critical Hit on a 19 or 20."], { effects: [{ op: "critRange", min: 19 }] }),
      f(3, "remarkable_athlete", ["Atleta straordinario", "Remarkable Athlete"], ["Vantaggio all'iniziativa e alle prove di Forza (Atletica). Dopo un colpo critico puoi muoverti fino a metà velocità senza attacchi di opportunità.", "Advantage on Initiative rolls and Strength (Athletics) checks. After you score a Critical Hit you can move up to half your Speed without Opportunity Attacks."]),
      f(7, "additional_fighting_style", ["Stile di combattimento aggiuntivo", "Additional Fighting Style"], ["Scegli un altro talento Stile di combattimento.", "You gain another Fighting Style feat of your choice."],
        { choices: [{ id: "fighter_additional_fighting_style", label: B("Stile di combattimento aggiuntivo", "Additional Fighting Style"), count: 1, source: "feats:fighting_style" }] }),
      f(10, "heroic_warrior", ["Guerriero eroico", "Heroic Warrior"], ["In combattimento, a inizio turno senza Ispirazione eroica puoi ottenerla.", "During combat, you can give yourself Heroic Inspiration whenever you start your turn without it."]),
      f(15, "superior_critical", ["Critico superiore", "Superior Critical"], ["I tiri per colpire con armi e colpi senz'armi mettono a segno un critico con 18-20.", "Weapon and Unarmed Strike attack rolls score a Critical Hit on an 18-20."], { effects: [{ op: "critRange", min: 18 }] }),
      f(18, "survivor", ["Sopravvissuto", "Survivor"], ["Vantaggio ai tiri salvezza contro morte; con 18-20 conta come un 20. A inizio turno, se sei sanguinante e hai almeno 1 PF, recuperi 5 + Costituzione PF.", "Advantage on Death Saving Throws; a 18-20 counts as a 20. At the start of your turn, if you are Bloodied and have at least 1 Hit Point, you regain 5 + your Constitution modifier Hit Points."]),
    ],
  },
};
