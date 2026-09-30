import { useState } from "react";
import type { Ruleset } from "../engine/ruleset";
import { slugify } from "../engine/homebrew";
import type { Character } from "../engine/types";
import { downloadBytes } from "../export/download";
import it from "../i18n/it.json";
import { fmt } from "../ui/format";
import { Button } from "../ui/xp";

const t = it.wizard.sheet;
// Il modello sta in public/forms: lo legge il service worker dalla cache (anche offline), altrimenti dalla rete solo quando serve
const TEMPLATE = `${import.meta.env.BASE_URL}forms/scheda-2024-it.pdf`;

// "Stampa scheda": scrive il personaggio sulla scheda ufficiale 2024 in italiano e la scarica come PDF
export function SheetButton({ ch, rs }: { ch: Character; rs: Ruleset }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [url, setUrl] = useState("");
  const run = async () => {
    setState("busy"); setMsg("");
    try {
      const res = await fetch(TEMPLATE);
      if (!res.ok) throw new Error(`modello non trovato (${res.status})`);
      const [{ buildSheetData }, { fillSheet }] = await Promise.all([import("../export/sheetData"), import("../export/sheetPdf")]);
      const bytes = await fillSheet(await res.arrayBuffer(), buildSheetData(ch, rs));
      setUrl(downloadBytes(bytes, `scheda-${slugify(ch.name) || "personaggio"}.pdf`, "application/pdf"));
      setState("done");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e)); setState("error");
    }
  };
  return (
    <div>
      <p className="xp-muted">{t.help}</p>
      <div className="xp-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <Button onClick={() => void run()} disabled={state === "busy"}>{state === "busy" ? t.busy : t.button}</Button>
        {state === "done" && <a className="xp-btn" href={url} target="_blank" rel="noreferrer">{t.open}</a>}
      </div>
      {state === "done" && <p role="status">{fmt(t.done, { name: ch.name || it.characters.unnamed })}</p>}
      {state === "error" && <div className="xp-error" role="alert">{fmt(t.error, { e: msg })}</div>}
    </div>
  );
}
