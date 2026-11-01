import AsyncStorage from "@react-native-async-storage/async-storage";
import { isLook, type Look } from "./widget-colors";

/**
 * Each widget's look, by the launcher's widget id. A phone preference rather than
 * anyone's data, so it stays when someone signs out (lib/user-data.ts).
 */
export const LOOKS_KEY = "tt.widget-looks";

export type LookChoices = Record<string, Look>;

/** The saved choices, ignoring anything that isn't a look. Pure, so it can be tested. */
export function parseLooks(raw: string | null): LookChoices {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, look]) => isLook(look)));
  } catch {
    return {};
  }
}

/** A widget's look: what was picked for it, else Auto. */
export function lookOf(choices: LookChoices, widgetId: number): Look {
  return choices[String(widgetId)] ?? "auto";
}

export async function readLooks(): Promise<LookChoices> {
  return parseLooks(await AsyncStorage.getItem(LOOKS_KEY));
}

export async function writeLook(widgetId: number, look: Look): Promise<void> {
  const choices = await readLooks();
  await AsyncStorage.setItem(LOOKS_KEY, JSON.stringify({ ...choices, [widgetId]: look }));
}

/** Forgets a removed widget's look. */
export async function forgetLook(widgetId: number): Promise<void> {
  const { [String(widgetId)]: _gone, ...rest } = await readLooks();
  await AsyncStorage.setItem(LOOKS_KEY, JSON.stringify(rest));
}
