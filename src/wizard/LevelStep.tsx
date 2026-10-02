import { hpIsRolled, levelBand, rollStartingGold, setHpMode, setSecondClass, xpThreshold, MAX_START_LEVEL, type DecisionResult } from "../engine/creation";
import { proficiencyByLevel } from "../engine/compute";
import type { Ruleset } from "../engine/ruleset";
import type { Character } from "../engine/types";
import { strings as it } from "../i18n";
import { fmt } from "../ui/format";
import { Button, Field, Segmented } from "../ui/theme";

const t = it.wizard.levelStep;

// Passo 0: livello di partenza, Punti Ferita ai livelli successivi, monete e oggetti della fascia di livello
export function LevelStep({ ch, rs, onLevel, onChange }: { ch: Character; rs: Ruleset; onLevel: (n: number) => void; onChange: (c: Character) => void }) {
  const level = ch.startLevel ?? ch.classes[0]?.level ?? 1;
  const band = levelBand(rs, level);
  const items = band ? (["common", "uncommon", "rare", "veryRare"] as const).filter((k) => band.magicItems[k] > 0).map((k) => fmt(t.magicItem[k], { n: band.magicItems[k] })).join(", ") : "";
  return (
    <>
      <p className="ui-muted">{t.help}</p>
      <Field label={t.level}>
        <select className="ui-select" value={level} onChange={(e) => onLevel(Number(e.target.value))} aria-label={t.level}>
          {Array.from({ length: MAX_START_LEVEL }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>
      <ul className="wz-tags">
        <li>{fmt(t.pb, { n: proficiencyByLevel(level) })}</li>
        <li>{fmt(t.xp, { n: xpThreshold(rs, level) ?? 0 })}</li>
      </ul>

      {band && (
        <Field label={t.wealth}>
          <p>{fmt(t.wealthBase, { g: band.gold })}{band.goldDice ? fmt(t.wealthDice, { c: band.goldDice.count, s: band.goldDice.sides, m: band.goldDice.multiplier }) : ""} — {t.wealthNormal}</p>
          {band.goldDice && (ch.startingGold === undefined
            ? <><p className="ui-muted">{fmt(t.wealthPending, { g: band.gold })}</p><div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button variant="primary" onClick={() => onChange(rollStartingGold(ch, rs))}>{t.wealthRoll}</Button></div></>
            : <p role="status"><b>{fmt(t.wealthDone, { g: ch.startingGold })}</b></p>)}
          {items && <p className="ui-muted">{fmt(t.magic, { items })}</p>}
        </Field>
      )}
      {!band && <p className="ui-muted">{t.wealthNone}</p>}
    </>
  );
}

// Seconda classe alla creazione (multiclasse), per chi parte da livello 2 o più. Si sceglie dopo la prima classe.
export function SecondClass({ ch, rs, onApply }: { ch: Character; rs: Ruleset; onApply: (r: DecisionResult) => void }) {
  const first = ch.classes[0];
  const total = ch.startLevel ?? first?.level ?? 1;
  if (!first || total < 2) return null;
  const second = ch.classes[1];
  const s = it.wizard.second;
  return (
    <section className="wz-q" aria-labelledby="q-second-class">
      <h3 id="q-second-class">{s.title}</h3>
      <p className="ui-muted">{s.help}</p>
      <Field label={s.class}>
        <select className="ui-select" value={second?.classId ?? ""} aria-label={s.class} onChange={(e) => onApply(setSecondClass(ch, rs, e.target.value || null, second?.level ?? 1))}>
          <option value="">{s.none}</option>
          {[...rs.classes.values()].filter((c) => c.id !== first.classId).map((c) => <option key={c.id} value={c.id}>{c.name.it}</option>)}
        </select>
      </Field>
      {second && (
        <Field label={fmt(s.levels, { c: rs.classes.get(second.classId)?.name.it ?? second.classId })}>
          <select className="ui-select" value={second.level} aria-label={s.levels.replace("{c}", "")} onChange={(e) => onApply(setSecondClass(ch, rs, second.classId, Number(e.target.value)))}>
            {Array.from({ length: total - 1 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      )}
      {second && <p className="ui-muted">{fmt(s.split, { a: rs.classes.get(first.classId)?.name.it ?? first.classId, la: first.level, b: rs.classes.get(second.classId)?.name.it ?? second.classId, lb: second.level })}</p>}
    </section>
  );
}

// Punti Ferita ai livelli successivi al 1°: valore fisso o tiri (memorizzati). Serve la classe, quindi sta nel riepilogo.
export function HpField({ ch, rs, allowReroll, onChange }: { ch: Character; rs: Ruleset; allowReroll: boolean; onChange: (c: Character) => void }) {
  const first = ch.classes[0];
  const def = first && rs.classes.get(first.classId);
  const level = ch.classes.reduce((n, c) => n + c.level, 0) || 1;
  const rolled = hpIsRolled(ch);
  if (level <= 1) return null;
  return (
        <Field label={fmt(t.hp, { n: level })}>
          {!def ? <p className="ui-muted">{t.hpNeedClass}</p> : (
            <>
              <Segmented<"avg" | "roll"> label={t.hp} value={rolled ? "roll" : "avg"} onChange={(m) => onChange(setHpMode(ch, rs, m))}
                options={[{ value: "avg", label: t.hpAvg }, { value: "roll", label: t.hpRoll }]} />
              <p className="ui-muted">{rolled ? fmt(t.hpRollHelp, { r: ch.classes.flatMap((c, ci) => c.hpRolls.slice(ci === 0 ? 1 : 0)).join(", ") }) : t.hpAvgHelp}</p>
              {rolled && <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button disabled={!allowReroll} onClick={() => onChange(setHpMode(ch, rs, "roll"))}>{t.hpReroll}</Button></div>}
            </>
          )}
        </Field>
  );
}
