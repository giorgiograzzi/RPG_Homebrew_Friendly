import type { Derived } from "../engine/compute";
import type { Ruleset } from "../engine/ruleset";
import type { Character } from "../engine/types";

export interface TabProps { ch: Character; rs: Ruleset; d: Derived; update: (fn: (c: Character) => Character) => void }
