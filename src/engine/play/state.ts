import { buildCtx, holds } from "../compute";
import type { Derived } from "../compute";
import { describeCondition } from "../creation/describe";
import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { tr } from "../../i18n/tr";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(n)));
const set = (ch: Character, s: Partial<Character["state"]>): Character => ({ ...ch, state: { ...ch.state, ...s } });

// Condizioni (l'Esaurimento ha i livelli 0-6 e si imposta a parte). Quelle che richiedono una fonte (Affascinato, Spaventato,
// Afferrato) ricordano chi le causa.
export function setCondition(ch: Character, rs: Ruleset, id: string, on: boolean, source?: string): Character {
  const def = rs.conditions.get(id);
  if (!def || def.stackable) return ch;
  const has = ch.state.conditions.includes(id);
  const src = { ...(ch.state.conditionSources ?? {}) };
  if (on) { if (def.requiresSource && source) src[id] = source; return set(ch, { conditions: has ? ch.state.conditions : [...ch.state.conditions, id], conditionSources: src }); }
  delete src[id];
  return set(ch, { conditions: ch.state.conditions.filter((c) => c !== id), conditionSources: src });
}
export const setExhaustion = (ch: Character, level: number): Character => set(ch, { exhaustion: clamp(level, 0, 6) });

// Risorse a usi limitati (Recuperare energie, Ira...)
export function useResource(ch: Character, id: string, max: number, delta: number): Character {
  const used = clamp((ch.state.resourcesUsed[id] ?? 0) + delta, 0, max);
  const r = { ...ch.state.resourcesUsed };
  if (used === 0) delete r[id]; else r[id] = used;
  return set(ch, { resourcesUsed: r });
}
export function toggleSlot(ch: Character, level: number, total: number, delta: number): Character {
  const used = clamp((ch.state.slotsUsed[level] ?? 0) + delta, 0, total);
  const s = { ...ch.state.slotsUsed };
  if (used === 0) delete s[level]; else s[level] = used;
  return set(ch, { slotsUsed: s });
}

export const setInspiration = (ch: Character, on: boolean): Character => set(ch, { inspiration: on });
export const setCoins = (ch: Character, coins: Partial<Character["coins"]>): Character => ({
  ...ch, coins: Object.fromEntries(Object.entries({ ...ch.coins, ...coins }).map(([k, v]) => [k, Math.max(0, Math.floor(v))])) as Character["coins"],
});

// Valori forzati a mano: solo questi numeri si possono sovrascrivere; togliendo il valore si torna al calcolato
export const OVERRIDE_KEYS = ["ac", "hp.max", "initiative", "speed.walk", "passivePerception"] as const;
export type OverrideKey = (typeof OVERRIDE_KEYS)[number];
export function setOverride(ch: Character, key: OverrideKey, value: number | undefined): Character {
  const o = { ...ch.overrides };
  if (value === undefined || !Number.isFinite(value)) delete o[key]; else o[key] = Math.round(value);
  return { ...ch, overrides: o };
}

// Attivare e disattivare un privilegio (Ira, Forma selvatica...). Attivare consuma un uso della risorsa indicata dal privilegio
// e, se c'è una scelta (aspetto, elemento...), ne richiede una e la salva. Disattivare non restituisce l'uso.
export function setActive(ch: Character, rs: Ruleset, d: Pick<Derived, "featureList" | "resources">, id: string, on: boolean, picks: string[] = []): { ok: boolean; errors: string[]; character: Character } {
  const fail = (e: string) => ({ ok: false, errors: [e], character: ch });
  const f = d.featureList.find((x) => x.id === id);
  if (!f?.activation) return fail(tr("Questo privilegio non si attiva", "This feature cannot be activated"));
  const state = { ...(ch.state.active ?? {}) };
  if (!on) { delete state[id]; return { ok: true, errors: [], character: set(ch, { active: state }) }; }
  if (state[id]) return fail(tr("È già attivo", "Already active"));
  const a = f.activation;
  if (a.requires && !holds(a.requires, buildCtx(ch, rs))) return fail(tr(`Non puoi attivarlo ora: serve ${describeCondition(a.requires, rs)}`, `You cannot activate it now: requires ${describeCondition(a.requires, rs)}`));
  if (a.options.length) {
    if (picks.length !== 1 || !a.options.some((o) => o.id === picks[0])) return fail(tr(`Scegli ${a.label ? a.label.toLowerCase() : "un\u2019opzione"}`, `Choose ${a.label ? a.label.toLowerCase() : "an option"}`));
  }
  let next = ch;
  if (a.resource) {
    const r = d.resources[a.resource];
    if (!r || r.remaining <= 0) return fail(tr("Nessun uso rimasto", "No uses left"));
    next = useResource(ch, a.resource, r.max.value, 1);
  }
  return { ok: true, errors: [], character: set(next, { active: { ...(next.state.active ?? {}), [id]: a.options.length ? picks : [] } }) };
}
