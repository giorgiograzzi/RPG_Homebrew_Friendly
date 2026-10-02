import { useMemo, useState } from "react";
import { allQuestions } from "../engine/creation";
import {
  PREPARATION, castSpell, concentrationBroken, endConcentration, magicalCunning, recoverSlots, recoveryLimit, spellbook, type CastVia, type SpellEntry,
} from "../engine/magic";
import { toggleSlot } from "../engine/play";
import { strings as it } from "../i18n";
import { fmt } from "../ui/format";
import { Button, Dialog } from "../ui/theme";
import { QuestionView } from "../wizard/QuestionView";
import { choose } from "../wizard/logic";
import { SourcesDialog } from "./dialogs";
import type { TabProps } from "./types";
import { AB, sign } from "./util";

const t = it.magic;
type Filter = "all" | "prepared" | "ritual" | "conc";
const levelName = (n: number) => (n === 0 ? t.cantrips : fmt(t.levelN, { n }));

export function MagicTab({ ch, rs, d, update }: TabProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<SpellEntry | null>(null);
  const [prep, setPrep] = useState(false);
  const [rec, setRec] = useState(false);
  const [stat, setStat] = useState<null | "dc" | "attack">(null);
  const book = useMemo(() => spellbook(ch, rs, d), [ch, rs, d]);
  const slots = d.spellSlots;
  const hasSlots = slots.slots.some((n) => n > 0) || !!slots.pact;
  if (!book.length && !hasSlots) return <><h2>{t.title}</h2><p className="ui-muted">{t.none}</p></>;

  const conc = ch.state.concentration;
  const shown = book.filter((e) => (filter === "all" || (filter === "prepared" && e.castable) || (filter === "ritual" && e.ritualOk) || (filter === "conc" && e.spell.concentration))
    && (!q || e.spell.name.it.toLowerCase().includes(q.toLowerCase())));
  const levels = [...new Set(shown.map((e) => e.spell.level))];
  const first = d.spellcasting[0];
  const recoveries = [
    ...(d.resources.arcane_recovery ? [{ id: "arcane_recovery" as const, cls: "wizard" }] : []),
    ...(d.resources.natural_recovery ? [{ id: "natural_recovery" as const, cls: "druid" }] : []),
  ];
  const canCunning = !!d.resources.magical_cunning;

  return (
    <>
      <h2>{t.title}</h2>
      {first && (
        <div className="pl-grid">
          <button type="button" className="pl-tile" onClick={() => setStat("dc")}>{t.dc}<b>{first.dc.value}</b><span className="pl-sub">{AB[first.ability]}</span></button>
          <button type="button" className="pl-tile" onClick={() => setStat("attack")}>{t.attack}<b>{sign(first.attack.value)}</b><span className="pl-sub">{AB[first.ability]}</span></button>
        </div>
      )}
      {d.spellcastingBlocked && <div className="ui-error" role="alert">{it.play.tabs.magic}: non puoi lanciare incantesimi ora (armatura senza addestramento, Ira, azioni bloccate).</div>}
      {conc && (
        <div className="ui-banner" role="status">
          <b>{fmt(t.concentrating, { n: rs.spells.get(conc)?.name.it ?? conc })}</b>
          {concentrationBroken(d) && <span> {t.broken}</span>}
          <div className="ui-actions" style={{ justifyContent: "flex-start", margin: "8px 0 0" }}><Button onClick={() => update(endConcentration)}>{t.endConc}</Button></div>
        </div>
      )}

      {hasSlots && (
        <>
          <h3>{t.slots}</h3>
          <ul className="pl-list">
            {slots.slots.map((total, i) => total > 0 && (
              <li key={i}><div className="pl-cond" style={{ cursor: "default" }}>
                <span className="nm">{fmt(t.levelN, { n: i + 1 })}</span><span className="val">{slots.remaining[i]}/{total}</span>
                <Button aria-label={`${t.use} ${i + 1}`} disabled={slots.remaining[i]! <= 0} onClick={() => update((c) => toggleSlot(c, i + 1, total, 1))}>{t.use}</Button>
                <Button aria-label={`${t.restore} ${i + 1}`} disabled={slots.used[i]! <= 0} onClick={() => update((c) => toggleSlot(c, i + 1, total, -1))}>{t.restore}</Button>
              </div></li>
            ))}
            {slots.pact && (
              <li><div className="pl-cond" style={{ cursor: "default" }}>
                <span className="nm">{fmt(t.pact, { n: slots.pact.level })}</span><span className="val">{slots.pact.remaining}/{slots.pact.count}</span>
                <Button aria-label={`${t.use} patto`} disabled={slots.pact.remaining <= 0} onClick={() => update((c) => ({ ...c, state: { ...c.state, pactUsed: (c.state.pactUsed ?? 0) + 1 } }))}>{t.use}</Button>
                <Button aria-label={`${t.restore} patto`} disabled={slots.pact.used <= 0} onClick={() => update((c) => ({ ...c, state: { ...c.state, pactUsed: slots.pact!.used - 1 || undefined } }))}>{t.restore}</Button>
              </div></li>
            )}
          </ul>
        </>
      )}

      <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <Button onClick={() => setPrep(true)}>{t.prepare}</Button>
        {(recoveries.length > 0 || canCunning) && <Button onClick={() => setRec(true)}>{t.recoveries}</Button>}
      </div>

      <div className="pl-tabs" role="group" aria-label={t.title}>
        {(["all", "prepared", "ritual", "conc"] as const).map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{t.filters[f]}</button>)}
      </div>
      <input className="ui-input" style={{ marginBottom: 8 }} type="search" placeholder={t.search} aria-label={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length === 0 && <p className="ui-muted">{t.empty}</p>}
      {levels.map((lv) => (
        <section key={lv}>
          <h3>{levelName(lv)}</h3>
          <ul className="pl-list">
            {shown.filter((e) => e.spell.level === lv).map((e) => {
              const free = e.sources.find((s) => s.free)?.free;
              return (
                <li key={e.id}><button type="button" onClick={() => setOpen(e)}>
                  <span className="nm"><b>{e.spell.name.it}</b>{conc === e.id && <span className="pl-badge"> ●</span>}
                    <br /><span className="pl-sub">{[...new Set(e.sources.map((s) => t.statusTags[s.kind]))].join(", ")}{e.spell.concentration ? " · ◆" : ""}{e.spell.ritual ? " · ®" : ""}{free ? ` · ${free.remaining}/${free.max}` : ""}</span></span>
                </button></li>
              );
            })}
          </ul>
        </section>
      ))}

      {open && <SpellDialog entry={open} {...{ ch, rs, d, update }} onClose={() => setOpen(null)} />}
      {prep && <PrepareDialog {...{ ch, rs, update }} onClose={() => setPrep(false)} />}
      {rec && <RecoveryDialog {...{ ch, d, update }} recoveries={recoveries} cunning={canCunning} onClose={() => setRec(false)} />}
      {stat && first && <SourcesDialog title={stat === "dc" ? t.dc : t.attack} value={stat === "dc" ? first.dc : first.attack} onClose={() => setStat(null)} />}
    </>
  );
}

