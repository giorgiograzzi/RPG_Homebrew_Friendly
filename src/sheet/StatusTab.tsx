import { useState } from "react";
import {
  applyDamage, applyHealing, deathSave, isDead, isDying, isStable, longRest, nextHitDie, rollD20, setDeathSaves, setInspiration, setOverride, setTempHp,
  shortRest, spendHitDie, stabilize, toggleSlot, useResource, type OverrideKey,
} from "../engine/play";
import type { Sourced } from "../engine/types";
import { strings as it } from "../i18n";
import { fmt } from "../ui/format";
import { Button, Check, Dialog } from "../ui/theme";
import { concentrationDc, endConcentration } from "../engine/magic";
import { RegainButton, RollDialog, SourcesDialog } from "./dialogs";
import type { TabProps } from "./types";
import { num, sign } from "./util";
import { tr } from "../i18n/tr";
import { distance } from "../ui/units";

const t = it.play;
const RECHARGE: Record<string, string> = { short_rest: tr("Si ricarica con un riposo breve", "Recharges on a short rest"), long_rest: tr("Si ricarica con un riposo lungo", "Recharges on a long rest"), dawn: tr("Si ricarica all'alba", "Recharges at dawn") };
const Pips = ({ n, of, kind }: { n: number; of: number; kind: "ok" | "ko" }) => (
  <span className="pl-pips" aria-label={`${n}/${of}`}>{Array.from({ length: of }, (_, i) => <span key={i} className={`pl-pip ${i < n ? `on ${kind}` : ""}`} />)}</span>
);

