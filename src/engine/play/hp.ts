import type { Derived } from "../compute/types";
import type { Character } from "../types";

// Punti Ferita in gioco (regole 2024): PF temporanei assorbono per primi; a 0 PF si è privi di sensi e si tirano le
// salvezze contro morte; danno pari o superiore ai PF massimi oltre lo zero = morte istantanea.
const ZERO_SRC = "0 PF";
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
type Saves = Character["state"]["deathSaves"];

export const isDying = (ch: Character): boolean => ch.state.hp <= 0 && ch.state.deathSaves.failures < 3 && ch.state.deathSaves.successes < 3;
export const isStable = (ch: Character): boolean => ch.state.hp <= 0 && ch.state.deathSaves.successes >= 3 && ch.state.deathSaves.failures < 3;
export const isDead = (ch: Character, d?: Pick<Derived, "conditions">): boolean => ch.state.deathSaves.failures >= 3 || ch.state.exhaustion >= 6 || d?.conditions.dead === true;

function withState(ch: Character, s: Partial<Character["state"]>): Character { return { ...ch, state: { ...ch.state, ...s } }; }

// A 0 PF si cade privi di sensi (tolto quando si torna sopra 0)
function setDown(ch: Character, down: boolean): Character {
  const has = ch.state.conditions.includes("unconscious");
  const src = { ...(ch.state.conditionSources ?? {}) };
  if (down && !has) { src.unconscious = ZERO_SRC; return withState(ch, { conditions: [...ch.state.conditions, "unconscious"], conditionSources: src }); }
  if (!down && has && src.unconscious === ZERO_SRC) {
    delete src.unconscious;
    return withState(ch, { conditions: ch.state.conditions.filter((c) => c !== "unconscious"), conditionSources: src });
  }
  return ch;
}

export interface DamageResult { character: Character; absorbed: number; lost: number; downed: boolean; dead: boolean; note?: string }

export function applyDamage(ch: Character, maxHp: number, amount: number, opts: { crit?: boolean } = {}): DamageResult {
  const dmg = Math.max(0, Math.floor(amount));
  if (dmg === 0) return { character: ch, absorbed: 0, lost: 0, downed: false, dead: isDead(ch) };
  const absorbed = Math.min(ch.state.tempHp, dmg);
  const left = dmg - absorbed;
  let s: Character = withState(ch, { tempHp: ch.state.tempHp - absorbed });
  // già a 0 PF: ogni colpo è una salvezza contro morte fallita (2 se critico); danno ≥ PF massimi = morte
  if (ch.state.hp <= 0) {
    if (left === 0) return { character: s, absorbed, lost: 0, downed: false, dead: false };
    const dead = left >= maxHp;
    const failures = dead ? 3 : Math.min(3, ch.state.deathSaves.failures + (opts.crit ? 2 : 1));
    s = withState(s, { deathSaves: { ...ch.state.deathSaves, failures } });
    return { character: s, absorbed, lost: 0, downed: false, dead: failures >= 3, note: dead ? "Morte istantanea (danno pari ai PF massimi)" : undefined };
  }
  const hp = Math.max(0, ch.state.hp - left);
  const over = left - ch.state.hp; // danno rimasto dopo lo zero
  s = withState(s, { hp });
  if (hp === 0) {
    if (over >= maxHp) return { character: withState(s, { deathSaves: { successes: 0, failures: 3 } }), absorbed, lost: ch.state.hp, downed: true, dead: true, note: "Morte istantanea (danno pari ai PF massimi)" };
    return { character: setDown(withState(s, { deathSaves: { successes: 0, failures: 0 } }), true), absorbed, lost: ch.state.hp, downed: true, dead: false };
  }
  return { character: s, absorbed, lost: left, downed: false, dead: false };
}

export function applyHealing(ch: Character, maxHp: number, amount: number): Character {
  const heal = Math.max(0, Math.floor(amount));
  if (!heal || ch.state.deathSaves.failures >= 3) return ch;
  const hp = clamp(ch.state.hp + heal, 0, maxHp);
  const revived = ch.state.hp <= 0 && hp > 0;
  const s = withState(ch, { hp, ...(revived ? { deathSaves: { successes: 0, failures: 0 } } : {}) });
  return hp > 0 ? setDown(s, false) : s;
}

// I PF temporanei non si sommano: si tiene il valore più alto
export function setTempHp(ch: Character, amount: number, replace = false): Character {
  const v = Math.max(0, Math.floor(amount));
  return withState(ch, { tempHp: replace ? v : Math.max(ch.state.tempHp, v) });
}

export interface DeathSaveResult { character: Character; outcome: "success" | "failure" | "critical_success" | "critical_failure"; stable: boolean; dead: boolean }
// Salvezza contro morte con il d20 naturale: 20 = torni a 1 PF; 1 = due fallimenti; 10+ successo; sotto 10 fallimento.
export function deathSave(ch: Character, natural: number): DeathSaveResult {
  if (ch.state.hp > 0) return { character: ch, outcome: "success", stable: false, dead: false };
  if (natural >= 20) return { character: applyHealing({ ...ch, state: { ...ch.state, deathSaves: { successes: 0, failures: 0 } } }, 9999, 1), outcome: "critical_success", stable: false, dead: false };
  const s: Saves = { ...ch.state.deathSaves };
  let outcome: DeathSaveResult["outcome"];
  if (natural === 1) { s.failures = Math.min(3, s.failures + 2); outcome = "critical_failure"; }
  else if (natural >= 10) { s.successes = Math.min(3, s.successes + 1); outcome = "success"; }
  else { s.failures = Math.min(3, s.failures + 1); outcome = "failure"; }
  return { character: withState(ch, { deathSaves: s }), outcome, stable: s.successes >= 3 && s.failures < 3, dead: s.failures >= 3 };
}
// Aggiustamento manuale dei segni (per correggere un errore)
export const setDeathSaves = (ch: Character, successes: number, failures: number): Character =>
  withState(ch, { deathSaves: { successes: clamp(successes, 0, 3), failures: clamp(failures, 0, 3) } });
// Un alleato stabilizza (Medicina) o si cura: successi azzerati, resta a 0 PF ma stabile
export const stabilize = (ch: Character): Character => (ch.state.hp <= 0 ? withState(ch, { deathSaves: { successes: 3, failures: 0 } }) : ch);
