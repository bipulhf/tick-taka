import { describe, expect, test } from "bun:test";
import { createTestContext } from "./helpers";

describe("public pages", () => {
  test("home, privacy and terms are plain HTML that needs no sign-in", async () => {
    const ctx = await createTestContext({
      env: { SITE_OPERATOR: "Mehedi's <Academy>", CONTACT_EMAIL: "help@example.com" },
    });
    for (const path of ["/", "/privacy", "/terms"]) {
      const res = await ctx.app.request(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const html = await res.text();
      expect(html).toContain('href="/privacy"');
      // Must match the app name on the Google consent screen.
      expect(html).toContain("TickNTaka");
      expect(html).not.toContain("Tick &amp; Taka");
      expect(html).toContain("Mehedi&#39;s &lt;Academy&gt;");
    }
    const privacy = await (await ctx.app.request("/privacy")).text();
    expect(privacy).toContain("Limited Use");
    expect(privacy).toContain("<code>email</code>");
    expect(privacy).toContain("mailto:help@example.com");
    // DELETE /auth/account removes everything at once; the page must say so.
    expect(privacy).toContain("removed from our server at once");
    // The pages' font comes from this host, never from another one.
    const font = await ctx.app.request("/site/nunito.woff2");
    expect(font.status).toBe(200);
    expect(font.headers.get("content-type")).toBe("font/woff2");
    expect((await font.arrayBuffer()).byteLength).toBeGreaterThan(10_000);
    // Tiki is the site's icon, from this host too.
    for (const [path, type] of [
      ["/favicon.ico", "image/x-icon"],
      ["/favicon.svg", "image/svg+xml"],
      ["/apple-touch-icon.png", "image/png"],
    ]) {
      const icon = await ctx.app.request(path as string);
      expect(icon.status).toBe(200);
      expect(icon.headers.get("content-type")).toBe(type as string);
    }
    for (const path of ["/", "/privacy", "/terms"]) {
      const html = await (await ctx.app.request(path)).text();
      expect(html).toContain('href="/favicon.ico"');
      expect(html).not.toMatch(/<script|https:\/\/fonts\./);
    }
    // The signed-in API still asks for a token.
    expect((await ctx.app.request("/tasks")).status).toBe(401);
  });

  test("an empty CONTACT_EMAIL counts as unset", async () => {
    const ctx = await createTestContext({ env: { CONTACT_EMAIL: "" } });
    expect((await ctx.app.request("/privacy")).status).toBe(200);
  });
});
