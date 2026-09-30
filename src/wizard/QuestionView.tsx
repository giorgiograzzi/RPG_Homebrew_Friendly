import { useState } from "react";
import type { Question } from "../engine/creation";
import { ABILITIES, type Ability } from "../engine/schema";
import it from "../i18n/it.json";
import { fmt } from "../ui/format";
import { Button } from "../ui/xp";
import { togglePick } from "./logic";

const t = it.wizard;
const AB = it.wizard.abilities as Record<Ability, string>;

// Una domanda di creazione: elenco di opzioni toccabili. Quelle escluse restano visibili con il motivo.
export function QuestionView({ q, onPick }: { q: Question; onPick: (key: string, picked: string[]) => void }) {
  const [filter, setFilter] = useState("");
  const single = q.count === 1;
  const shown = q.options.filter((o) => !filter || o.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <section className="wz-q" aria-labelledby={`q-${q.key}`}>
      <h3 id={`q-${q.key}`}>{q.label}</h3>
      <div className="meta xp-muted">
        {q.owner !== q.label && <span>{q.owner} · </span>}
        {q.disabled ? q.disabledReason : `${fmt(t.pick, { n: q.count })} · ${fmt(t.picked, { k: q.selected.length, n: q.count })}${q.complete ? " ✓" : ""}`}
      </div>
      {q.options.length === 0 ? <p className="xp-muted">{t.noOptions}</p> : (
        <>
          {q.options.length > 12 && <input className="xp-input" style={{ marginBottom: 8 }} type="search" placeholder={t.filter} aria-label={t.filter} value={filter} onChange={(e) => setFilter(e.target.value)} />}
          <ul className={`wz-opts ${q.options.length > 12 ? "long" : ""}`} role={single ? "radiogroup" : "group"} aria-label={q.label}>
            {shown.map((o) => (
              <li key={o.id}>
                <button type="button" className="wz-opt" role={single ? "radio" : "checkbox"} aria-checked={o.selected} aria-disabled={!o.enabled || q.disabled === true}
                  onClick={() => { if (o.enabled && !q.disabled) onPick(q.key, togglePick(q, o.id)); }}>
                  <span className={`mark ${single ? "radio" : ""}`} aria-hidden="true">{o.selected ? (single ? "●" : "✓") : ""}</span>
                  <span className="txt">
                    <span className="nm">{o.name}</span>
                    {!o.enabled && o.disabledReason && <span className="why"> — {o.disabledReason}</span>}
                    {o.description && <span className="desc" style={{ display: "-webkit-box" }}>{o.description}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// Aumenti di caratteristica: si compone una bozza (0/+1/+2 per caratteristica) e si applica quando le regole della fonte sono rispettate
export function AsiView({ q, draft, onDraft, onApply, errors }: {
  q: Question; draft: Partial<Record<Ability, number>>; onDraft: (d: Partial<Record<Ability, number>>) => void; onApply: () => void; errors: string[];
}) {
  const allowed = q.asi!.allowed;
  const bump = (a: Ability, d: number) => onDraft({ ...draft, [a]: Math.max(0, Math.min(2, (draft[a] ?? 0) + d)) });
  return (
    <section className="wz-q" aria-labelledby={`q-${q.key}`}>
      <h3 id={`q-${q.key}`}>{q.label}</h3>
      <div className="meta xp-muted">{q.owner}{q.complete ? " ✓" : ""}</div>
      {ABILITIES.map((a) => {
        const opt = q.options.find((o) => o.id === a);
        const ok = allowed.includes(a) && opt?.enabled !== false;
        return (
          <div key={a} className="wz-score" style={{ gridTemplateColumns: "1fr auto auto auto" }}>
            <span className="n">{AB[a]}{!ok && opt?.disabledReason ? <span className="xp-muted"> — {opt.disabledReason}</span> : null}</span>
            <Button aria-label={`${AB[a]} −`} disabled={!ok || !(draft[a] ?? 0)} onClick={() => bump(a, -1)}>−</Button>
            <span className="v">{ok ? `+${draft[a] ?? 0}` : "—"}</span>
            <Button aria-label={`${AB[a]} +`} disabled={!ok || (draft[a] ?? 0) >= 2} onClick={() => bump(a, 1)}>+</Button>
          </div>
        );
      })}
      {errors.length > 0 && <p className="xp-muted" role="status">{errors[0]}</p>}
      <div className="xp-actions" style={{ marginTop: 8 }}>
        <Button variant="primary" disabled={errors.length > 0} onClick={onApply}>{t.asi.apply}</Button>
      </div>
    </section>
  );
}
