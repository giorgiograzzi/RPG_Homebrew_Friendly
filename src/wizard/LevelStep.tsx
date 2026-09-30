import { hpIsRolled, levelBand, rollStartingGold, setHpMode, xpThreshold, MAX_START_LEVEL } from "../engine/creation";
import { proficiencyByLevel } from "../engine/compute";
import type { Ruleset } from "../engine/ruleset";
import type { Character } from "../engine/types";
import it from "../i18n/it.json";
import { fmt } from "../ui/format";
import { Button, Field, Segmented } from "../ui/xp";

const t = it.wizard.levelStep;

// Passo 0: livello di partenza, Punti Ferita ai livelli successivi, monete e oggetti della fascia di livello
export function LevelStep({ ch, rs, onLevel, onChange }: { ch: Character; rs: Ruleset; onLevel: (n: number) => void; onChange: (c: Character) => void }) {
  const level = ch.startLevel ?? ch.classes[0]?.level ?? 1;
  const band = levelBand(rs, level);
  const items = band ? (["common", "uncommon", "rare", "veryRare"] as const).filter((k) => band.magicItems[k] > 0).map((k) => fmt(t.magicItem[k], { n: band.magicItems[k] })).join(", ") : "";
  return (
    <>
      <p className="xp-muted">{t.help}</p>
      <Field label={t.level}>
        <select className="xp-select" value={level} onChange={(e) => onLevel(Number(e.target.value))} aria-label={t.level}>
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
            ? <><p className="xp-muted">{fmt(t.wealthPending, { g: band.gold })}</p><div className="xp-actions" style={{ justifyContent: "flex-start" }}><Button variant="primary" onClick={() => onChange(rollStartingGold(ch, rs))}>{t.wealthRoll}</Button></div></>
            : <p role="status"><b>{fmt(t.wealthDone, { g: ch.startingGold })}</b></p>)}
          {items && <p className="xp-muted">{fmt(t.magic, { items })}</p>}
        </Field>
      )}
      {!band && <p className="xp-muted">{t.wealthNone}</p>}
    </>
  );
}

// Punti Ferita ai livelli successivi al 1°: valore fisso o tiri (memorizzati). Serve la classe, quindi sta nel riepilogo.
export function HpField({ ch, rs, allowReroll, onChange }: { ch: Character; rs: Ruleset; allowReroll: boolean; onChange: (c: Character) => void }) {
  const first = ch.classes[0];
  const def = first && rs.classes.get(first.classId);
  const level = first?.level ?? 1;
  const rolled = hpIsRolled(ch);
  if (level <= 1) return null;
  return (
        <Field label={fmt(t.hp, { n: level })}>
          {!def ? <p className="xp-muted">{t.hpNeedClass}</p> : (
            <>
              <Segmented<"avg" | "roll"> label={t.hp} value={rolled ? "roll" : "avg"} onChange={(m) => onChange(setHpMode(ch, rs, m))}
                options={[{ value: "avg", label: t.hpAvg }, { value: "roll", label: t.hpRoll }]} />
              <p className="xp-muted">{rolled ? fmt(t.hpRollHelp, { r: first!.hpRolls.slice(1).join(", ") }) : t.hpAvgHelp}</p>
              {rolled && <div className="xp-actions" style={{ justifyContent: "flex-start" }}><Button disabled={!allowReroll} onClick={() => onChange(setHpMode(ch, rs, "roll"))}>{t.hpReroll}</Button></div>}
            </>
          )}
        </Field>
  );
}
