import * as LocalAuthentication from "expo-local-authentication";
import { Card } from "@/components/ui/card";
import { notify } from "@/lib/notify";
import { togglePrivacy, usePrivacy } from "@/lib/privacy";
import { ToggleRow } from "./setting-row";
import { SettingsPage } from "./settings-page";
import { useUpdateSettings } from "./use-update-settings";

/** The fingerprint lock and privacy mode. */
export function PrivacySettings() {
  const privacy = usePrivacy();
  const update = useUpdateSettings();
  const enableLock = async (on: boolean) => {
    if (
      on &&
      !(
        (await LocalAuthentication.hasHardwareAsync()) &&
        (await LocalAuthentication.isEnrolledAsync())
      )
    ) {
      notify("Set up a fingerprint or face unlock on the phone first");
      return;
    }
    update({ appLock: on });
  };
  return (
    <SettingsPage title="Privacy and security">
      {(s) => (
        <Card className="gap-1">
          <ToggleRow
            label="Fingerprint lock"
            hint={`After ${s.lockAfterMinutes} minutes in the background`}
            value={s.appLock}
            onChange={enableLock}
          />
          <ToggleRow
            label="Privacy mode"
            hint="Hide every amount on screen"
            value={privacy}
            onChange={togglePrivacy}
          />
        </Card>
      )}
    </SettingsPage>
  );
}
