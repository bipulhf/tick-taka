import { describe, expect, test } from "bun:test";
import { AREA_COLORS, areaColorName, areaColorValue } from "../src/features/plan/area-colors";
import { palette } from "../src/theme/palette";

describe("area colours", () => {
  test("are announced by name, never as a hex code", () => {
    for (const hex of AREA_COLORS) expect(areaColorName(hex)).not.toMatch(/#|[0-9a-f]{6}/i);
    expect(areaColorName("#5b8cff")).toBe("Blue");
    expect(areaColorName("#A57BFF")).toBe("Purple");
    expect(areaColorName("#123456")).toBe("Custom colour");
  });

  test("follow the theme in dark mode", () => {
    expect(areaColorValue("#5B8CFF", "light")).toBe(palette.light.sky);
    expect(areaColorValue("#5B8CFF", "dark")).toBe(palette.dark.sky);
    expect(areaColorValue("#2EC4A0", "dark")).toBe(palette.dark.mint);
    expect(areaColorValue("#7A6BFF", "dark")).not.toBe("#7A6BFF");
    expect(areaColorValue("#123456", "dark")).toBe("#123456");
  });
});