const castTime = (c: { unit: keyof typeof t.time; amount: number }) =>
  c.unit === "minute" ? `${c.amount} ${c.amount === 1 ? "minuto" : "minuti"}` : c.unit === "hour" ? `${c.amount} ${c.amount === 1 ? "ora" : "ore"}` : `${c.amount > 1 ? `${c.amount} ` : ""}${t.time[c.unit]}`;

function resolutionText(e: SpellEntry): string {
  const r = e.spell.resolution, s = e.sources.find((x) => x.dc !== undefined);
  if (r.startsWith("save_")) return fmt(t.resolution.save, { a: AB[r.slice(5) as keyof typeof AB], dc: s?.dc ?? "?" });
  if (r === "attack_melee") return fmt(t.resolution.melee, { b: s?.attack !== undefined ? sign(s.attack) : "" });
  if (r === "attack_ranged") return fmt(t.resolution.ranged, { b: s?.attack !== undefined ? sign(s.attack) : "" });
  return e.spell.resolutionRaw ?? "";
}

function SpellDialog({ entry, ch, rs, d, update, onClose }: TabProps & { entry: SpellEntry; onClose: () => void }) {
  const sp = entry.spell;
  const [msg, setMsg] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const run = (via: CastVia) => {
    const r = castSpell(ch, rs, d, entry.id, via);
    if (r.ok) update(() => r.character);
    setMsg({ ok: r.ok, lines: r.ok ? [`${sp.name.it}${r.level ? ` (${r.level}°)` : ""}: lanciato.`, ...r.notes] : r.errors });
  };
  const c = sp.components;
  const comps = [c.v ? "V" : "", c.s ? "S" : "", c.m ? `M${c.material ? ` (${c.material})` : ""}` : ""].filter(Boolean).join(", ");
  const opts: { key: string; label: string; via: CastVia; disabled?: boolean }[] = [];
  if (sp.level === 0 && entry.castable) opts.push({ key: "cantrip", label: t.castCantrip, via: { kind: "cantrip" } });
  if (sp.level > 0 && entry.castable) {
    d.spellSlots.slots.forEach((total, i) => {
      if (total > 0 && i + 1 >= sp.level) opts.push({ key: `slot${i + 1}`, label: fmt(t.castSlot, { n: i + 1, r: d.spellSlots.remaining[i]! }), via: { kind: "slot", level: i + 1 }, disabled: d.spellSlots.remaining[i]! <= 0 });
    });
    const p = d.spellSlots.pact;
    if (p && p.level >= sp.level) opts.push({ key: "pact", label: fmt(t.castPact, { n: p.level, r: p.remaining }), via: { kind: "pact" }, disabled: p.remaining <= 0 });
  }
  for (const s of entry.sources) if (s.free) opts.push({ key: s.free.resourceId + s.label, label: `${fmt(t.castFree, { r: s.free.remaining, m: s.free.max })} — ${s.label}`, via: { kind: "free", resourceId: s.free.resourceId }, disabled: s.free.remaining <= 0 });
  if (entry.ritualOk) opts.push({ key: "ritual", label: t.castRitual, via: { kind: "ritual" } });

  return (
    <Dialog title={sp.name.it} onClose={onClose}>
      <p className="ui-muted">{levelName(sp.level)} · {t.school[sp.school]}{sp.concentration ? " · ◆ " + t.concentration : ""}{sp.ritual ? " · ® Rituale" : ""}</p>
      <ul className="pl-src">
        <li><span>{t.castingTime}</span><b>{castTime(sp.castingTime)}{sp.castingTime.trigger ? ` (${sp.castingTime.trigger})` : ""}</b></li>
        <li><span>{t.range}</span><b>{sp.range}</b></li>
        <li><span>{t.components}</span><b>{comps || "—"}</b></li>
        <li><span>{t.duration}</span><b>{sp.duration}</b></li>
      </ul>
      {resolutionText(entry) && <p><b>{resolutionText(entry)}</b></p>}
      <p>{sp.summary}</p>
      {sp.higherLevels && <p className="ui-muted"><b>{t.higher}:</b> {sp.higherLevels}</p>}
      <p className="ui-muted">{entry.sources.map((s) => `${s.label} (${t.statusTags[s.kind]})`).join(" · ")}</p>
      {msg && <div className={msg.ok ? "ui-banner" : "ui-error"} role={msg.ok ? "status" : "alert"}>{msg.lines.map((l) => <div key={l}>{l}</div>)}</div>}
      <div className="pl-row">
        {opts.length === 0 && <span className="ui-muted">{t.cantCast}</span>}
        {opts.map((o) => <Button key={o.key} variant="primary" disabled={o.disabled} onClick={() => run(o.via)}>{o.label}</Button>)}
      </div>
      <div className="ui-actions footer"><Button onClick={onClose}>{it.play.close}</Button></div>
    </Dialog>
  );
}

