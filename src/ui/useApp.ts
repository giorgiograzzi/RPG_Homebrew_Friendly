import { useStore } from "zustand";
import { appStore, type AppActions, type AppState } from "../store";

export const useApp = <T,>(selector: (s: AppState & AppActions) => T): T => useStore(appStore, selector);
