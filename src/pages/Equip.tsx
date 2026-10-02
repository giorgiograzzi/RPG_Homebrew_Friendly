import { useMemo, useState } from "react";
import { useRuleset } from "../data/ruleset";
import { computeCharacter } from "../engine/compute";
import type { AttackOption } from "../engine/compute/types";
import {
  analyzeLoadout, buyItem, equipItem, formatCost, lookupItem, needsAttunement, setAttuned, setQty, shopCatalog, walletCp, type EquipTime,
} from "../engine/equipment";
import type { Character, EquipState } from "../engine/types";
import { strings as it } from "../i18n";
import { fmt } from "../ui/format";
import { Button, Dialog, Segmented } from "../ui/theme";
import { useApp } from "../ui/useApp";
import { AttackRollDialog } from "../sheet/AttacksTab";
import { ChargeControls, SourcesDialog } from "../sheet/dialogs";
import { sign } from "../sheet/util";
import { isFinalized } from "../wizard/logic";
import { weight } from "../ui/units";

const t = it.equip;
const timeText = (x: EquipTime) => {
  const parts = [x.minutes ? fmt(t.time.minutes, { n: x.minutes }) : "", x.action ? t.time.action : ""].filter(Boolean);
  return `${x.note}${parts.length ? ` (${parts.join(", ")})` : ""}`;
};

