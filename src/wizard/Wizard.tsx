import { useMemo, useState } from "react";
import { allQuestions, creationProgress, type DecisionResult, type Question } from "../engine/creation";
import type { Ruleset } from "../engine/ruleset";
import type { Ability } from "../engine/schema";
import type { Character } from "../engine/types";
import { STEPS, setStartLevel, type StepId } from "../engine/creation";
import { HpField, LevelStep } from "./LevelStep";
import it from "../i18n/it.json";
import { fmt } from "../ui/format";
import { Button, Dialog, Field } from "../ui/xp";
import { AsiView, QuestionView } from "./QuestionView";
import { ScoresStep } from "./ScoresStep";
import { HomebrewStep } from "./HomebrewStep";
import { Summary } from "./Summary";
import { applyAsiDraft, choose, finalizeCharacter, gamingSetsNeeded } from "./logic";

const t = it.wizard;
type View = StepId | "homebrew" | "summary";
const VIEWS: View[] = [...STEPS, "homebrew", "summary"];

export function Wizard({ ch, rs, allowReroll, onChange, onDone }: {
  ch: Character; rs: Ruleset; allowReroll: boolean; onChange: (c: Character) => void; onDone: (c: Character) => void;
}) {
  const progress = useMemo(() => creationProgress(ch, rs), [ch, rs]);
  const questions = useMemo(() => allQuestions(ch, rs), [ch, rs]);
  const [view, setView] = useState<View>(!ch.classes.length ? "level" : progress.next ?? "summary");
  const [errors, setErrors] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<DecisionResult | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<Ability, number>>>>({});
  const [gaming, setGaming] = useState("");
  const idx = VIEWS.indexOf(view);
  const go = (v: View) => { setErrors([]); setView(v); };

  const pick = (key: string, picked: string[]) => {
    const r = choose(ch, rs, key, picked);
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors([]);
    if (r.removed.length) setConfirm(r); else onChange(r.character);
  };
  const removedText = (r: DecisionResult) => r.removed.map((x) => {
    const q = questions.find((y) => y.key === x.key);
    return `${q?.label ?? x.key}: ${x.picked.map((id) => q?.options.find((o) => o.id === id)?.name ?? id).join(", ")} — ${x.reason}`;
  });

  const stepQuestions = (s: StepId): Question[] => questions.filter((q) => q.step === s);
  const status = (s: View) => progress.steps.find((x) => x.step === (s as StepId));

  const body = () => {
    if (view === "summary") {
      const fin = finalizeCharacter(ch, rs, gaming ? { gaming_set: gaming } : {});
      const needGaming = progress.complete && gamingSetsNeeded(ch, rs);
      return (
        <>
          <HpField ch={ch} rs={rs} allowReroll={allowReroll} onChange={onChange} />
          <Summary ch={fin.ok ? fin.character : ch} rs={rs} />
          {needGaming && (
            <Field label={t.gamingSet}>
              <select className="xp-select" value={gaming} onChange={(e) => setGaming(e.target.value)}>
                <option value="">{t.chooseOne}</option>
                {[...rs.tools.values()].filter((x) => x.group === "gaming").map((x) => <option key={x.id} value={x.id}>{x.name.it}</option>)}
              </select>
            </Field>
          )}
          {!fin.ok && <div className="xp-banner"><strong>{t.sum.errors}:</strong><ul>{fin.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
          <div className="xp-actions footer"><Button variant="primary" disabled={!fin.ok} onClick={() => onDone(fin.character)}>{t.finish}</Button></div>
        </>
      );
    }
    if (view === "level") return (
      <>
        <LevelStep ch={ch} rs={rs} onChange={onChange} onLevel={(n) => {
          const r = setStartLevel(ch, rs, n);
          if (!r.ok) { setErrors(r.errors); return; }
          setErrors([]);
          if (r.removed.length) setConfirm(r); else onChange(r.character);
        }} />
      </>
    );
    if (view === "homebrew") return <HomebrewStep ch={ch} rs={rs} onChange={onChange} />;
    if (view === "scores") return <ScoresStep ch={ch} rs={rs} allowReroll={allowReroll} onChange={onChange} onError={setErrors} />;
    const qs = stepQuestions(view);
    return (
      <>
        {view === "class" && <p className="xp-muted">{fmt(t.level1, { n: ch.startLevel ?? ch.classes[0]?.level ?? 1 })}</p>}
        {qs.map((q) => q.kind === "abilityIncrease"
          ? <AsiBlock key={q.key} q={q} ch={ch} rs={rs} draft={drafts[q.key] ?? draftOf(q)} onDraft={(d) => setDrafts({ ...drafts, [q.key]: d })}
              onApply={(r) => { if (r.ok) { setErrors([]); onChange(r.character); setDrafts({ ...drafts, [q.key]: {} }); } else setErrors(r.errors); }} />
          : <QuestionView key={q.key} q={q} onPick={pick} />)}
        {view === "details" && (
          <Field label={t.name}>
            <input className="xp-input" value={ch.name} placeholder={t.namePlaceholder} maxLength={60} onChange={(e) => onChange({ ...ch, name: e.target.value })} />
          </Field>
        )}
      </>
    );
  };

  const done = STEPS.filter((s) => status(s)?.complete).length;
  const problems = view !== "summary" && view !== "homebrew" ? status(view)?.problems ?? [] : [];
  return (
    <>
      <div className="wz-steps" role="tablist" aria-label={t.title}>
        {VIEWS.map((v, i) => (
          <button key={v} type="button" role="tab" aria-current={v === view ? "step" : undefined} aria-label={v === "summary" ? t.summary : v === "homebrew" ? it.homebrew.title : `${i}. ${t.steps[v]}`}
            className={v !== "summary" && v !== "homebrew" && status(v)?.complete ? "done" : ""} onClick={() => go(v)}>
            {v === "summary" ? "★" : v === "homebrew" ? "⚗" : status(v)?.complete ? "✓" : i}
          </button>
        ))}
      </div>
      <div className="wz-bar" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={done}><div style={{ width: `${(done / STEPS.length) * 100}%` }} /></div>
      <h2>{view === "summary" ? t.summary : view === "homebrew" ? it.homebrew.title : `${fmt(t.step, { n: idx, t: STEPS.length - 1 })}: ${t.steps[view]}`}</h2>
      {!rs.creation.get("creation") && <div className="xp-error" role="alert">{t.noCreation}</div>}
      {errors.length > 0 && <div className="xp-error" role="alert">{errors.map((e) => <div key={e}>{e}</div>)}</div>}
      {problems.length > 0 && view !== "scores" && <div className="xp-banner">{problems.join(" · ")}</div>}
      {body()}
      <div className="xp-actions footer">
        <Button disabled={idx === 0} onClick={() => go(VIEWS[idx - 1]!)}>← {t.back}</Button>
        {view !== "summary" && <Button variant="primary" onClick={() => go(VIEWS[idx + 1]!)}>{t.next} →</Button>}
      </div>
      {confirm && (
        <Dialog title={t.confirmTitle} onClose={() => setConfirm(null)}>
          <p>{t.confirmText}</p>
          <ul>{removedText(confirm).map((x) => <li key={x}>{x}</li>)}</ul>
          <div className="xp-actions footer">
            <Button onClick={() => setConfirm(null)}>{t.confirmNo}</Button>
            <Button variant="primary" onClick={() => { onChange(confirm.character); setConfirm(null); }}>{t.confirmYes}</Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

// bozza iniziale = aumenti già applicati
export const draftOf = (q: Question): Partial<Record<Ability, number>> =>
  Object.fromEntries(q.selected.map((s) => { const [a, n] = s.split("+"); return [a, Number(n)]; }));

export function AsiBlock({ q, ch, rs, draft, onDraft, onApply }: {
  q: Question; ch: Character; rs: Ruleset; draft: Partial<Record<Ability, number>>; onDraft: (d: Partial<Record<Ability, number>>) => void;
  onApply: (r: ReturnType<typeof applyAsiDraft>) => void;
}) {
  const r = applyAsiDraft(ch, rs, q.key, draft);
  const same = JSON.stringify(Object.fromEntries(Object.entries(draft).filter(([, v]) => v))) === JSON.stringify(Object.fromEntries(Object.entries(draftOf(q)).filter(([, v]) => v)));
  const errors = r.ok ? (same && q.complete ? [t.complete] : []) : Object.keys(draft).some((k) => draft[k as Ability]) ? r.errors : [t.asi.hint];
  return <AsiView q={q} draft={draft} onDraft={onDraft} errors={errors} onApply={() => onApply(r)} />;
}
