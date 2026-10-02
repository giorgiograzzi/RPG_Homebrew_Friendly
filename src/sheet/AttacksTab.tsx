import { useState } from "react";
import type { AttackOption } from "../engine/compute/types";
import { strings as it } from "../i18n";
import { fmt } from "../ui/format";
import type { Character } from "../engine/types";
import { ChargeControls, DamageRoller, RollDialog, type ChargeRes } from "./dialogs";
import type { TabProps } from "./types";
import { sign } from "./util";
import { tr } from "../i18n/tr";

const t = it.play;

export function AttacksTab({ rs, d, update }: TabProps) {
  const [sel, setSel] = useState<AttackOption | null>(null);
  return (
    <>
      <p className="ui-muted">{fmt(t.perAction, { n: d.attacksPerAction })}</p>
      {d.attacks.length === 0 && <p className="ui-muted">{t.noAttacks}</p>}
      <ul className="pl-list">
        {d.attacks.map((a) => (
          <li key={`${a.id}-${a.offhand}-${a.thrown}-${a.hands}`}><button type="button" onClick={() => setSel(a)}>
            <span className="nm">{a.label}<br /><span className="pl-sub">{dmgText(a, rs)}{d.resources[`item:${a.id}`] ? ` · ${t.charges} ${d.resources[`item:${a.id}`]!.remaining}/${d.resources[`item:${a.id}`]!.max.value}` : ""}{a.mastery ? ` · ${a.mastery.name}${a.mastery.active ? "" : ` (${tr("non attiva", "inactive")})`}` : ""}</span></span>
            <span className="val">{sign(a.toHit.value)}</span>
          </button></li>
        ))}
      </ul>
      {sel && <AttackRollDialog a={sel} rs={rs} resources={d.resources} update={update} onClose={() => setSel(null)} />}
    </>
  );
}

// Tiro per colpire e per il danno di un attacco (usato dalla scheda e dalla tab Equip)
export function AttackRollDialog({ a, rs, resources, update, onClose }: { a: AttackOption; rs: TabProps["rs"]; resources?: Record<string, ChargeRes>; update?: (fn: (c: Character) => Character) => void; onClose: () => void }) {
  const charges = resources?.[`item:${a.id}`];
  return (
    <RollDialog title={`${a.label} — ${t.attackRoll}`} bonus={a.toHit} mode={a.mode} modeSources={a.modeSources} hint={t.attackD20}
      note={[...a.notes, ...a.riders].join(" · ") || undefined} onClose={onClose}
      extra={<>{charges && update && <div style={{ marginTop: 12 }}><h3>{t.charges}</h3><ChargeControls id={`item:${a.id}`} name={a.label} r={charges} update={update} /></div>}<DamageSection a={a} rs={rs} /></>} />
  );
}

// Danno: se vuoi il critico, spunta la casella (dopo aver visto il d20 naturale)
function DamageSection({ a, rs }: { a: AttackOption; rs: TabProps["rs"] }) {
  const [crit, setCrit] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <h3>{t.damageTitle}</h3>
      <label className="ui-check"><input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} /><span>{t.crit} ({a.critRange < 20 ? `${a.critRange}–20` : "20"})</span></label>
      <DamageRoller dice={a.damage.dice} bonus={a.damage.bonus.value} type={rs.damageTypes.get(a.damage.type)?.name.it ?? a.damage.type} crit={crit} />
    </div>
  );
}

const dmgText = (a: AttackOption, rs: TabProps["rs"]) =>
  `${a.damage.dice} ${sign(a.damage.bonus.value)} ${rs.damageTypes.get(a.damage.type)?.name.it ?? a.damage.type}`;
