import { useRegisterSW } from "virtual:pwa-register/react";
import it from "../i18n/it.json";
import { Button } from "./xp";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Avviso dell'app installata: c'è una versione nuova (Aggiorna ricarica), oppure l'app è pronta per l'uso offline
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Controlla periodicamente se c'è un nuovo build
      if (registration) setInterval(() => void registration.update(), CHECK_INTERVAL_MS);
    },
  });

  if (!needRefresh && !offlineReady) return null;

  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <div className="pwa-toast" role="alert">
      <p>{needRefresh ? it.pwa.updateAvailable : it.pwa.offlineReady}</p>
      <div className="xp-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
        {needRefresh && <Button variant="primary" onClick={() => void updateServiceWorker(true)}>{it.pwa.update}</Button>}
        <Button onClick={close}>{needRefresh ? it.pwa.later : it.pwa.close}</Button>
      </div>
    </div>
  );
}