// Preparare: le stesse scelte della creazione (numero e livelli degli slot), modificabili in ogni momento
function PrepareDialog({ ch, rs, update, onClose }: Pick<TabProps, "ch" | "rs" | "update"> & { onClose: () => void }) {
  const [note, setNote] = useState("");
  const qs = allQuestions(ch, rs).filter((x) => x.kind === "choice" && !!x.classId && /(_prepared|_cantrips|_spellbook)$/.test(x.key) && !x.disabled);
  const classes = [...new Set(qs.map((x) => x.classId).filter(Boolean))] as string[];
  return (
    <Dialog title={t.prepareTitle} onClose={onClose}>
      {qs.length === 0 && <p className="ui-muted">{t.noPrepare}</p>}
      {classes.map((cid) => PREPARATION[cid] && (
        <p key={cid} className="ui-muted"><b>{rs.classes.get(cid)?.name.it}</b> — {fmt(t.prepareWhen, { w: PREPARATION[cid]!.when })} · {fmt(t.prepareFocus, { f: PREPARATION[cid]!.focus })}</p>
      ))}
      {note && <div className="ui-banner" role="status">{note}</div>}
      {qs.map((x) => (
        <QuestionView key={x.key} q={x} onPick={(key, picked) => {
          const r = choose(ch, rs, key, picked);
          if (!r.ok) { setNote(r.errors.join(" ")); return; }
          update(() => r.character);
          setNote(r.removed.length ? `${t.prepared} (annullate: ${r.removed.map((z) => z.key).join(", ")})` : t.prepared);
        }} />
      ))}
      <div className="ui-actions footer"><Button onClick={onClose}>{it.play.close}</Button></div>
    </Dialog>
  );
}

