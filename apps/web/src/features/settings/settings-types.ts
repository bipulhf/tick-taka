import type { useSettings } from "@/lib/queries";
import type { useUpdateSettings } from "./use-update-settings";

export type Settings = NonNullable<ReturnType<typeof useSettings>["data"]>;

/** What every section gets: the settings as they are, and a way to change them. */
export interface SectionProps {
  s: Settings;
  update: ReturnType<typeof useUpdateSettings>;
}
