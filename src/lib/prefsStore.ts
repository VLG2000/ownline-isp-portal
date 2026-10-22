import { readJson } from "@/lib/store";
import { normalizePrefs, DEFAULT_PREFS, type Prefs } from "@/lib/privacy";

export function prefsFor(userId: string): Prefs {
  return normalizePrefs(readJson("privacy", userId, DEFAULT_PREFS));
}
