import { computeCharacter } from "../engine/compute";
import { characterSize } from "../engine/creation";
import { tr } from "../i18n/tr";
import type { Ruleset } from "../engine/ruleset";
import type { Ability } from "../engine/schema";
import type { Character } from "../engine/types";
import { strings as it } from "../i18n";
import { distance } from "../ui/units";

const t = it.wizard;
const AB = it.wizard.abilities as Record<Ability, string>;
const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

// Riepilogo con anteprima dei numeri calcolati dal motore
export function Summary({ ch, rs }: { ch: Character; rs: Ruleset }) {
  const d = computeCharacter(ch, rs);
  const cls = ch.classes.map((c) => `${rs.classes.get(c.classId)?.name.it ?? c.classId} ${c.level}`).join(" / ");
  const nm = (map: Map<string, { name: { it: string } }>, id: string) => map.get(id)?.name.it ?? id;
  const skills = (Object.entries(d.skills) as [string, { proficiency: string }][]).filter(([, s]) => s.proficiency === "proficient" || s.proficiency === "expertise")
    .map(([id, s]) => ({ id, name: rs.skills.get(id)?.name.it ?? id, expertise: s.proficiency === "expertise" }));
  const armor: Record<string, string> = { light: tr("Armature leggere", "Light armor"), medium: tr("Armature medie", "Medium armor"), heavy: tr("Armature pesanti", "Heavy armor"), shield: tr("Scudi", "Shields") };
  const profs = [...d.proficiencies.armor.map((a) => armor[a] ?? a),
    ...d.proficiencies.weapons.map((w) => (w === "simple" ? tr("Armi semplici", "Simple weapons") : w === "martial" ? tr("Armi da guerra", "Martial weapons") : rs.weapons.get(w)?.name.it ?? w.replace("[", " (").replace("]", ")"))),
    ...d.proficiencies.tools.map((x) => rs.tools.get(x)?.name.it ?? x)];
  return (
    <>
      <h2>{ch.name || it.characters.unnamed}</h2>
      <p className="ui-muted">{[cls, nm(rs.species, ch.speciesId), nm(rs.backgrounds, ch.backgroundId), characterSize(ch, rs) ? nm(rs.sizes, characterSize(ch, rs)!) : ""].filter(Boolean).join(" · ")}</p>
      <div className="wz-sum">
        <div>{t.sum.hp}<b>{d.hp.max.value}</b></div>
        <div>{t.sum.ac}<b>{d.ac.value}</b></div>
        <div>{t.sum.speed}<b>{distance(d.speed.walk.value)}</b></div>
        <div>{t.sum.pb}<b>{sign(d.proficiencyBonus.value)}</b></div>
        <div>{t.sum.init}<b>{sign(d.initiative.value)}</b></div>
        <div>{t.sum.gold}<b>{ch.coins.gp} {tr("mo", "gp")}</b></div>
      </div>
      <div className="wz-sum">
        {(Object.keys(AB) as Ability[]).map((a) => <div key={a}>{AB[a]}<b>{d.scores[a].value} ({sign(d.mods[a].value)})</b></div>)}
      </div>
      <h3>{t.sum.saves}</h3><ul className="wz-tags">{(Object.keys(AB) as Ability[]).filter((a) => d.saves[a].proficient).map((a) => <li key={a}>{AB[a]}</li>)}</ul>
      {skills.length > 0 && <><h3>{t.sum.skills}</h3><ul className="wz-tags">{skills.map((s) => <li key={s.id}>{s.name}{s.expertise ? " ◆" : ""}</li>)}</ul></>}
      {profs.length > 0 && <><h3>{t.sum.profs}</h3><ul className="wz-tags">{profs.map((p) => <li key={p}>{p}</li>)}</ul></>}
      {d.featureList.length > 0 && <><h3>{t.sum.features}</h3><ul className="wz-tags">{[...new Set(d.featureList.map((f) => f.name))].map((n) => <li key={n}>{n}</li>)}</ul></>}
      {d.languages.length > 0 && <><h3>{t.sum.languages}</h3><ul className="wz-tags">{d.languages.map((l) => <li key={l}>{rs.languages.get(l)?.name.it ?? l}</li>)}</ul></>}
      {d.grantedSpells.length > 0 && <><h3>{t.sum.spells}</h3><ul className="wz-tags">{[...new Map(d.grantedSpells.map((s) => [`${s.spell}-${s.source}`, s])).values()].map((s) => <li key={`${s.spell}-${s.source}`}>{rs.spells.get(s.spell)?.name.it ?? s.spell}</li>)}</ul></>}
      {ch.inventory.length > 0 && <><h3>{t.sum.equipment}</h3><ul className="wz-tags">{ch.inventory.map((i) => {
        const def = rs.weapons.get(i.itemId) ?? rs.armors.get(i.itemId) ?? rs.items.get(i.itemId) ?? rs.tools.get(i.itemId);
        return <li key={i.itemId}>{i.qty > 1 ? `${i.qty}× ` : ""}{def?.name.it ?? i.itemId}</li>;
      })}</ul></>}
      {d.warnings.length > 0 && <div className="ui-banner">{d.warnings.join(" ")}</div>}
    </>
  );
}
