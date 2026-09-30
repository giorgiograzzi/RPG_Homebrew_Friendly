import type { Choice } from "../schema";
import type { Ability } from "../schema";

// Passo 0 (Livello) + i 7 passi in ordine ufficiale (file 02): Classe, Origine (background, specie, linguaggi), Punteggi, Allineamento, Dettagli
export const STEPS = ["level", "class", "background", "species", "languages", "scores", "alignment", "details"] as const;
export type StepId = (typeof STEPS)[number];

export interface OptionState {
  id: string; name: string; description?: string;
  enabled: boolean; disabledReason?: string; selected: boolean;
  cost?: number;
}

// Una domanda di creazione: una scelta del giocatore (o un aumento di caratteristica) con le sue opzioni
export interface Question {
  key: string; // chiave in Character.decisions (o speciale: pick:class, pick:species, pick:background, subclass:<classe>)
  step: StepId;
  owner: string; // chi la pone: "Guerriero", "Elfo", "Iniziato alla magia"
  label: string;
  kind: "choice" | "abilityIncrease";
  count: number; // quante opzioni scegliere
  selected: string[];
  complete: boolean;
  options: OptionState[];
  disabled?: boolean; disabledReason?: string; // scelta alternativa già coperta (gruppo)
  group?: string;
  choice?: Choice;
  classId?: string;
  asi?: { allowed: Ability[]; mode: "background" | "asi" | "plus1"; cap: number }; // per kind "abilityIncrease": selected = "str+2", "dex+1"...
}

export interface Removed { key: string; picked: string[]; reason: string }
export interface DecisionResult {
  ok: boolean;
  errors: string[]; // la scelta non è valida: il personaggio non cambia
  character: Character;
  removed: Removed[]; // scelte annullate a cascata (da confermare: se l'utente annulla si tiene il personaggio di partenza)
}
import type { Character } from "../types";
