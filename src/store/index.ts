import { createRepo } from "../db/repo";
import { broadcastChannel, createAppStore } from "./app";

export * from "./app";
export * from "./settings";
export * from "./persist";
// Istanza dell'app (nei test si usa createAppStore con un repo dedicato)
export const appStore = createAppStore({ repo: createRepo(), channel: broadcastChannel() });