function RecoveryDialog({ ch, d, update, recoveries, cunning, onClose }: Pick<TabProps, "ch" | "d" | "update"> & { recoveries: { id: "arcane_recovery" | "natural_recovery"; cls: string }[]; cunning: boolean; onClose: () => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [msg, setMsg] = useState("");
  const rec = recoveries[0];
  const classLevel = rec ? ch.classes.find((c) => c.classId === rec.cls)?.level ?? 0 : 0;
  const limit = recoveryLimit(classLevel);
  const total = picked.reduce((n, l) => n + l, 0);
  const warlock = ch.classes.find((c) => c.classId === "warlock")?.level ?? 0;
  return (
    <Dialog title={t.recoveries} onClose={onClose}>
      {rec && (
        <>
          <h3>{t.arcane}</h3>
          <p className="ui-muted">{fmt(t.arcaneHelp, { n: limit })}</p>
          <ul className="pl-list">
            {d.spellSlots.slots.map((_n, i) => i < 5 && (d.spellSlots.used[i] ?? 0) > 0 && (
              <li key={i}><div className="pl-cond" style={{ cursor: "default" }}>
                <span className="nm">{fmt(t.levelN, { n: i + 1 })} — spesi {d.spellSlots.used[i]}</span>
                <span className="val">{picked.filter((l) => l === i + 1).length}</span>
                <Button aria-label={fmt(it.play.lessN, { n: i + 1 })} disabled={!picked.includes(i + 1)} onClick={() => setPicked((p) => { const k = p.indexOf(i + 1); return p.filter((_, j) => j !== k); })}>−</Button>
                <Button aria-label={`Più ${i + 1}`} disabled={picked.filter((l) => l === i + 1).length >= (d.spellSlots.used[i] ?? 0) || total + i + 1 > limit} onClick={() => setPicked((p) => [...p, i + 1])}>+</Button>
              </div></li>
            ))}
          </ul>
          <p>Totale livelli: <b>{total}/{limit}</b></p>
          <div className="ui-actions"><Button variant="primary" disabled={!picked.length} onClick={() => {
            const r = recoverSlots(ch, d, rec.id, classLevel, picked);
            if (r.ok) { update(() => r.character); setPicked([]); setMsg(t.done); } else setMsg(r.errors.join(" "));
          }}>{t.recover}</Button></div>
        </>
      )}
      {cunning && (
        <>
          <h3>{t.cunning}</h3>
          <div className="ui-actions"><Button variant="primary" onClick={() => { const r = magicalCunning(ch, d, warlock); if (r.ok) { update(() => r.character); setMsg(t.done); } else setMsg(r.errors.join(" ")); }}>{t.recover}</Button></div>
        </>
      )}
      {msg && <div className="ui-banner" role="status">{msg}</div>}
      <div className="ui-actions footer"><Button onClick={onClose}>{it.play.close}</Button></div>
    </Dialog>
  );
}

