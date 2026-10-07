import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { WidgetPreview } from "react-native-android-widget";
import { SafeToSpendWidget } from "@/features/widget/safe-to-spend-widget";
import { readWidgetCache, type WidgetCache } from "@/features/widget/widget-cache";
import { SCREENSHOT_BUILD } from "@/lib/auth";

/** The launcher's default 4×2 size on a 1080×2400 phone, in dp. */
const WIDTH = 375;
const HEIGHT = 210;

/**
 * Screenshot builds only (see lib/auth.ts): the home-screen widget drawn from the
 * same component and cache the launcher uses, for the README.
 * ticktaka://widget-preview?scheme=dark shows the dark version.
 */
export default function WidgetPreviewScreen() {
  const { scheme = "light" } = useLocalSearchParams<{ scheme?: "light" | "dark" }>();
  const [cache, setCache] = useState<WidgetCache | null>(null);
  useEffect(() => {
    void readWidgetCache().then(setCache);
  }, []);
  if (!SCREENSHOT_BUILD) return <Redirect href="/" />;
  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: scheme === "dark" ? "#0E0D14" : "#C9D6F2" }}
    >
      {cache ? (
        <WidgetPreview
          width={WIDTH}
          height={HEIGHT}
          renderWidget={() => (
            <SafeToSpendWidget cache={cache} scheme={scheme} width={WIDTH} height={HEIGHT} />
          )}
        />
      ) : null}
    </View>
  );
}
