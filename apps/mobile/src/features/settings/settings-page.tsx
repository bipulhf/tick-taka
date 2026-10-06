import type { ReactNode } from "react";
import { ErrorState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { SkeletonForm } from "@/components/ui/skeleton";
import { useSettings } from "@/lib/queries";

export type Settings = NonNullable<ReturnType<typeof useSettings>["data"]>;

/** One settings page: waits for the settings, then renders its controls. */
export function SettingsPage({
  title,
  children,
}: {
  title: string;
  children: (settings: Settings) => ReactNode;
}) {
  const { data: s, isError, refetch } = useSettings();
  return (
    <Screen title={title} tabBarPadding={false}>
      {s ? (
        children(s)
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <SkeletonForm fields={5} />
      )}
    </Screen>
  );
}
