import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WIDGET_NAMES } from "../src/features/widget/widget-names";

const root = join(import.meta.dir, "..");
const app = JSON.parse(readFileSync(join(root, "app.json"), "utf8")) as {
  expo: { plugins: unknown[] };
};
const plugin = app.expo.plugins.find(
  (entry): entry is [string, { widgets: Record<string, unknown>[] }] =>
    Array.isArray(entry) && entry[0] === "react-native-android-widget",
);
const widgets = plugin?.[1].widgets ?? [];

describe("the widgets registered in app.json", () => {
  test("are the eight the app draws, and the first widget's name is kept", () => {
    expect(widgets.map((w) => w.name)).toEqual(Object.values(WIDGET_NAMES));
    expect(WIDGET_NAMES.today).toBe("SafeToSpend");
  });

  test("each is drawn by the registry", () => {
    const registry = readFileSync(join(root, "src/features/widget/widget-registry.tsx"), "utf8");
    for (const key of Object.keys(WIDGET_NAMES))
      expect({ key, drawn: registry.includes(`[WIDGET_NAMES.${key}]: { draw:`) }).toEqual({
        key,
        drawn: true,
      });
  });

  test("each has a label, a preview image on disk, a look to pick and a 30 minute refresh", () => {
    for (const widget of widgets) {
      const image = String(widget.previewImage);
      expect({ name: widget.name, image: existsSync(join(root, image)) }).toEqual({
        name: widget.name,
        image: true,
      });
      expect(widget.label).toBeTruthy();
      expect(widget.widgetFeatures).toBe("reconfigurable");
      expect(widget.updatePeriodMillis).toBe(1_800_000);
    }
  });
});
