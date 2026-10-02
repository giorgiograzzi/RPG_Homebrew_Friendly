// Le 15 condizioni dell'SRD 5.2.1: gli effetti sono scritti con il vocabolario del motore (CONDITION_EFFECT_TYPES),
// il testo (descrizione) si legge dal glossario di entrambi i PDF tra il titolo e `end` (il titolo della voce successiva).
type Fx = Record<string, unknown>;
export interface ConditionDef {
  id: string;
  name: { en: string; it: string };
  end: { en: string; it: string };
  // frasi che devono comparire nel testo di ciascuna lingua (controllo dei valori che il motore usa)
  check: { en: string[]; it: string[] };
  stackable?: boolean;
  requiresSource?: boolean;
  grants?: string[];
  levels?: { min: number; max: number; deathAt: number };
  removal?: { on: string; levelsRemoved: number; endsAtLevel: number };
  escape?: { action: boolean; check: { ability: string; skill: string }[]; vs: string };
  endConditions?: string[];
  effects: Fx[];
}

const STR_DEX = ["str", "dex"];
const ADV = { type: "attack_rolls_against_self", mode: "advantage" };
const OWN_DIS = { type: "own_attack_rolls", mode: "disadvantage" };

export const CONDITIONS: ConditionDef[] = [
  { id: "blinded", name: { en: "Blinded", it: "Accecato" }, end: { en: "Blindsight", it: "Affascinato [condizione]" },
    check: { en: ["automatically fail any ability check that requires sight", "Attack rolls against you have Advantage, and your attack rolls have Disadvantage"], it: ["fallisce automaticamente qualsiasi prova di caratteristica che richieda l'uso della vista", "dispongono di vantaggio, mentre i suoi tiri per colpire subiscono svantaggio"] },
    effects: [{ type: "cant_see" }, { type: "auto_fail_ability_check", requires: "sight" }, ADV, OWN_DIS] },
  { id: "charmed", name: { en: "Charmed", it: "Affascinato" }, end: { en: "Climbing", it: "Afferrare" }, requiresSource: true,
    check: { en: ["can’t attack the charmer", "The charmer has Advantage on any ability check to interact with you socially"], it: ["non può attaccare chi lo ha affascinato", "dispone di vantaggio a qualsiasi prova di caratteristica effettuata per interagire socialmente"] },
    effects: [{ type: "cant_harm_source" }, { type: "social_advantage_for_source" }] },
  { id: "deafened", name: { en: "Deafened", it: "Assordato" }, end: { en: "Death Saving Throw", it: "Attacchi di opportunità" },
    check: { en: ["automatically fail any ability check that requires hearing"], it: ["fallisce automaticamente qualsiasi prova di caratteristica che richieda l'uso dell'udito"] },
    effects: [{ type: "cant_hear" }, { type: "auto_fail_ability_check", requires: "hearing" }] },
  { id: "exhaustion", name: { en: "Exhaustion", it: "Indebolimento" }, end: { en: "Experience Points", it: "Indifferente [atteggiamento]" },
    stackable: true, levels: { min: 1, max: 6, deathAt: 6 }, removal: { on: "long_rest", levelsRemoved: 1, endsAtLevel: 0 },
    check: { en: ["You die if your Exhaustion level is 6", "reduced by 2 times your Exhaustion level", "5 times your Exhaustion level", "Finishing a Long Rest removes 1 of your Exhaustion levels"], it: ["muore se il suo livello di indebolimento è pari a 6", "ridotto del doppio del livello di indebolimento", "1,5 × il suo livello di indebolimento", "Terminando un riposo lungo, il personaggio perde 1 livello di indebolimento"] },
    effects: [{ type: "death_at_level", level: 6 }, { type: "d20_test_modifier", formula: "-2 * exhaustion_level" }, { type: "speed_modifier", formula: "-5 * exhaustion_level" }] },
  { id: "frightened", name: { en: "Frightened", it: "Spaventato" }, end: { en: "Grappled [Condition]", it: "Spazio libero" }, requiresSource: true,
    check: { en: ["Disadvantage on ability checks and attack rolls while the source of fear is within line of sight", "can’t willingly move closer"], it: ["svantaggio alle prove di caratteristica e ai tiri per colpire finché la fonte della sua paura è nel suo campo visivo", "non è in grado di avvicinarsi volontariamente"] },
    effects: [{ ...OWN_DIS, when: "source_in_line_of_sight" }, { type: "own_ability_checks", mode: "disadvantage", when: "source_in_line_of_sight" }, { type: "cant_move_closer_to_source" }] },
  { id: "grappled", name: { en: "Grappled", it: "Afferrato" }, end: { en: "Grappling", it: "Aiuto [azione]" }, requiresSource: true,
    escape: { action: true, check: [{ ability: "str", skill: "athletics" }, { ability: "dex", skill: "acrobatics" }], vs: "escape_dc" },
    endConditions: ["grappler_incapacitated", "out_of_range", "released_by_grappler"],
    check: { en: ["Your Speed is 0 and can’t increase", "Disadvantage on attack rolls against any target other than the grappler"], it: ["pari a 0 e non può aumentare", "svantaggio ai tiri per colpire contro qualsiasi bersaglio che non sia chi lo ha afferrato"] },
    effects: [{ type: "speed_zero" }, { ...OWN_DIS, when: "target_is_not_grappler" }, { type: "movable_by_source" }] },
  { id: "incapacitated", name: { en: "Incapacitated", it: "Incapacitato" }, end: { en: "Indifferent", it: "Incontro" },
    check: { en: ["can’t take any action, Bonus Action, or Reaction", "Your Concentration is broken", "You can’t speak", "Disadvantage on the roll"], it: ["non è in grado di effettuare azioni, azioni bonus o reazioni", "La concentrazione del personaggio è interrotta", "non è in grado di parlare", "subisce svantaggio al tiro"] },
    effects: [{ type: "no_actions", blocks: ["action", "bonus_action", "reaction"] }, { type: "break_concentration" }, { type: "cant_speak" }, { type: "initiative_mode", mode: "disadvantage", when: "incapacitated_when_rolling_initiative" }] },
  { id: "invisible", name: { en: "Invisible", it: "Invisibile" }, end: { en: "Jumping", it: "Ispirazione eroica" },
    check: { en: ["have Advantage on the roll", "Attack rolls against you have Disadvantage, and your attack rolls have Advantage"], it: ["dispone di vantaggio al tiro", "subiscono svantaggio, mentre i suoi tiri per colpire dispongono di vantaggio"] },
    effects: [{ type: "initiative_mode", mode: "advantage", when: "invisible_when_rolling_initiative" }, { type: "concealed" },
      { type: "attack_rolls_against_self", mode: "disadvantage", unless: "attacker_can_see_you" }, { type: "own_attack_rolls", mode: "advantage", unless: "target_can_see_you" }] },
  { id: "paralyzed", name: { en: "Paralyzed", it: "Paralizzato" }, end: { en: "Passive Perception", it: "Percezione passiva" }, grants: ["incapacitated"],
    check: { en: ["automatically fail Strength and Dexterity saving throws", "Critical Hit if the attacker is within 5 feet"], it: ["fallisce automaticamente i tiri salvezza su Forza e Destrezza", "colpo critico se l'attaccante si trova entro 1,5 metri"] },
    effects: [{ type: "speed_zero" }, { type: "auto_fail_saving_throw", abilities: STR_DEX }, ADV, { type: "auto_critical_hit_against_self", attackerWithinFt: 5 }] },
  { id: "petrified", name: { en: "Petrified", it: "Pietrificato" }, end: { en: "Player Character", it: "Portata" }, grants: ["incapacitated"],
    check: { en: ["Resistance to all damage", "Immunity to the Poisoned condition", "weight increases by a factor of ten"], it: ["resistente a tutti i danni", "immune alla condizione \"avvelenato\"", "il suo peso viene decuplicato"] },
    effects: [{ type: "transformed_to_inanimate" }, { type: "speed_zero" }, ADV, { type: "auto_fail_saving_throw", abilities: STR_DEX },
      { type: "damage_resistance", damageTypes: "all" }, { type: "condition_immunity", conditions: ["poisoned"] }] },
  { id: "poisoned", name: { en: "Poisoned", it: "Avvelenato" }, end: { en: "Possession", it: "Avventura" },
    check: { en: ["Disadvantage on attack rolls and ability checks"], it: ["svantaggio ai tiri per colpire e alle prove di caratteristica"] },
    effects: [OWN_DIS, { type: "own_ability_checks", mode: "disadvantage" }] },
  { id: "prone", name: { en: "Prone", it: "Prono" }, end: { en: "Reach", it: "Prova con D20" },
    check: { en: ["half your Speed (round down)", "Advantage if the attacker is within 5 feet of you", "Otherwise, that attack roll has Disadvantage"], it: ["metà della sua velocità (arrotondata per difetto)", "vantaggio se l'attaccante si trova entro 1,5 metri dal personaggio", "Altrimenti, il tiro per colpire subisce svantaggio"] },
    effects: [{ type: "movement_restriction" }, OWN_DIS, { type: "attack_rolls_against_self", mode: "advantage", when: "attacker_within_5ft" }, { type: "attack_rolls_against_self", mode: "disadvantage", when: "attacker_farther_than_5ft" }] },
  { id: "restrained", name: { en: "Restrained", it: "Trattenuto" }, end: { en: "Ritual", it: "Trucchetto" },
    check: { en: ["Disadvantage on Dexterity saving throws", "your attack rolls have Disadvantage"], it: ["svantaggio ai tiri salvezza su Destrezza", "i suoi tiri per colpire subiscono svantaggio"] },
    effects: [{ type: "speed_zero" }, ADV, OWN_DIS, { type: "saving_throw_mode", abilities: ["dex"], mode: "disadvantage" }] },
  { id: "stunned", name: { en: "Stunned", it: "Stordito" }, end: { en: "Suffocation", it: "Strisciare" }, grants: ["incapacitated"],
    check: { en: ["automatically fail Strength and Dexterity saving throws", "Attack rolls against you have Advantage"], it: ["fallisce automaticamente i tiri salvezza su Forza e Destrezza", "dispongono di vantaggio"] },
    effects: [{ type: "auto_fail_saving_throw", abilities: STR_DEX }, ADV] },
  { id: "unconscious", name: { en: "Unconscious", it: "Privo di sensi" }, end: { en: "Unoccupied Space", it: "Prono [condizione]" }, grants: ["incapacitated", "prone"],
    check: { en: ["You have the Incapacitated and Prone conditions, and you drop whatever you’re holding", "you remain Prone", "within 5 feet of you", "unaware of your surroundings"], it: ["ha le condizioni \"incapacitato\" e \"prono\"", "il personaggio resta prono", "entro 1,5 metri dal personaggio", "non è consapevole di ciò che lo circonda"] },
    effects: [{ type: "drop_held_items" }, { type: "remains_prone_after_end" }, { type: "speed_zero" }, ADV, { type: "auto_fail_saving_throw", abilities: STR_DEX },
      { type: "auto_critical_hit_against_self", attackerWithinFt: 5 }, { type: "unaware_of_surroundings" }] },
];
