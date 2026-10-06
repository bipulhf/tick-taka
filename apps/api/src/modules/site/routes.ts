import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { landingPage, privacyPage, termsPage } from "./pages";

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
  return routes;
};
