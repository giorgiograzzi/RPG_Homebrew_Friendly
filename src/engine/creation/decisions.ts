import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { allQuestions } from "./questions";
import type { DecisionResult, Question, Removed } from "./types";

const put = (c: Character, key: string, picked: string[]): Character => {
  const d = { ...c.decisions };
  if (picked.length) d[key] = picked; else delete d[key];
  return { ...c, decisions: d };
};

// Applica una scelta al personaggio. Le scelte "speciali" toccano i campi del personaggio (classe, sottoclasse, background, specie).
function setKey(ch: Character, key: string, picked: string[]): Character {
  if (key === "pick:class") {
    const old = ch.classes[0];
    const classes = ch.classes.slice();
    if (picked[0]) classes[0] = { classId: picked[0], level: ch.startLevel ?? old?.level ?? 1, hpRolls: [] };
    return { ...ch, classes };
  }
  if (key === "pick:background") return { ...ch, backgroundId: picked[0] ?? "" };
  if (key === "pick:species") return { ...ch, speciesId: picked[0] ?? "" };
  if (key.startsWith("subclass:")) {
    const cid = key.slice("subclass:".length);
    return { ...ch, classes: ch.classes.map((c) => { if (c.classId !== cid) return c; const { subclassId: _drop, ...rest } = c; void _drop; return picked[0] ? { ...rest, subclassId: picked[0] } : rest; }) };
  }
  return put(ch, key, picked);
}

const isSpecial = (key: string) => key.startsWith("pick:") || key.startsWith("subclass:");

// Rimuove dal personaggio tutto ciò che non è più valido dopo una modifica (una scelta di una classe che non c'è più, un'opzione
// ora bloccata, troppe scelte, un aumento di caratteristica oltre il tetto...), in ordine di passo: se due scelte sono in conflitto
// resta la prima. Restituisce il personaggio ripulito e l'elenco di ciò che è stato annullato, con il motivo.
export function validateDecisions(ch: Character, rs: Ruleset): { character: Character; removed: Removed[] } {
  let cur = ch;
  const removed: Removed[] = [];
  for (let guard = 0; guard < 50; guard++) {
    const qs = allQuestions(cur, rs);
    const byKey = new Map(qs.map((q) => [q.key, q]));
    let changed = false;
    // 1) decisioni in ordine di domanda
    for (const q of qs) {
      if (q.kind !== "choice" || isSpecial(q.key)) continue;
      const have = cur.decisions[q.key];
      if (!have?.length) continue;
      if (q.disabled) { removed.push({ key: q.key, picked: have, reason: q.disabledReason ?? "Scelta alternativa già coperta" }); cur = put(cur, q.key, []); changed = true; break; }
      const bad = have.filter((id) => !q.options.find((o) => o.id === id)?.enabled);
      const kept = have.filter((id) => !bad.includes(id)).slice(0, q.count);
      if (bad.length || kept.length < have.length) {
        const why = bad.length
          ? bad.map((id) => { const o = q.options.find((x) => x.id === id); return `${o?.name ?? id}: ${o?.disabledReason ?? "non più disponibile"}`; }).join("; ")
          : `Troppe scelte (massimo ${q.count})`;
        removed.push({ key: q.key, picked: have.filter((id) => !kept.includes(id)), reason: why });
        cur = put(cur, q.key, kept); changed = true; break;
      }
    }
    if (changed) continue;
    // 2) decisioni senza più una domanda
    const orphan = Object.keys(cur.decisions).find((k) => !byKey.has(k) && !isSpecial(k));
    if (orphan) { removed.push({ key: orphan, picked: cur.decisions[orphan]!, reason: "La scelta non è più disponibile" }); cur = put(cur, orphan, []); continue; }
    // 3) aumenti di caratteristica senza domanda, o non validi
    const badAsi = cur.asi.find((a) => a.key && !(byKey.get(a.key)?.kind === "abilityIncrease"));
    if (badAsi) {
      removed.push({ key: badAsi.key!, picked: cur.asi.filter((a) => a.key === badAsi.key).map((a) => `${a.ability}+${a.amount}`), reason: "L'aumento di caratteristica non è più disponibile" });
      cur = { ...cur, asi: cur.asi.filter((a) => a.key !== badAsi.key) }; continue;
    }
    const invalidAsi = qs.find((q) => q.kind === "abilityIncrease" && q.selected.length && !q.complete);
    if (invalidAsi) {
      removed.push({ key: invalidAsi.key, picked: invalidAsi.selected, reason: "L'aumento di caratteristica non è più valido (fonte o tetto cambiati)" });
      cur = { ...cur, asi: cur.asi.filter((a) => a.key !== invalidAsi.key) }; continue;
    }
    break;
  }
  return { character: cur, removed };
}

const fail = (ch: Character, ...errors: string[]): DecisionResult => ({ ok: false, errors, character: ch, removed: [] });

// Anteprima di una scelta: se non è valida dice perché e il personaggio non cambia; se è valida restituisce il personaggio
// nuovo ripulito e ciò che verrebbe annullato a cascata. L'interfaccia mostra l'avviso e, se l'utente annulla, tiene il personaggio di partenza.
export function previewDecision(ch: Character, rs: Ruleset, key: string, picked: string[]): DecisionResult {
  const q = allQuestions(ch, rs).find((x) => x.key === key);
  if (!q) return fail(ch, `Scelta non disponibile: ${key}`);
  if (q.kind !== "choice") return fail(ch, "Gli aumenti di caratteristica si impostano con setAsi");
  if (q.disabled) return fail(ch, q.disabledReason ?? "Scelta alternativa già coperta");
  if (picked.length > q.count) return fail(ch, `Puoi scegliere al massimo ${q.count} opzioni`);
  if (new Set(picked).size !== picked.length) return fail(ch, "Opzioni ripetute");
  const errors = picked.flatMap((id) => {
    const o = q.options.find((x) => x.id === id);
    return !o ? [`Opzione sconosciuta: ${id}`] : o.enabled ? [] : [`${o.name}: ${o.disabledReason ?? "non disponibile"}`];
  });
  if (errors.length) return fail(ch, ...errors);
  let next = setKey(ch, key, picked);
  const extra: Removed[] = [];
  // cambiando classe o background l'opzione di equipaggiamento (A/B/C) scelta per il vecchio non ha più senso
  const eq = key === "pick:class" ? "equipment:class" : key === "pick:background" ? "equipment:background" : undefined;
  const before = key === "pick:class" ? ch.classes[0]?.classId : key === "pick:background" ? ch.backgroundId : undefined;
  if (eq && before && before !== picked[0] && next.decisions[eq]) {
    extra.push({ key: eq, picked: next.decisions[eq]!, reason: "L'equipaggiamento iniziale dipende dalla scelta precedente" });
    next = put(next, eq, []);
  }
  const v = validateDecisions(next, rs);
  // ciò che l'utente ha appena scelto non conta come "annullato"
  return { ok: true, errors: [], character: v.character, removed: [...extra, ...v.removed.filter((r) => r.key !== key)] };
}

// Come previewDecision (il chiamante decide se accettare l'anteprima): alias per chiarezza d'uso
export const applyDecision = previewDecision;

export type { Question };
