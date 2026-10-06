import { DataSection } from "./data-section";
import { SettingsPage } from "./settings-page";

/** Export everything as one file. */
export function DataSettings() {
  return <SettingsPage title="Your data">{() => <DataSection />}</SettingsPage>;
}
