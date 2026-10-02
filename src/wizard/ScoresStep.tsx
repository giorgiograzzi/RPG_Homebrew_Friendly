import { pointBuyCost } from "../engine/creation";
import { buildCtx } from "../engine/compute";
import type { Ruleset } from "../engine/ruleset";
import { ABILITIES, type Ability } from "../engine/schema";
import type { Character } from "../engine/types";
import { strings as it } from "../i18n";
import { fmt } from "../ui/format";
import { Button, Field, Segmented } from "../ui/theme";
import { METHODS, chooseMethod, rerollScores, stepPointBuy, swapScore } from "./logic";
import { setBaseScores } from "../engine/creation";

const t = it.wizard;
const AB = it.wizard.abilities as Record<Ability, string>;
type Method = (typeof METHODS)[number];
const mod = (n: number) => { const m = Math.floor((n - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; };

export function ScoresStep({ ch, rs, allowReroll, onChange, onError }: {
  ch: Character; rs: Ruleset; allowReroll: boolean; onChange: (c: Character) => void; onError: (e: string[]) => void;
}) {
  const method = ch.creation?.method;
  const rules = rs.creation.get("creation");
  const totals = buildCtx(ch, rs).scores;
  const apply = (r: ReturnType<typeof setBaseScores>) => { if (r.ok) { onError([]); onChange(r.character); } else onError(r.errors); };
  const setScores = (scores: Record<Ability, number>) => method && apply(setBaseScores(ch, rs, method, scores));
  const pool = method === "array" ? rules?.standardArray ?? [] : method === "roll" ? ch.creation?.rolls ?? [] : [];
  const values = [...new Set(pool)].sort((a, b) => b - a);
  const pb = method === "pointbuy" ? pointBuyCost(rs, ch.baseScores) : undefined;

  return (
    <>
      <Field label={t.scores.method}>
        <Segmented<Method> label={t.scores.method} value={(method ?? "") as Method} onChange={(m) => apply(chooseMethod(ch, rs, m, { allowReroll }))}
          options={METHODS.map((m) => ({ value: m, label: t.scores[m] }))} />
      </Field>
      {method && method !== "array" && <p className="ui-muted">{t.scores.nonSrd}</p>}
      {method === "array" && <p className="ui-muted">{t.scores.arrayHelp}</p>}
      {method === "roll" && <p className="ui-muted">{t.scores.rollHelp}</p>}
      {method === "pointbuy" && pb && rules && <p className="ui-muted">{fmt(t.scores.pointbuyHelp, { n: pb.remaining, t: rules.pointBuy.budget, min: rules.pointBuy.min, max: rules.pointBuy.max })}</p>}
      {method === "manual" && <p className="ui-muted">{t.scores.manualHelp}</p>}
      {method === "roll" && (
        <div className="ui-actions" style={{ justifyContent: "flex-start" }}>
          <Button disabled={!allowReroll} onClick={() => apply(rerollScores(ch, rs, allowReroll))}>{t.scores.reroll}</Button>
          {!allowReroll && <span className="ui-muted">{t.scores.rerollOff}</span>}
        </div>
      )}
      {!method && <p className="ui-muted">{t.pick.replace("{n}", "1")} — {t.scores.method}</p>}
      {method && (
        <div role="group" aria-label={t.scores.table}>
          {ABILITIES.map((a) => (
            <div key={a} className="wz-score" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <span><span className="n">{AB[a]}</span><br /><span className="ui-muted">{t.scores.total} {totals[a]} · {t.scores.mod} {mod(totals[a])}</span></span>
              {(method === "array" || method === "roll") && (
                <select className="ui-select" style={{ width: 104 }} aria-label={`${AB[a]} base`} value={ch.baseScores[a]} onChange={(e) => setScores(swapScore(ch.baseScores, a, Number(e.target.value)))}>
                  {values.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
              {method === "pointbuy" && (
                <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <Button aria-label={`${AB[a]} −`} style={{ minWidth: 48, padding: 0 }} onClick={() => setScores(stepPointBuy(rs, ch.baseScores, a, -1))}>−</Button>
                  <span className="v" style={{ minWidth: 24, textAlign: "center", fontWeight: 700 }}>{ch.baseScores[a]}</span>
                  <Button aria-label={`${AB[a]} +`} style={{ minWidth: 48, padding: 0 }} onClick={() => setScores(stepPointBuy(rs, ch.baseScores, a, 1))}>+</Button>
                </span>
              )}
              {method === "manual" && (
                <input className="wz-num" style={{ width: 104 }} type="number" inputMode="numeric" min={1} max={20} aria-label={`${AB[a]} base`} value={ch.baseScores[a]}
                  onChange={(e) => { const n = Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1))); setScores({ ...ch.baseScores, [a]: n }); }} />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
