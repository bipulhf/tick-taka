import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { palette, rewardThemes } from "../../mobile/src/theme/palette";

/** The web's CSS variables must be the phone's palette: same tokens, same values. */
const css = readFileSync(join(import.meta.dir, "../src/styles.css"), "utf8");

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No ${selector} block`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--tt-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [
      m[1] as string,
      (m[2] as string).toLowerCase(),
    ]),
  );
}

describe("design tokens", () => {
  test("light tokens match the phone", () => {
    const light = block(":root");
    for (const [name, value] of Object.entries(palette.light))
      expect(light[kebab(name)]).toBe(value.toLowerCase());
  });

  test("dark tokens match the phone", () => {
    const dark = block(':root[data-theme="dark"]');
    for (const [name, value] of Object.entries(palette.dark))
      expect(dark[kebab(name)]).toBe(value.toLowerCase());
  });

  test("light is the default: dark never follows the system", () => {
    expect(css).not.toContain("prefers-color-scheme");
  });

  test("accent themes tint the same surfaces as the phone", () => {
    for (const [id, theme] of Object.entries(rewardThemes)) {
      const light = block(`:root[data-accent="${id}"]`);
      for (const [name, value] of Object.entries(theme.light))
        expect(light[kebab(name)]).toBe(value.toLowerCase());
      const dark = block(`:root[data-theme="dark"][data-accent="${id}"]`);
      for (const [name, value] of Object.entries(theme.dark))
        expect(dark[kebab(name)]).toBe(value.toLowerCase());
    }
  });
});
