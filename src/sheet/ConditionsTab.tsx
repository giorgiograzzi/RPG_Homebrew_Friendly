import { useState } from "react";
import { setCondition, setExhaustion } from "../engine/play";
import { strings as it } from "../i18n";
import { fmt } from "../ui/format";
import { Button } from "../ui/theme";
import type { TabProps } from "./types";
import { distance } from "../ui/units";

const t = it.play;

export function ConditionsTab({ ch, rs, d, update, onBack }: TabProps & { onBack: () => void }) {
  const [sources, setSources] = useState<Record<string, string>>({});
  const cs = d.conditions;
  const list = [...rs.conditions.values()].filter((c) => !c.stackable);
  const ex = rs.conditions.get("exhaustion");
  return (
    <>
      <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button onClick={onBack}>← {t.toStatus}</Button></div>
      <h2>{t.conditionsTitle}</h2>
      {cs.dead && <div className="ui-error" role="alert">{t.dead}</div>}
      {cs.active.length === 0 ? <p className="ui-muted">{t.none}</p> : (cs.cannot.length > 0 && <p><b>{t.cannot}:</b> {cs.cannot.join(", ")}</p>)}

      {ex && (
        <section className="pl-hp">
          <b>{ex.name.it}</b> — {fmt(t.exhaustionLevel, { n: ch.state.exhaustion })}
          <div className="pl-row">
            <Button aria-label={`${t.exhaustion} −`} disabled={ch.state.exhaustion <= 0} onClick={() => update((c) => setExhaustion(c, c.state.exhaustion - 1))}>−</Button>
            <span className="pl-pips">{Array.from({ length: 6 }, (_, i) => <span key={i} className={`pl-pip ${i < ch.state.exhaustion ? "on ko" : ""}`} />)}</span>
            <Button aria-label={`${t.exhaustion} +`} disabled={ch.state.exhaustion >= 6} onClick={() => update((c) => setExhaustion(c, c.state.exhaustion + 1))}>+</Button>
          </div>
          {ch.state.exhaustion > 0 && <p className="ui-muted">{fmt(t.penalty, { n: cs.d20Penalty, s: distance(-cs.speedPenalty) })}</p>}
          {ex.description && <p className="ui-muted">{ex.description}</p>}
        </section>
      )}

      <ul className="pl-list">
        {list.map((c) => {
          const on = ch.state.conditions.includes(c.id);
          const included = !on && cs.active.includes(c.id);
          const blocked = cs.immune.includes(c.id);
          return (
            <li key={c.id}>
              <button type="button" className="pl-cond" role="checkbox" aria-checked={on || included} disabled={blocked}
                onClick={() => update((x) => setCondition(x, rs, c.id, !on, sources[c.id]))}>
                <span className="wz-opt" style={{ padding: 0, border: 0, minHeight: 0, width: "auto" }}><span className="mark" aria-hidden="true">{on || included ? "✓" : ""}</span></span>
                <span className="txt" style={{ flex: 1 }}>
                  <b>{c.name.it}</b>{included && <span className="pl-sub">{t.includedIn}</span>}{blocked && <span className="pl-sub">{t.immune}</span>}
                  {c.description && <span className="pl-sub" style={{ display: "block" }}>{c.description}</span>}
                  {on && ch.state.conditionSources?.[c.id] && <span className="pl-sub" style={{ display: "block" }}>{ch.state.conditionSources[c.id]}</span>}
                </span>
              </button>
              {c.requiresSource && !on && (
                <div style={{ padding: "0 12px 8px" }}>
                  <input className="ui-input" placeholder={t.source} aria-label={`${c.name.it}: ${t.source}`} value={sources[c.id] ?? ""} onChange={(e) => setSources({ ...sources, [c.id]: e.target.value })} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {cs.situational.length > 0 && <ul>{cs.situational.map((s) => <li key={s}>{s}</li>)}</ul>}
    </>
  );
}
