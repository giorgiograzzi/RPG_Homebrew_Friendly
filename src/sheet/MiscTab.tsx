import { setCoins, setOverride, OVERRIDE_KEYS } from "../engine/play";
import { strings as it } from "../i18n";
import { tr } from "../i18n/tr";
import { DetailsForm } from "../wizard/DetailsForm";
import { Button, Dialog } from "../ui/theme";
import type { TabProps } from "./types";
import { PdfButton } from "./PdfButton";
import { num } from "./util";
import { useEffect, useState } from "react";
import { fmt, formatDate } from "../ui/format";
import { useApp } from "../ui/useApp";

const t = it.play;
const COINS = ["pp", "gp", "ep", "sp", "cp"] as const;
const NAMES: Record<string, string> = { ac: it.play.ac, "hp.max": tr("PF massimi", "Max HP"), initiative: it.play.init, "speed.walk": it.play.speed, passivePerception: it.play.pp };

function Snapshots() {
  const snapshot = useApp((s) => s.snapshot);
  const list = useApp((s) => s.snapshots);
  const restore = useApp((s) => s.restoreSnapshot);
  const current = useApp((s) => s.current);
  const [items, setItems] = useState<{ id: number; createdAt: number; label: string }[]>([]);
  const [ask, setAsk] = useState<{ id: number; createdAt: number } | null>(null);
  const reload = () => void list().then(setItems);
  useEffect(reload, [list, current?.id]);
  const s = t.snapshots;
  return (
    <>
      <h3>{s.title}</h3>
      <p className="ui-muted">{s.help}</p>
      {items.length === 0 ? <p className="ui-muted">{s.none}</p> : (
        <ul className="pl-list">
          {items.map((x) => <li key={x.id}><div className="pl-cond" style={{ cursor: "default" }}><span className="nm">{x.label}<br /><span className="pl-sub">{formatDate(x.createdAt)}</span></span><Button onClick={() => setAsk(x)}>{s.restore}</Button></div></li>)}
        </ul>
      )}
      <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button onClick={() => void snapshot(s.manual).then(reload)}>{s.now}</Button></div>
      {ask && (
        <Dialog title={s.restore} onClose={() => setAsk(null)}>
          <p>{fmt(s.restoreConfirm, { d: formatDate(ask.createdAt) })}</p>
          <div className="ui-actions footer">
            <Button onClick={() => setAsk(null)}>{it.wizard.confirmNo}</Button>
            <Button variant="primary" onClick={() => void restore(ask.id).then(() => { setAsk(null); reload(); })}>{it.wizard.confirmYes}</Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

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
      <h3>{it.wizard.details.title}</h3>
      <DetailsForm ch={ch} onChange={(c) => update(() => c)} />
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
      <Snapshots />
      <h3>PDF</h3>
      <PdfButton ch={ch} rs={rs} />
      <div className="ui-actions footer"><Button onClick={onReopen}>{t.reopen}</Button></div>
    </>
  );
}
