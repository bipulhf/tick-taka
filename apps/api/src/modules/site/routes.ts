import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { landingPage } from "./landing";
import { privacyPage, termsPage } from "./pages";

/** Tiki as the site's icon, for browsers, tabs and home screens. */
const ICONS = {
  "/favicon.ico": { file: "favicon.ico", type: "image/x-icon" },
  "/favicon.svg": { file: "favicon.svg", type: "image/svg+xml" },
  "/apple-touch-icon.png": { file: "apple-touch-icon.png", type: "image/png" },
} as const;

/** Nunito, the app's font, so the public pages need nothing from another host. */
const FONT = Bun.file(
  new URL(import.meta.resolve("@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2")),
);

/** Public pages for the Google sign-in consent screen: home, privacy policy and terms. */
export const siteRoutes = (deps: Deps) => {
  const site = { operator: deps.env.SITE_OPERATOR, contactEmail: deps.env.CONTACT_EMAIL ?? null };
  const pages = {
    "/": landingPage(site),
    "/privacy": privacyPage(site),
    "/terms": termsPage(site),
  };
  const routes = new Hono();
  for (const [path, html] of Object.entries(pages))
    routes.get(path, (c) => {
      c.header("cache-control", "public, max-age=3600");
      return c.html(html);
    });
  routes.get("/site/nunito.woff2", async (c) => {
    c.header("content-type", "font/woff2");
    c.header("cache-control", "public, max-age=2592000");
    return c.body(await FONT.arrayBuffer());
  });
  for (const [path, icon] of Object.entries(ICONS))
    routes.get(path, async (c) => {
      c.header("content-type", icon.type);
      c.header("cache-control", "public, max-age=604800");
      return c.body(
        await Bun.file(new URL(`./assets/${icon.file}`, import.meta.url)).arrayBuffer(),
      );
    });
  return routes;
};
