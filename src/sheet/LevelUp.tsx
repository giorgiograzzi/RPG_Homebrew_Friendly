import { useMemo, useState } from "react";
import { allQuestions } from "../engine/creation";
import { fixedHpPerLevel, levelUp, levelUpOptions, rollHitDie, totalLevel, MAX_LEVEL, type HpChoice } from "../engine/levelup";
import type { Ruleset } from "../engine/ruleset";
import type { Ability } from "../engine/schema";
import type { Character } from "../engine/types";
import { strings as it } from "../i18n";
import { fmt } from "../ui/format";
import { Button, Dialog } from "../ui/theme";
import { AsiBlock, draftOf } from "../wizard/Wizard";
import { QuestionView } from "../wizard/QuestionView";
import { choose } from "../wizard/logic";
import { appStore } from "../store";

const t = it.levelup;

// Passaggio di livello in 3 passi: classe → Punti Ferita → novità e scelte. Il motore (levelUp) fa tutti i conti.
export function LevelUp({ ch, rs, update, onClose }: { ch: Character; rs: Ruleset; update: (fn: (c: Character) => Character) => void; onClose: () => void }) {
  const options = useMemo(() => levelUpOptions(ch, rs), [ch, rs]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [classId, setClassId] = useState(ch.classes[0]?.classId ?? "");
  const [hp, setHp] = useState<HpChoice>("avg");
  const [work, setWork] = useState<Character | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<Ability, number>>>>({});

  const def = rs.classes.get(classId);
  const preview = useMemo(() => (classId ? levelUp(ch, rs, classId, hp) : null), [ch, rs, classId, hp]);
  const total = totalLevel(ch);
  const base = work ?? preview?.character ?? ch;
  const pending = useMemo(() => (step === 3 ? allQuestions(base, rs).filter((q) => !q.complete && !q.disabled) : []), [step, base, rs]);
  // domande da mostrare: quelle ancora aperte e quelle già risolte in questa sessione di level-up
  const [shownKeys, setShownKeys] = useState<string[]>([]);
  const questions = useMemo(() => (step === 3 ? allQuestions(base, rs).filter((q) => shownKeys.includes(q.key)) : []), [step, base, rs, shownKeys]);

  if (total >= MAX_LEVEL) return <Dialog title={t.title} onClose={onClose}><p>{t.max}</p></Dialog>;

  const toStep3 = () => {
    if (!preview?.ok) return;
    setWork(preview.character);
    setShownKeys(preview.pending.map((q) => q.key));
    setErrors([]);
    setStep(3);
  };
  const pick = (key: string, picked: string[]) => {
    const r = choose(base, rs, key, picked);
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors([]); setWork(r.character);
  };
  const confirm = () => { void appStore.getState().snapshot(it.play.snapshots.levelUp); update(() => base); onClose(); };

  return (
    <Dialog title={t.title} onClose={onClose}>
      <p className="ui-muted">{[t.stepClass, t.stepHp, t.stepChoices][step - 1]} · {t.total}: {total} → {total + 1}</p>
      {errors.length > 0 && <div className="ui-error" role="alert">{errors.map((e) => <div key={e}>{e}</div>)}</div>}

      {step === 1 && (
        <ul className="wz-opts" role="radiogroup" aria-label={t.stepClass}>
          {options.map((o) => (
            <li key={o.classId}>
              <button type="button" className="wz-opt" role="radio" aria-checked={o.classId === classId} aria-disabled={!o.enabled}
                onClick={() => { if (o.enabled) { setClassId(o.classId); setWork(null); } }}>
                <span className="mark radio" aria-hidden="true">{o.classId === classId ? "●" : ""}</span>
                <span className="txt">
                  <span className="nm">{o.name} — {o.isNew ? t.newClass : fmt(t.levelTo, { a: o.level - 1, b: o.level })}</span>
                  {!o.enabled && o.reason && <span className="why"> — {o.reason}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 2 && def && preview && (
        <>
          <p className="ui-muted">{fmt(t.hpDie, { d: def.hitDie })}</p>
          <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            <Button variant={hp === "avg" ? "primary" : undefined} aria-pressed={hp === "avg"} onClick={() => setHp("avg")}>{fmt(t.fixed, { n: fixedHpPerLevel(def.hitDie) })}</Button>
            <Button variant={hp !== "avg" ? "primary" : undefined} aria-pressed={hp !== "avg"} onClick={() => setHp(rollHitDie(def.hitDie))}>{fmt(t.roll, { d: def.hitDie })}</Button>
          </div>
          {hp !== "avg" && <p role="status">{fmt(t.rolled, { r: hp })}</p>}
          {preview.ok && <p role="status"><b>{fmt(t.hpGain, { a: preview.hpMaxBefore, b: preview.hpMaxAfter, g: preview.hpGain })}</b></p>}
        </>
      )}

      {step === 3 && preview?.ok && (
        <>
          <p>{fmt(t.pb, { a: preview.pbBefore, b: preview.pbAfter })}</p>
          <h3>{t.newFeatures}</h3>
          {preview.features.length === 0 ? <p className="ui-muted">{t.noFeatures}</p> : (
            <ul>{preview.features.map((f) => <li key={f.id}><b>{f.name}</b></li>)}</ul>
          )}
          {preview.subclassNow && <p className="ui-muted">{t.subclass}</p>}
          {preview.isNew && <p className="ui-muted">{t.multiclassNote}</p>}
          <h3>{t.choices}</h3>
          {questions.length === 0 && <p className="ui-muted">{t.noChoices}</p>}
          {questions.map((q) => q.kind === "abilityIncrease"
            ? <AsiBlock key={q.key} q={q} ch={base} rs={rs} draft={drafts[q.key] ?? draftOf(q)} onDraft={(d) => setDrafts({ ...drafts, [q.key]: d })}
                onApply={(r) => { if (r.ok) { setErrors([]); setWork(r.character); setDrafts(({ [q.key]: _, ...rest }) => rest); } else setErrors(r.errors); }} />
            : <QuestionView key={q.key} q={q} onPick={pick} />)}
          {pending.length > 0 && <p className="ui-muted" role="status">{t.missing}</p>}
        </>
      )}

      <div className="ui-actions footer">
        {step === 1 ? <Button onClick={onClose}>{t.cancel}</Button> : <Button onClick={() => { setErrors([]); setStep((step - 1) as 1 | 2); if (step === 3) setWork(null); }}>← {t.back}</Button>}
        {step === 1 && <Button variant="primary" disabled={!options.find((o) => o.classId === classId)?.enabled} onClick={() => setStep(2)}>{t.next} →</Button>}
        {step === 2 && <Button variant="primary" disabled={!preview?.ok} onClick={toStep3}>{t.next} →</Button>}
        {step === 3 && <Button variant="primary" disabled={pending.length > 0} onClick={confirm}>{t.confirm}</Button>}
      </div>
    </Dialog>
  );
}
