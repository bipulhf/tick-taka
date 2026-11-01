import {
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/nunito";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { type WidgetConfigurationScreenProps, WidgetPreview } from "react-native-android-widget";
import { ON_ACCENT, palette } from "@/theme/palette";
import { EMPTY_CACHE, readWidgetCache, type WidgetCache } from "./widget-cache";
import { LOOKS, type Look } from "./widget-colors";
import { lookOf, readLooks, writeLook } from "./widget-looks";
import { drawFace, drawWidget, PREVIEW_SIZES } from "./widget-registry";

/** The mockups' wallpaper, so Glass shows what it does over a picture. */
const WALLPAPER = ["#3B4A6B", "#6A5B8C", "#C98A6B"] as const;

/**
 * Opens when a widget is added, and from its long-press "Reconfigure" (Android 12+):
 * pick its look (Auto, Paper, Night, Glass or Mango), with the widget drawn live in
 * it over a wallpaper. Runs on its own, outside the app's screens, so it is plain
 * React Native with the palette's colours.
 */
export function WidgetConfigScreen({
  widgetInfo,
  renderWidget,
  setResult,
}: WidgetConfigurationScreenProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const p = palette[scheme];
  const [fonts] = useFonts({ Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold });
  const { width: screen } = useWindowDimensions();
  const [look, setLook] = useState<Look>("auto");
  const [cache, setCache] = useState<WidgetCache>(EMPTY_CACHE);
  const { widgetName, widgetId } = widgetInfo;

  useEffect(() => {
    void Promise.all([readWidgetCache(), readLooks()]).then(([stored, looks]) => {
      setCache(stored);
      setLook(lookOf(looks, widgetId));
    });
  }, [widgetId]);

  const usual = PREVIEW_SIZES[widgetName] ?? { width: 340, height: 200 };
  const size = {
    width: Math.min(widgetInfo.width || usual.width, screen - 72),
    height: widgetInfo.height || usual.height,
  };
  const face = look === "auto" ? (scheme === "dark" ? "night" : "paper") : look;
  const font = (weight: "regular" | "bold" | "extra") =>
    fonts
      ? {
          fontFamily:
            weight === "extra"
              ? "Nunito_800ExtraBold"
              : weight === "bold"
                ? "Nunito_700Bold"
                : "Nunito_400Regular",
        }
      : { fontWeight: weight === "regular" ? ("400" as const) : ("800" as const) };

  const done = async () => {
    await writeLook(widgetId, look);
    renderWidget(drawWidget(widgetName, await readWidgetCache(), look, size));
    setResult("ok");
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 48, gap: 20 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ ...font("extra"), fontSize: 24, lineHeight: 30, color: p.ink }}>
            Choose a look
          </Text>
          <Text style={{ ...font("regular"), fontSize: 15, lineHeight: 21, color: p.muted }}>
            Change it any time: long-press the widget and pick Reconfigure.
          </Text>
        </View>
        <LinearGradient
          colors={WALLPAPER}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 16, alignItems: "center" }}
        >
          <WidgetPreview
            width={size.width}
            height={size.height}
            renderWidget={() => drawFace(widgetName, cache, face, size, Date.now())}
          />
        </LinearGradient>
        <View
          accessibilityRole="radiogroup"
          style={{ backgroundColor: p.card, borderRadius: 16, overflow: "hidden" }}
        >
          {LOOKS.map((option, index) => {
            const selected = option.look === look;
            return (
              <Pressable
                key={option.look}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.name}: ${option.hint}`}
                onPress={() => setLook(option.look)}
                style={{
                  minHeight: 60,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: p.line,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: selected ? p.ink : p.lineStrong,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected ? (
                    <View
                      style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.ink }}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...font("bold"), fontSize: 17, lineHeight: 24, color: p.ink }}>
                    {option.name}
                  </Text>
                  <Text
                    style={{ ...font("regular"), fontSize: 13, lineHeight: 18, color: p.muted }}
                  >
                    {option.hint}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 12, padding: 20, paddingBottom: 28 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setResult("cancel")}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: p.lineStrong,
            backgroundColor: p.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ ...font("bold"), fontSize: 17, color: p.ink }}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void done()}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 16,
            backgroundColor: p.mango,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ ...font("bold"), fontSize: 17, color: ON_ACCENT }}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}
