import { useState } from "react";
import regularUrl from "@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff?url";
import boldUrl from "@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff?url";
import type { Ruleset } from "../engine/ruleset";
import type { Character } from "../engine/types";
import { downloadBytes } from "../export/download";
import { lang, strings as it } from "../i18n";
import { fmt } from "../ui/format";
import { Button } from "../ui/theme";

const t = it.wizard.sheet;
const bytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());

// «Stampa scheda (PDF)»: il generatore (pdf-lib + font) si carica solo quando serve, e il font Noto Sans sta nella cache offline dell'app
export function PdfButton({ ch, rs }: { ch: Character; rs: Ruleset }) {
  const [state, setState] = useState<{ busy?: boolean; url?: string; error?: string }>({});
  const run = async () => {
    setState({ busy: true });
    try {
      const [{ makeSheetPdf }, regular, bold] = await Promise.all([import("../export/sheetPdf"), bytes(regularUrl), bytes(boldUrl)]);
      const pdf = await makeSheetPdf(ch, rs, lang, { regular, bold });
      const slug = (ch.name || "personaggio").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "personaggio";
      setState({ url: downloadBytes(pdf, `scheda-${slug}.pdf`, "application/pdf") });
    } catch (e) {
      setState({ error: fmt(t.error, { e: e instanceof Error ? e.message : String(e) }) });
    }
  };
  return (
    <>
      <p className="ui-muted">{t.help}</p>
      <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <Button variant="primary" disabled={state.busy} onClick={() => void run()}>{state.busy ? t.busy : t.button}</Button>
        {state.url && <a className="ui-btn" href={state.url} target="_blank" rel="noreferrer">{t.open}</a>}
      </div>
      {state.url && <p role="status">{fmt(t.done, { name: ch.name || it.characters.unnamed })}</p>}
      {state.error && <div className="ui-error" role="alert">{state.error}</div>}
    </>
  );
}
