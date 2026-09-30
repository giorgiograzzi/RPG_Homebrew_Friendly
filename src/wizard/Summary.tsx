import { computeCharacter } from "../engine/compute";
import type { Ruleset } from "../engine/ruleset";
import type { Ability } from "../engine/schema";
import type { Character } from "../engine/types";
import it from "../i18n/it.json";

const t = it.wizard;
const AB = it.wizard.abilities as Record<Ability, string>;
const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

// Riepilogo con anteprima dei numeri calcolati dal motore
export function Summary({ ch, rs }: { ch: Character; rs: Ruleset }) {
  const d = computeCharacter(ch, rs);
  const cls = ch.classes.map((c) => `${rs.classes.get(c.classId)?.name.it ?? c.classId} ${c.level}`).join(" / ");
  const nm = (map: Map<string, { name: { it: string } }>, id: string) => map.get(id)?.name.it ?? id;
  return (
    <>
      <h2>{ch.name || it.characters.unnamed}</h2>
      <p className="xp-muted">{[cls, nm(rs.species, ch.speciesId), nm(rs.backgrounds, ch.backgroundId)].join(" · ")}</p>
      <div className="wz-sum">
        <div>{t.sum.hp}<b>{d.hp.max.value}</b></div>
        <div>{t.sum.ac}<b>{d.ac.value}</b></div>
        <div>{t.sum.speed}<b>{d.speed.walk.value} ft</b></div>
        <div>{t.sum.pb}<b>{sign(d.proficiencyBonus.value)}</b></div>
        <div>{t.sum.init}<b>{sign(d.initiative.value)}</b></div>
        <div>{t.sum.gold}<b>{ch.coins.gp} mo</b></div>
      </div>
      <div className="wz-sum">
        {(Object.keys(AB) as Ability[]).map((a) => <div key={a}>{AB[a]}<b>{d.scores[a].value} ({sign(d.mods[a].value)})</b></div>)}
      </div>
      {d.languages.length > 0 && <><h3>{t.sum.languages}</h3><ul className="wz-tags">{d.languages.map((l) => <li key={l}>{rs.languages.get(l)?.name.it ?? l}</li>)}</ul></>}
      {d.grantedSpells.length > 0 && <><h3>{t.sum.spells}</h3><ul className="wz-tags">{d.grantedSpells.map((s) => <li key={`${s.spell}-${s.source}`}>{rs.spells.get(s.spell)?.name.it ?? s.spell}</li>)}</ul></>}
      {ch.inventory.length > 0 && <><h3>{t.sum.equipment}</h3><ul className="wz-tags">{ch.inventory.map((i) => {
        const def = rs.weapons.get(i.itemId) ?? rs.armors.get(i.itemId) ?? rs.items.get(i.itemId) ?? rs.tools.get(i.itemId);
        return <li key={i.itemId}>{i.qty > 1 ? `${i.qty}× ` : ""}{def?.name.it ?? i.itemId}</li>;
      })}</ul></>}
      {d.warnings.length > 0 && <div className="xp-banner">{d.warnings.join(" ")}</div>}
    </>
  );
}
