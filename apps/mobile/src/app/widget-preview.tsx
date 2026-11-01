import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { WidgetPreview } from "react-native-android-widget";
import { readWidgetCache, type WidgetCache } from "@/features/widget/widget-cache";
import { type Face, isLook } from "@/features/widget/widget-colors";
import { WIDGET_NAMES } from "@/features/widget/widget-names";
import { drawFace } from "@/features/widget/widget-registry";
import { SCREENSHOT_BUILD } from "@/lib/auth";

/** The launcher's default 4×2 size on a 1080×2400 phone, in dp. */
const WIDTH = 375;
const HEIGHT = 210;

/**
 * Screenshot builds only (see lib/auth.ts): a home-screen widget drawn from the same
 * components and cache the launcher uses, for the README.
 * ticktaka://widget-preview?name=Tasks&look=night picks the widget and its look.
 */
export default function WidgetPreviewScreen() {
  const params = useLocalSearchParams<{
    name?: string;
    look?: string;
    width?: string;
    height?: string;
  }>();
  const look: Face = isLook(params.look) && params.look !== "auto" ? params.look : "paper";
  const name = params.name ?? WIDGET_NAMES.today;
  const width = Number(params.width) || WIDTH;
  const height = Number(params.height) || HEIGHT;
  const [cache, setCache] = useState<WidgetCache | null>(null);
  useEffect(() => {
    void readWidgetCache().then(setCache);
  }, []);
  if (!SCREENSHOT_BUILD) return <Redirect href="/" />;
  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: look === "night" ? "#0E0D14" : "#C9D6F2" }}
    >
      {cache ? (
        <WidgetPreview
          width={width}
          height={height}
          renderWidget={() => drawFace(name, cache, look, { width, height }, Date.now())}
        />
      ) : null}
    </View>
  );
}
