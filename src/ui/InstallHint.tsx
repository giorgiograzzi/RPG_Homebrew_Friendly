import { useEffect, useState } from "react";
import it from "../i18n/it.json";
import { Button } from "./xp";

const t = it.settings.install;
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

// Installazione della PWA: pulsante dove il browser lo permette (Android, desktop), istruzioni su iPhone e iPad
export function InstallHint() {
  const [ev, setEv] = useState<InstallEvent | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEv(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return (
    <fieldset className="xp-group">
      <legend>{t.title}</legend>
      {standalone ? <p>{t.installed}</p> : ev ? (
        <div className="xp-actions" style={{ justifyContent: "flex-start" }}>
          <Button variant="primary" onClick={() => void ev.prompt().then(() => ev.userChoice).then((c) => { if (c.outcome === "accepted") setDone(true); setEv(null); })}>{t.button}</Button>
        </div>
      ) : <p>{ios ? t.ios : t.other}</p>}
      {done && <p role="status">{t.done}</p>}
      <p className="xp-muted">{t.offline}</p>
    </fieldset>
  );
}
