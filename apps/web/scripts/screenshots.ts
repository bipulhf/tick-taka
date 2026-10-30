/**
 * Screenshots of the web app signed in with the demo account, for checking views
 * and for the README.
 *
 *   bun scripts/screenshots.ts --token <demo token> [--base http://localhost:5173/app]
 *     [--out /tmp/tt-shots] [--width 1440] [--height 900] [--dark] [--path /money ...]
 *
 * Needs a dev server built with VITE_DEMO_SIGN_IN=1 and an API holding the demo
 * account (apps/api/scripts/demo.ts). Uses the system Chrome (CHROME_PATH).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";

const { values } = parseArgs({
  options: {
    token: { type: "string" },
    base: { type: "string", default: "http://localhost:5173/app" },
    out: { type: "string", default: "/tmp/tt-shots" },
    width: { type: "string", default: "1440" },
    height: { type: "string", default: "900" },
    dark: { type: "boolean", default: false },
    full: { type: "boolean", default: false },
    path: { type: "string", multiple: true },
  },
});
if (!values.token) throw new Error("Pass --token from apps/api/scripts/demo.ts");

const PATHS = values.path ?? ["/"];
mkdirSync(values.out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
});
const context = await browser.newContext({
  viewport: { width: Number(values.width), height: Number(values.height) },
  colorScheme: values.dark ? "dark" : "light",
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});
await page.goto(`${values.base}/login?demoToken=${values.token}`);
await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15_000 });

for (const path of PATHS) {
  await page.goto(`${values.base}${path === "/" ? "/" : path}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  const name = `${path.replace(/[/?=&:]+/g, "_").replace(/^_|_$/g, "") || "today"}${values.dark ? "-dark" : ""}.png`;
  await page.screenshot({ path: join(values.out, name), fullPage: values.full });
  console.log(join(values.out, name));
}
if (errors.length) console.error(`Page errors:\n${errors.join("\n")}`);
await browser.close();
