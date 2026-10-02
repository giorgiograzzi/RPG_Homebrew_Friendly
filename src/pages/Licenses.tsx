import { Fragment, type ReactNode } from "react";
import { lang, strings as it } from "../i18n";
import { CC_BY_URL, DISCLAIMER, SRD_NOTICE } from "../legal/attribution";
import type { PolicyKind } from "../legal/policies";
import { Button } from "../ui/theme";

const t = it.about;

// I link nel testo diventano cliccabili (il testo resta identico a quello della dicitura)
const linked = (s: string): ReactNode => s.split(/(https?:\/\/[^\s)]+?)(?=[.,;)]?(?:\s|$))/).map((p, i) =>
  i % 2 ? <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a> : <Fragment key={i}>{p}</Fragment>);

// Informazioni e licenze: dicitura CC-BY dell'SRD (nella lingua dell'app), avviso «non ufficiale», licenze di codice e font
export function Licenses({ onBack, onLegal }: { onBack: () => void; onLegal: (kind: PolicyKind) => void }) {
  return (
    <>
      <div className="ui-actions" style={{ justifyContent: "flex-start" }}><Button onClick={onBack}>← {t.back}</Button></div>
      <h2>{t.title}</h2>
      <p><strong>{it.app.title}</strong> · {t.version} <span className="ui-muted">{__BUILD__}</span></p>
      <p className="ui-muted">{t.intro}</p>

      <fieldset className="ui-group" lang={lang}>
        <legend>{t.srd}</legend>
        <p data-testid="srd-notice">{linked(SRD_NOTICE[lang])}</p>
        <p><a href={CC_BY_URL} target="_blank" rel="noreferrer">{t.license}</a></p>
      </fieldset>
      <fieldset className="ui-group">
        <legend>{t.unofficial}</legend>
        <p data-testid="disclaimer">{DISCLAIMER[lang]}</p>
      </fieldset>
      <fieldset className="ui-group">
        <legend>{t.code}</legend>
        <p>{t.codeText}</p>
      </fieldset>
      <fieldset className="ui-group">
        <legend>{t.font}</legend>
        <p>{t.fontText}</p>
      </fieldset>
      <fieldset className="ui-group">
        <legend>{t.homebrew}</legend>
        <p>{t.homebrewText}</p>
      </fieldset>
      <fieldset className="ui-group">
        <legend>{it.settings.privacy.title}</legend>
        <p>{it.settings.privacy.text}</p>
        <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <Button onClick={() => onLegal("privacy")}>{it.settings.privacy.privacy}</Button>
          <Button onClick={() => onLegal("cookies")}>{it.settings.privacy.cookies}</Button>
        </div>
      </fieldset>
    </>
  );
}
