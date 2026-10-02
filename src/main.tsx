import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import "./ui/theme/theme.css";
import { lang, strings as it } from "./i18n";
import { setHomebrewFiles } from "./data/ruleset";
import { entryFiles } from "./engine/homebrew";
import { appStore } from "./store";

// L'homebrew attivo entra nel ruleset: ad ogni modifica (e appena caricato) si ricostruisce
appStore.subscribe((s, prev) => { if (s.homebrew !== prev.homebrew) setHomebrewFiles(entryFiles(s.homebrew)); });

document.title = it.app.title;
document.documentElement.lang = lang;
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
);