export function Equip() {
  const rs = useRuleset();
  const ch = useApp((s) => s.current);
  const update = useApp((s) => s.update);
  const weaponSwap = useApp((s) => s.settings.weaponSwap);
  const [error, setError] = useState("");
  const [last, setLast] = useState("");
  const [shop, setShop] = useState(false);
  const [ac, setAc] = useState(false);
  const [discard, setDiscard] = useState<{ id: string; name: string } | null>(null);
  const [attack, setAttack] = useState<AttackOption | null>(null);
  const d = useMemo(() => (ch ? computeCharacter(ch, rs) : null), [ch, rs]);
  if (!ch || !d) return <p className="ui-muted">{it.soon.needCharacter}</p>;
  if (!isFinalized(ch)) return <><h2>{t.title}</h2><p className="ui-muted">{t.needCreation}</p></>;

  const load = analyzeLoadout(ch, rs);
  const equip = (id: string, target: EquipState, grip?: "one" | "two") => {
    const r = equipItem(ch, rs, id, target, { weaponSwap }, grip);
    if (r.problems.length) { setError(r.problems.join(" ")); return; }
    setError(""); setLast(timeText(r.time)); update(() => r.character);
  };
  const apply = (r: { ok: boolean; errors: string[]; character: Character }) => { if (!r.ok) { setError(r.errors.join(" ")); return; } setError(""); update(() => r.character); };

  return (
    <>
      <h2>{t.title}</h2>
      {error && <div className="ui-error" role="alert">{error}</div>}
      {load.problems.length > 0 && <div className="ui-banner">{load.problems.join(" · ")}</div>}
      {last && <p className="ui-muted" role="status">{t.last}: {last}</p>}

      <div className="pl-grid">
        <button type="button" className="pl-tile" onClick={() => setAc(true)}>{t.ac}<b>{d.ac.value}</b><span className="pl-sub">{d.ac.formula}</span></button>
        <div className="pl-tile" style={{ cursor: "default" }}>{t.hands}<b>{load.handsUsed} / 2</b></div>
        <div className="pl-tile" style={{ cursor: "default" }}>{t.weight}<b>{weight(load.weight)} / {weight(d.carryCapacity)}</b></div>
        <div className="pl-tile" style={{ cursor: "default" }}>{t.attune}<b>{load.attuned} / 3</b></div>
      </div>

      <h3>{t.attacks}</h3>
      {d.attacks.length === 0 ? <p className="ui-muted">{t.noAttacks}</p> : (
        <ul className="pl-list">
          {d.attacks.map((a) => (
            <li key={`${a.id}-${a.offhand}-${a.thrown}-${a.hands}`}><button type="button" onClick={() => setAttack(a)}>
              <span className="nm">{a.label}<br /><span className="pl-sub">{a.damage.dice} {sign(a.damage.bonus.value)} {rs.damageTypes.get(a.damage.type)?.name.it ?? a.damage.type}</span></span>
              <span className="val">{sign(a.toHit.value)}</span>
            </button></li>
          ))}
        </ul>
      )}

      <div className="pl-row"><h3 style={{ flex: 1, margin: 0 }}>{t.inventory}</h3><Button variant="primary" onClick={() => setShop(true)}>{t.shop}</Button></div>
      {ch.inventory.length === 0 && <p className="ui-muted">{t.empty}</p>}
      <ul className="pl-list">
        {ch.inventory.map((e) => {
          const f = lookupItem(rs, e.itemId);
          const def = f?.def as { name: { it: string }; weight?: number; cost?: number; description?: string } | undefined;
          return (
            <li key={e.itemId} className="pl-feat">
              <div className="pl-cond" style={{ cursor: "default" }}>
                <span className="nm">
                  <b>{def?.name.it ?? e.itemId}</b>{e.attuned && <span className="pl-badge"> {t.attuned}</span>}
                  <br /><span className="pl-sub">{e.qty} × {weight(def?.weight ?? 0)} · {formatCost((def?.cost ?? 0) * e.qty)} · {t.state[e.state]}{e.grip && e.state === "wielded" && f?.kind === "weapon" && f.def.properties.includes("versatile") ? ` · ${e.grip === "two" ? t.twoHands : t.oneHand}` : ""}</span>
                  {def?.description && <><br /><span className="pl-sub">{def.description}</span></>}
                </span>
              </div>
              <div className="pl-row" style={{ padding: "0 12px 8px" }}>
                {d?.resources[`item:${e.itemId}`] && <ChargeControls id={`item:${e.itemId}`} name={def?.name.it ?? e.itemId} r={d.resources[`item:${e.itemId}`]!} update={update} />}
                {f?.kind === "weapon" && (e.state === "wielded"
                  ? <Button onClick={() => equip(e.itemId, "stowed")}>{t.stow}</Button>
                  : <Button variant="primary" onClick={() => equip(e.itemId, "wielded")}>{t.wield}</Button>)}
                {f?.kind === "weapon" && e.state === "wielded" && f.def.properties.includes("versatile") && (
                  <Segmented<"one" | "two"> label={t.oneHand} value={e.grip === "two" ? "two" : "one"} onChange={(g) => equip(e.itemId, "wielded", g)}
                    options={[{ value: "one", label: t.oneHand }, { value: "two", label: t.twoHands }]} />
                )}
                {f?.kind === "armor" && (e.state === "worn"
                  ? <Button onClick={() => equip(e.itemId, "stowed")}>{t.remove}</Button>
                  : <Button variant="primary" onClick={() => equip(e.itemId, "worn")}>{t.wear}</Button>)}
                {f && needsAttunement(f) && (
                  <Button onClick={() => apply(setAttuned(ch, rs, e.itemId, !e.attuned))}>{e.attuned ? t.attuneOff : t.attuneOn}</Button>
                )}
                <Button aria-label={`${t.qtyMinus} ${def?.name.it ?? e.itemId}`} onClick={() => (e.qty <= 1 ? setDiscard({ id: e.itemId, name: def?.name.it ?? e.itemId }) : update((c) => setQty(c, e.itemId, e.qty - 1)))}>−</Button>
                <Button aria-label={`${t.qtyPlus} ${def?.name.it ?? e.itemId}`} onClick={() => update((c) => setQty(c, e.itemId, e.qty + 1))}>+</Button>
                <Button variant="danger" aria-label={`${t.discard} ${def?.name.it ?? e.itemId}`} onClick={() => setDiscard({ id: e.itemId, name: def?.name.it ?? e.itemId })}>✕</Button>
              </div>
            </li>
          );
        })}
      </ul>

      {discard && (
        <Dialog title={t.discardTitle} onClose={() => setDiscard(null)}>
          <p>{fmt(t.discardAsk, { n: discard.name })}</p>
          <div className="ui-actions">
            <Button onClick={() => setDiscard(null)}>{it.homebrew.cancel}</Button>
            <Button variant="danger" onClick={() => { update((c) => setQty(c, discard.id, 0)); setDiscard(null); }}>{t.discard}</Button>
          </div>
        </Dialog>
      )}
      {ac && <SourcesDialog title={t.ac} value={d.ac} onClose={() => setAc(false)} />}
      {attack && <AttackRollDialog a={attack} rs={rs} resources={d?.resources} update={update} onClose={() => setAttack(null)} />}
      {shop && <Shop ch={ch} onBuy={(id) => { const r = buyItem(ch, rs, id); if (r.ok) update(() => r.character); return r; }} onClose={() => setShop(false)} />}
    </>
  );
}

