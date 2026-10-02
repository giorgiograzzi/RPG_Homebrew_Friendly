import { useMemo } from "react";
import { computeCharacter } from "../engine/compute";
import type { Ruleset } from "../engine/ruleset";
import type { Character } from "../engine/types";
import { AttacksTab } from "./AttacksTab";
import { ConditionsTab } from "./ConditionsTab";
import { FeaturesTab } from "./FeaturesTab";
import { MagicTab } from "./MagicTab";
import { MiscTab } from "./MiscTab";
import { StatsTab } from "./StatsTab";
import { StatusTab } from "./StatusTab";
import type { SheetView } from "./sections";
import { Equip } from "../pages/Equip";
import { strings as it } from "../i18n";
import { useMedia, WIDE } from "../ui/useMedia";

// Viste che su schermo largo stanno tutte insieme nella panoramica a colonne
const DASHBOARD: string[] = ["status", "stats", "attacks", "magic"];

// Scheda giocabile: ogni numero viene dal motore (computeCharacter); qui si cambia solo lo stato di gioco
export function PlaySheet({ ch, rs, update, onReopen, tab, onSection }: { ch: Character; rs: Ruleset; update: (fn: (c: Character) => Character) => void; onReopen: () => void; tab: SheetView; onSection: (s: SheetView) => void }) {
  const d = useMemo(() => computeCharacter(ch, rs), [ch, rs]);
  const cls = ch.classes.map((c) => `${rs.classes.get(c.classId)?.name.it ?? c.classId} ${c.level}`).join(" / ");
  const props = { ch, rs, d, update };
  const wide = useMedia(WIDE);
  const head = <p className="ui-muted" style={{ margin: "0 0 8px" }}>{[wide && DASHBOARD.includes(tab) ? it.play.tabs.overview : it.play.tabs[tab], cls, rs.species.get(ch.speciesId)?.name.it, rs.backgrounds.get(ch.backgroundId)?.name.it].filter(Boolean).join(" · ")}</p>;
  // schermo largo: Stato, Statistiche, Attacchi e Magia affiancati in colonne (la scheda intera in una vista)
  if (wide && DASHBOARD.includes(tab)) {
    return (
      <>
        {head}
        <div className={`pl-cols${d.spellcasting.length > 0 ? " three" : ""}`}>
          <section className="pl-col" aria-label={it.play.tabs.status}><StatusTab {...props} onSection={onSection} /></section>
          <section className="pl-col" aria-label={it.play.tabs.stats}><StatsTab {...props} /><AttacksTab {...props} /></section>
          {d.spellcasting.length > 0 && <section className="pl-col" aria-label={it.play.tabs.magic}><MagicTab {...props} /></section>}
        </div>
      </>
    );
  }
  return (
    <>
      {head}
      {tab === "status" && <StatusTab {...props} onSection={onSection} />}
      {tab === "features" && <FeaturesTab {...props} />}
      {tab === "stats" && <StatsTab {...props} />}
      {tab === "attacks" && <AttacksTab {...props} />}
      {tab === "conditions" && <ConditionsTab {...props} onBack={() => onSection("status")} />}
      {tab === "equip" && <Equip />}
      {tab === "magic" && <MagicTab {...props} />}
      {tab === "misc" && <MiscTab {...props} onReopen={onReopen} />}
    </>
  );
}