export function StatusTab({ ch, rs, d, update, onSection }: TabProps & { onSection: (s: "conditions") => void }) {
  const [note, setNote] = useState("");
  const [dlg, setDlg] = useState<null | { kind: "sources"; title: string; value: Sourced; key?: OverrideKey } | { kind: "init" } | { kind: "short" } | { kind: "long" } | { kind: "save" } | { kind: "hp" } | { kind: "saves" }>(null);
  const s = ch.state;
  const max = d.hp.max.value;
  const dying = isDying(ch), stable = isStable(ch), dead = isDead(ch, d);
  const damage = (amt: number, crit = false) => {
    const r = applyDamage(ch, max, amt, { crit });
    let next = r.character, msg = r.note ?? (r.downed ? "PF a zero." : "");
    const conc = ch.state.concentration;
    if (conc) {
      // a 0 PF o morto si è Incapacitati: la Concentrazione termina; altrimenti TS Costituzione (file 04)
      if (r.downed || r.dead) { next = endConcentration(next); msg += ` ${it.magic.concEnded}`; }
      else msg += ` ${fmt(it.magic.damageConc, { n: rs.spells.get(conc)?.name.it ?? conc, dc: concentrationDc(amt) })}${d.feats.includes("war_caster") ? it.magic.damageConcAdv : ""}`;
    }
    update(() => next); setNote(msg.trim());
  };
  const heal = (amt: number) => { update((c) => applyHealing(c, max, amt)); setNote(""); };
  const pct = Math.max(0, Math.min(100, (s.hp / Math.max(1, max)) * 100));

  const tile = (label: string, v: Sourced, key?: OverrideKey, fmtv: (n: number) => string = String) => (
    <button type="button" className={`pl-tile ${key && ch.overrides[key] !== undefined ? "forced" : ""}`} onClick={() => setDlg({ kind: "sources", title: label, value: v, key })}>
      {label}<b>{fmtv(v.value)}</b>{key && ch.overrides[key] !== undefined && <span className="pl-sub">{t.forced}</span>}
    </button>
  );

  return (
    <>
      <section className="pl-hp" aria-label={t.hp}>
        <div className="pl-hp-top">
          <div><div className="pl-hp-lbl">{t.hp}</div><div className="big">{s.hp} / {max}</div></div>
          <div><div className="pl-hp-lbl">{t.tempShort}</div><div className="big">{s.tempHp}</div></div>
          <button type="button" className="pl-hp-saves" aria-label={t.deathSaves} onClick={() => setDlg({ kind: "saves" })}>
            <div className="pl-hp-lbl">{t.deathSaves}</div>
            <div className="pl-row"><Pips n={s.deathSaves.successes} of={3} kind="ok" /></div>
            <div className="pl-row"><Pips n={s.deathSaves.failures} of={3} kind="ko" /></div>
          </button>
        </div>
        <div className={`pl-hpbar ${pct <= 25 ? "low" : ""}`} role="progressbar" aria-valuenow={s.hp} aria-valuemin={0} aria-valuemax={max}><div style={{ width: `${pct}%` }} /></div>
        {(dead || s.hp <= 0) && <b role="status">{dead ? t.dead : stable ? t.stable : dying ? t.dying : ""}</b>}
        {note && <p className="ui-muted" role="status">{note}</p>}
        <div className="pl-quick">
          <Button variant="danger" aria-label={`${t.damage} 5`} disabled={dead} onClick={() => damage(5)}>−5</Button>
          <Button variant="danger" aria-label={`${t.damage} 1`} disabled={dead} onClick={() => damage(1)}>−1</Button>
          <Button variant="primary" className="pl-quick-hp" onClick={() => setDlg({ kind: "hp" })}>{t.hpShort}</Button>
          <Button variant="primary" aria-label={`${t.heal} 1`} disabled={dead} onClick={() => heal(1)}>+1</Button>
          <Button variant="primary" aria-label={`${t.heal} 5`} disabled={dead} onClick={() => heal(5)}>+5</Button>
        </div>
      </section>

      <div className="pl-grid">
        {tile(t.ac, d.ac, "ac")}
        {tile(t.init, d.initiative, "initiative", sign)}
        {tile(t.speed, d.speed.walk, "speed.walk", (n) => distance(n))}
        {tile(t.pb, d.proficiencyBonus, undefined, sign)}
        {tile(t.pp, d.passivePerception, "passivePerception")}
        <button type="button" className="pl-tile" onClick={() => setDlg({ kind: "sources", title: t.hp, value: d.hp.max, key: "hp.max" })}>
          {t.hitDice}<b>{d.hp.hitDiceRemaining} / {d.hp.hitDice.reduce((n, x) => n + x.total, 0)}</b>
          <span className="pl-sub">{d.hp.hitDice.map((x) => `${x.total}d${x.die}`).join(" + ")}</span>
        </button>
      </div>

      <button type="button" className="pl-tile" style={{ width: "100%", marginBottom: 12 }} onClick={() => onSection("conditions")}>
        {t.conditionsTile}
        <b>{d.conditions.active.length + (s.exhaustion > 0 && !d.conditions.active.includes("exhaustion") ? 1 : 0) || 0}</b>
        <span className="pl-sub">{[...d.conditions.active.map((c) => rs.conditions.get(c)?.name.it ?? c), ...(s.exhaustion > 0 && !d.conditions.active.includes("exhaustion") ? [`${it.play.exhaustion} ${s.exhaustion}`] : [])].join(", ") || t.conditionsNone}</span>
      </button>

      <Check checked={s.inspiration} onChange={(v) => update((c) => setInspiration(c, v))}>{t.inspiration}</Check>

      <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap", marginTop: 12 }}>
        <Button onClick={() => setDlg({ kind: "short" })}>{t.shortRest}</Button>
        <Button onClick={() => setDlg({ kind: "long" })}>{t.longRest}</Button>
      </div>

      {Object.keys(d.resources).length > 0 && (
        <>
          <h3>{t.resources}</h3>
          <ul className="pl-list">
            {Object.entries(d.resources).map(([id, r]) => (
              <li key={id}><div className="pl-cond" style={{ cursor: "default" }}>
                <span className="nm">{r.max.sources[0]?.label ?? id}<br /><span className="pl-sub">{RECHARGE[r.recharge] ?? ""}</span></span>
                <span className="val">{r.remaining}/{r.max.value}</span>
                <Button aria-label={`${t.use} ${id}`} disabled={r.remaining <= 0} onClick={() => update((c) => useResource(c, id, r.max.value, 1))}>{t.use}</Button>
                <Button aria-label={`${t.restore} ${id}`} disabled={r.used <= 0} onClick={() => update((c) => useResource(c, id, r.max.value, -1))}>+</Button>
                {r.regain && <RegainButton id={id} max={r.max.value} used={r.used} regain={r.regain} update={update} />}
              </div></li>
            ))}
          </ul>
        </>
      )}

      {d.spellSlots.slots.some((n) => n > 0) && (
        <>
          <h3>{t.slots}</h3>
          <ul className="pl-list">
            {d.spellSlots.slots.map((total, i) => total > 0 && (
              <li key={i}><div className="pl-cond" style={{ cursor: "default" }}>
                <span className="nm">{fmt(t.slotLevel, { n: i + 1 })}</span>
                <span className="val">{d.spellSlots.remaining[i]}/{total}</span>
                <Button aria-label={`${t.use} ${i + 1}`} disabled={d.spellSlots.remaining[i]! <= 0} onClick={() => update((c) => toggleSlot(c, i + 1, total, 1))}>{t.use}</Button>
                <Button aria-label={`${t.restore} ${i + 1}`} disabled={d.spellSlots.used[i]! <= 0} onClick={() => update((c) => toggleSlot(c, i + 1, total, -1))}>+</Button>
              </div></li>
            ))}
          </ul>
        </>
      )}

      {dlg?.kind === "sources" && (
        <SourcesDialog title={dlg.title} value={dlg.value} forced={dlg.key ? ch.overrides[dlg.key] !== undefined : false}
          {...(dlg.key ? { onForce: (v: number | undefined) => { update((c) => setOverride(c, dlg.key!, v)); setDlg(null); } } : {})} onClose={() => setDlg(null)}
          {...(dlg.title === t.init ? { onRoll: () => setDlg({ kind: "init" }) } : {})} />
      )}
      {dlg?.kind === "hp" && <HpDialog {...{ ch, update, dead, damage, heal }} onClose={() => setDlg(null)} />}
      {dlg?.kind === "saves" && <SavesDialog {...{ ch, update, dead, dying, stable }} onRollSave={() => setDlg({ kind: "save" })} onClose={() => setDlg(null)} />}
      {dlg?.kind === "init" && <RollDialog title={t.init} bonus={d.initiative} mode={d.conditions.initiativeMode.mode} modeSources={d.conditions.initiativeMode.modeSources} onClose={() => setDlg(null)} />}
      {dlg?.kind === "save" && <DeathSaveDialog onRoll={(n) => { const r = deathSave(ch, n); update(() => r.character); }} onClose={() => setDlg(null)} />}
      {dlg?.kind === "short" && <ShortRest {...{ ch, d, update }} onClose={() => setDlg(null)} />}
      {dlg?.kind === "long" && (
        <Dialog title={t.longRest} onClose={() => setDlg(null)}>
          <p>{t.longConfirm}</p>
          <div className="ui-actions footer">
            <Button onClick={() => setDlg(null)}>{it.wizard.confirmNo}</Button>
            <Button variant="primary" onClick={() => { update((c) => longRest(c, d)); setDlg(null); }}>{it.wizard.confirmYes}</Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function HpDialog({ ch, update, dead, damage, heal, onClose }: Pick<TabProps, "ch" | "update"> & {
  dead: boolean; damage: (n: number, crit: boolean) => void; heal: (n: number) => void; onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [crit, setCrit] = useState(false);
  const s = ch.state;
  const amt = Math.max(0, num(amount));
  const done = () => { setAmount(""); setCrit(false); };
  return (
    <Dialog title={t.hp} onClose={onClose}>
      <p>{s.hp} PF · {t.tempShort}: <b>{s.tempHp}</b></p>
      <div className="pl-row">
        <input className="wz-num" style={{ width: 120 }} type="number" inputMode="numeric" min={0} aria-label={t.amount} placeholder={t.amount} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button variant="danger" disabled={!amt || dead} onClick={() => { damage(amt, crit); done(); }}>{t.damage}</Button>
        <Button variant="primary" disabled={!amt || dead} onClick={() => { heal(amt); done(); }}>{t.heal}</Button>
        <Button disabled={!amt} onClick={() => { update((c) => setTempHp(c, amt)); done(); }}>{t.setTemp}</Button>
      </div>
      {s.hp <= 0 && <Check checked={crit} onChange={setCrit}>{t.crit}</Check>}
      <div className="ui-actions footer"><Button onClick={onClose}>{t.close}</Button></div>
    </Dialog>
  );
}

function SavesDialog({ ch, update, dead, dying, stable, onRollSave, onClose }: Pick<TabProps, "ch" | "update"> & {
  dead: boolean; dying: boolean; stable: boolean; onRollSave: () => void; onClose: () => void;
}) {
  const s = ch.state;
  const saves = (su: number, fa: number) => update((c) => setDeathSaves(c, su, fa));
  return (
    <Dialog title={t.deathSaves} onClose={onClose}>
      {(s.hp <= 0 || dead) && <p><b>{dead ? t.dead : stable ? t.stable : dying ? t.dying : ""}</b></p>}
      <div className="pl-row"><span>{t.successes}</span><Pips n={s.deathSaves.successes} of={3} kind="ok" />
        <Button aria-label={`${t.successes} −`} onClick={() => saves(s.deathSaves.successes - 1, s.deathSaves.failures)}>−</Button>
        <Button aria-label={`${t.successes} +`} onClick={() => saves(s.deathSaves.successes + 1, s.deathSaves.failures)}>+</Button></div>
      <div className="pl-row"><span>{t.failures}</span><Pips n={s.deathSaves.failures} of={3} kind="ko" />
        <Button aria-label={`${t.failures} −`} onClick={() => saves(s.deathSaves.successes, s.deathSaves.failures - 1)}>−</Button>
        <Button aria-label={`${t.failures} +`} onClick={() => saves(s.deathSaves.successes, s.deathSaves.failures + 1)}>+</Button></div>
      <div className="pl-row">
        <Button variant="primary" disabled={!dying} onClick={onRollSave}>{t.rollSave}</Button>
        <Button disabled={s.hp > 0 || dead} onClick={() => update(stabilize)}>{t.stabilize}</Button>
      </div>
      <div className="ui-actions footer"><Button onClick={onClose}>{t.close}</Button></div>
    </Dialog>
  );
}

function DeathSaveDialog({ onRoll, onClose }: { onRoll: (natural: number) => void; onClose: () => void }) {
  const [last, setLast] = useState<number | null>(null);
  return (
    <Dialog title={t.rollSave} onClose={onClose}>
      <p className="pl-formula">d20</p>
      <div className="ui-actions"><Button variant="primary" onClick={() => { const n = rollD20(0).natural; setLast(n); onRoll(n); }}>{last ? t.rollAgain : t.roll}</Button></div>
      {last !== null && <div className="pl-result" role="status"><b>{last}</b><span>{last === 20 ? "Torni a 1 PF!" : last === 1 ? "2 fallimenti" : last >= 10 ? "Successo" : "Fallimento"}</span></div>}
      <div className="ui-actions footer"><Button onClick={onClose}>{t.close}</Button></div>
    </Dialog>
  );
}

function ShortRest({ ch, d, update, onClose }: Pick<TabProps, "ch" | "d" | "update"> & { onClose: () => void }) {
  const [log, setLog] = useState<string[]>([]);
  const die = nextHitDie(ch, d);
  return (
    <Dialog title={t.shortRest} onClose={onClose}>
      <p>{t.hitDice}: <b>{d.hp.hitDiceRemaining}</b> · {t.hp}: <b>{ch.state.hp}/{d.hp.max.value}</b></p>
      <div className="ui-actions">
        <Button disabled={!die} onClick={() => {
          const roll = 1 + Math.floor(Math.random() * die!);
          const r = spendHitDie(ch, d, roll);
          if (r) { update(() => r.character); setLog([...log, fmt(t.healedBy, { n: r.healed, d: die!, r: roll })]); }
        }}>{die ? `${t.spend} (d${die})` : t.noDice}</Button>
      </div>
      <ul>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <div className="ui-actions footer"><Button variant="primary" onClick={() => { update((c) => shortRest(c, d)); onClose(); }}>{t.endShort}</Button></div>
    </Dialog>
  );
}