function Shop({ ch, onBuy, onClose }: { ch: Character; onBuy: (id: string) => { ok: boolean; errors: string[] }; onClose: () => void }) {
  const rs = useRuleset();
  const catalog = useMemo(() => shopCatalog(rs), [rs]);
  // Interruttore nella barra del titolo: stesse sezioni, ma solo voci homebrew oppure solo voci del Manuale
  const [hb, setHb] = useState(false);
  const source = useMemo(() => catalog.filter((c) => c.homebrew === hb), [catalog, hb]);
  const groups = [...new Set(source.map((c) => c.group))];
  const [group, setGroup] = useState("all");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const current = group === "all" || groups.includes(group) ? group : "all";
  const rows = source.filter((c) => (current === "all" || c.group === current) && (!q || c.name.toLowerCase().includes(q.toLowerCase())));
  const LIMIT = 80;
  const shown = rows.slice(0, LIMIT);
  return (
    <Dialog title={t.shop} onClose={onClose}
      titleAction={{ label: hb ? t.showManual : t.showHomebrew, icon: "homebrew", pressed: hb, onClick: () => setHb(!hb) }}>
      <p>{t.funds}: <b>{formatCost(walletCp(ch.coins))}</b></p>
      <p className="ui-muted" role="status">{hb ? t.sourceHomebrew : t.sourceManual}</p>
      <div className="pl-tabs" role="group" aria-label={t.shop}>
        <button type="button" aria-pressed={current === "all"} onClick={() => setGroup("all")}>{t.all}</button>
        {groups.map((g) => <button key={g} type="button" aria-pressed={current === g} onClick={() => setGroup(g)}>{g}</button>)}
      </div>
      <input className="ui-input" style={{ marginBottom: 8 }} type="search" placeholder={t.search} aria-label={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
      {msg && <p role="status"><b>{msg}</b></p>}
      {rows.length === 0 && <p className="ui-muted">{hb ? t.noHomebrew : t.noResults}</p>}
      <ul className="ui-list">
        {shown.map((c) => (
          <li key={`${c.kind}-${c.id}`} style={{ display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="grow"><div className="name">{c.name}</div><div className="ui-muted">{c.group} · {c.cost > 0 ? formatCost(c.cost) : t.free} · {weight(c.weight)}</div>{c.description && <div className="ui-muted">{c.description}</div>}</div>
              <Button disabled={walletCp(ch.coins) < c.cost} onClick={() => { const r = onBuy(c.id); setMsg(r.ok ? fmt(t.bought, { n: c.name }) : r.errors.join(" ")); }}>{t.buy}</Button>
            </div>
          </li>
        ))}
      </ul>
      {rows.length > LIMIT && <p className="ui-muted">{fmt(t.more, { n: LIMIT })}</p>}
      <div className="ui-actions footer"><Button onClick={onClose}>{it.play.close}</Button></div>
    </Dialog>
  );
}
