// Elenco delle classi con i dati completi (si allarga ad ogni blocco dello step 2d)
import { BARBARIAN, FIGHTER } from "./classes-barbarian-fighter";
import { BARD, CLERIC } from "./classes-bard-cleric";
import { MONK, ROGUE } from "./classes-monk-rogue";
import { PALADIN, RANGER } from "./classes-paladin-ranger";
import type { ClassDef } from "./class-types";

export const CLASSES: ClassDef[] = [BARBARIAN, BARD, CLERIC, FIGHTER, MONK, PALADIN, RANGER, ROGUE];
