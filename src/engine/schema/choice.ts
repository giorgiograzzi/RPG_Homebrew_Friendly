import { z } from "zod";
import { condition, effectSchema } from "./effect";
import { ability, id, text } from "./primitives";
import { isValidFormula } from "./formula";

export const optionSchema = z.object({
  id,
  name: text,
  description: z.string().optional(),
  cost: z.number().optional(), // es. punti stregoneria della Metamagia
  requires: condition.optional(), // opzione visibile ma disattivata (con motivo) se non vale
  effects: z.array(effectSchema).default([]),
});
export type Option = z.infer<typeof optionSchema>;

// Una scelta del giocatore. Le opzioni sono elencate qui oppure prese da un
// insieme dei dati (source), es. "skills", "feats:origin", "spells:cleric:0".
export const choiceSchema = z.object({
  id,
  label: text,
  count: z.number().int().min(1).default(1),
  countFrom: z.string().optional(), // colonna della tabella di classe o sottoclasse che dà il numero di scelte (es. "cantrips")
  countFormula: z.string().refine(isValidFormula, "formula non valida").optional(), // numero di scelte da formula (es. "pb", "4 + 2 * classLevel:wizard")
  // Caratteristica da incantatore degli incantesimi scelti/concessi: fissa oppure da un'altra scelta
  ability: ability.optional(),
  abilityFrom: id.optional(),
  weaponFilter: z.object({ kind: z.enum(["melee", "ranged"]) }).optional(), // scelte di armi (maestria): es. Barbaro solo armi da mischia
  // Restringe gli incantesimi proponibili (usato quando ci sono i dati degli incantesimi)
  filter: z.object({
    level: z.number().int().min(0).max(9).optional(),
    schools: z.array(z.string()).optional(),
    ritual: z.boolean().optional(),
    classes: z.array(z.string()).optional(), // liste di classe ammesse
    classFrom: id.optional(), // lista di classe presa da un'altra scelta (Iniziato alla magia)
  }).optional(),
  options: z.array(optionSchema).optional(),
  source: z.string().regex(/^[a-zA-Z_]+(:[a-z0-9_]+)*$/).optional(),
  group: id.optional(), // scelte alternative: se una del gruppo ha selezioni, le altre del gruppo si disattivano (es. Stile di combattimento / Guerriero benedetto)
  distinct: z.boolean().default(true), // niente duplicati (es. abilità già competenti)
  when: condition.optional(),
}).refine((c) => (c.options ? !c.source : !!c.source), "serve options oppure source");
export type Choice = z.infer<typeof choiceSchema>;
