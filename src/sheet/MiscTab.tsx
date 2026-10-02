import { setCoins, setOverride, OVERRIDE_KEYS } from "../engine/play";
import { strings as it } from "../i18n";
import { Button } from "../ui/theme";
import type { TabProps } from "./types";
import { PdfButton } from "./PdfButton";
import { num } from "./util";

const t = it.play;
const COINS = ["pp", "gp", "ep", "sp", "cp"] as const;
const NAMES: Record<string, string> = { ac: "Classe Armatura", "hp.max": "PF massimi", initiative: "Iniziativa", "speed.walk": "Velocità", passivePerception: "Percezione passiva" };

export function MiscTab({ ch, rs, d, update, onReopen }: TabProps & { onReopen: () => void }) {
  const forced = OVERRIDE_KEYS.filter((k) => ch.overrides[k] !== undefined);
  return (
    <>
      {d.warnings.length > 0 && <div className="ui-banner"><b>{t.warnings}:</b> {d.warnings.join(" ")}</div>}
      <h3>{t.coins}</h3>
      <div className="pl-row">
        {COINS.map((k) => (
          <label key={k} style={{ display: "grid", gap: 2 }}>{k.toUpperCase()}
            <input className="wz-num" style={{ width: 84 }} type="number" inputMode="numeric" min={0} value={ch.coins[k]} onChange={(e) => update((c) => setCoins(c, { [k]: num(e.target.value) }))} />
          </label>
        ))}
      </div>
      <h3>{t.notes}</h3>
      <textarea className="ui-input" style={{ minHeight: 160, padding: 8 }} aria-label={t.notes} placeholder={t.notesHelp} value={ch.notes} onChange={(e) => update((c) => ({ ...c, notes: e.target.value }))} />
      <h3>{t.overrides}</h3>
      {forced.length === 0 ? <p className="ui-muted">{t.noOverrides}</p> : (
        <ul className="pl-list">
          {forced.map((k) => (
            <li key={k}><div className="pl-cond" style={{ cursor: "default" }}>
              <span className="nm">{NAMES[k]}: <b>{ch.overrides[k]}</b></span>
              <Button onClick={() => update((c) => setOverride(c, k, undefined))}>{t.remove}</Button>
            </div></li>
          ))}
        </ul>
      )}
      <h3>PDF</h3>
      <PdfButton ch={ch} rs={rs} />
      <div className="ui-actions footer"><Button onClick={onReopen}>{t.reopen}</Button></div>
    </>
  );
}
