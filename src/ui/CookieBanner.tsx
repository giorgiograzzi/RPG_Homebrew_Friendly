import { useEffect, useState } from "react";
import { strings as it } from "../i18n";
import type { PolicyKind } from "../legal/policies";
import { Button } from "./theme";

const KEY = "cookie-notice";
const EVENT = "cookie-notice-reset";
const t = it.cookieNotice;

const seen = (): boolean => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
// Rimette l'avviso (Impostazioni → Privacy e cookie)
export function resetCookieNotice() {
  try { localStorage.removeItem(KEY); } catch { /* archivio non disponibile: l'avviso resta quello della sessione */ }
  window.dispatchEvent(new Event(EVENT));
}

// Avviso sui cookie. L'app non imposta cookie e usa solo archivi tecnici (IndexedDB, localStorage, cache): per questi non serve
// il consenso (art. 122 Codice privacy; linee guida del Garante, 10/6/2021), quindi l'avviso è informativo, con un solo «Ho capito».
// Se si aggiungono strumenti non tecnici (statistiche, terze parti) va trasformato in un banner con Accetta / Rifiuta / Personalizza,
// senza caricare nulla prima del consenso.
// «open»: una policy è aperta, l'avviso si nasconde per non coprirla (torna alla chiusura, se non è stato ancora chiuso)
export function CookieBanner({ onOpen, open }: { onOpen: (kind: PolicyKind) => void; open: boolean }) {
  const [shown, setShown] = useState(() => !seen());
  useEffect(() => {
    const on = () => setShown(true);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  if (!shown || open) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch { /* vale per questa sessione */ } setShown(false); };
  return (
    <section className="cookie-notice" role="region" aria-label={t.label}>
      <p>{t.text}</p>
      <div className="ui-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        <Button variant="primary" onClick={close}>{t.ok}</Button>
        <Button onClick={() => onOpen("cookies")}>{t.cookies}</Button>
        <Button onClick={() => onOpen("privacy")}>{t.privacy}</Button>
      </div>
    </section>
  );
}
