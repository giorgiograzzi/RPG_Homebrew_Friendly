import type { Ruleset } from "../ruleset";
import type { Character } from "../types";
import { allQuestions } from "./questions";
import type { DecisionResult, Question, Removed } from "./types";
import { tr } from "../../i18n/tr";

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
    const second = classes[1];
    if (picked[0]) {
      const total = ch.startLevel ?? classes.reduce((n, c) => n + c.level, 0) ?? 1;
      // la seconda classe (multiclasse alla creazione) resta, a meno che coincida con la nuova prima classe
      const keep = second && second.classId !== picked[0] ? second : undefined;
      return { ...ch, classes: [{ classId: picked[0], level: Math.max(1, total - (keep?.level ?? 0)), hpRolls: [] }, ...(keep ? [keep] : [])] };
    }
    void old;
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
      if (q.disabled) { removed.push({ key: q.key, picked: have, reason: q.disabledReason ?? tr("Scelta alternativa già coperta", "Alternative choice already covered") }); cur = put(cur, q.key, []); changed = true; break; }
      const bad = have.filter((id) => !q.options.find((o) => o.id === id)?.enabled);
      const kept = have.filter((id) => !bad.includes(id)).slice(0, q.count);
      if (bad.length || kept.length < have.length) {
        const why = bad.length
          ? bad.map((id) => { const o = q.options.find((x) => x.id === id); return `${o?.name ?? id}: ${o?.disabledReason ?? tr("non più disponibile", "no longer available")}`; }).join("; ")
          : tr(`Troppe scelte (massimo ${q.count})`, `Too many choices (maximum ${q.count})`);
        removed.push({ key: q.key, picked: have.filter((id) => !kept.includes(id)), reason: why });
        cur = put(cur, q.key, kept); changed = true; break;
      }
    }
    if (changed) continue;
    // 2) decisioni senza più una domanda
    const orphan = Object.keys(cur.decisions).find((k) => !byKey.has(k) && !isSpecial(k));
    if (orphan) { removed.push({ key: orphan, picked: cur.decisions[orphan]!, reason: tr("La scelta non è più disponibile", "The choice is no longer available") }); cur = put(cur, orphan, []); continue; }
    // 3) aumenti di caratteristica senza domanda, o non validi
    const badAsi = cur.asi.find((a) => a.key && !(byKey.get(a.key)?.kind === "abilityIncrease"));
    if (badAsi) {
      removed.push({ key: badAsi.key!, picked: cur.asi.filter((a) => a.key === badAsi.key).map((a) => `${a.ability}+${a.amount}`), reason: tr("L'aumento di caratteristica non è più disponibile", "The ability score increase is no longer available") });
      cur = { ...cur, asi: cur.asi.filter((a) => a.key !== badAsi.key) }; continue;
    }
    const invalidAsi = qs.find((q) => q.kind === "abilityIncrease" && q.selected.length && !q.complete);
    if (invalidAsi) {
      removed.push({ key: invalidAsi.key, picked: invalidAsi.selected, reason: tr("L'aumento di caratteristica non è più valido (fonte o tetto cambiati)", "The ability score increase is no longer valid (source or cap changed)") });
      cur = { ...cur, asi: cur.asi.filter((a) => a.key !== invalidAsi.key) }; continue;
    }
    // 4) sottoclasse scelta ma sotto il livello in cui si ottiene (il livello è sceso)
    const badSub = cur.classes.find((cl) => cl.subclassId && cl.level < (rs.classes.get(cl.classId)?.subclassLevel ?? 0));
    if (badSub) {
      removed.push({ key: `subclass:${badSub.classId}`, picked: [badSub.subclassId!], reason: tr("La sottoclasse si ottiene a un livello più alto", "The subclass comes at a higher level") });
      cur = { ...cur, classes: cur.classes.map((c) => { if (c !== badSub) return c; const { subclassId: _drop, ...rest } = c; void _drop; return rest; }) }; continue;
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
  if (!q) return fail(ch, tr(`Scelta non disponibile: ${key}`, `Choice not available: ${key}`));
  if (q.kind !== "choice") return fail(ch, tr("Gli aumenti di caratteristica si impostano con setAsi", "Ability score increases are set with setAsi"));
  if (q.disabled) return fail(ch, q.disabledReason ?? tr("Scelta alternativa già coperta", "Alternative choice already covered"));
  if (picked.length > q.count) return fail(ch, tr(`Puoi scegliere al massimo ${q.count} opzioni`, `You can choose at most ${q.count} options`));
  if (new Set(picked).size !== picked.length) return fail(ch, "Opzioni ripetute");
  const errors = picked.flatMap((id) => {
    const o = q.options.find((x) => x.id === id);
    return !o ? [tr(`Opzione sconosciuta: ${id}`, `Unknown option: ${id}`)] : o.enabled ? [] : [`${o.name}: ${o.disabledReason ?? tr("non disponibile", "not available")}`];
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
