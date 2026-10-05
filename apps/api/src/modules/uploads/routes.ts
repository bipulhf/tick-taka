import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { newId } from "@tick-taka/shared/ids";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../../lib/deps";
import { badRequest, notFound } from "../../lib/errors";
import { validate } from "../../lib/validate";

const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const nameParam = z.object({ name: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}\.(jpg|png|webp)$/) });

/** Receipt photos live in the user's own folder and are served only to that user. */
export const uploadsRoutes = (deps: Deps) =>
  new Hono()
    .post("/", async (c) => {
      const body = await c.req.parseBody();
      const file = body.file;
      if (!(file instanceof File)) throw badRequest("Attach an image as `file`");
      const extension = EXTENSIONS[file.type];
      if (!extension) throw badRequest("Receipts must be JPEG, PNG or WebP");
      if (file.size > MAX_BYTES) throw badRequest("Receipt images must be under 10 MB");
      mkdirSync(deps.uploadsDir, { recursive: true });
      const name = `${newId(deps.now())}.${extension}`;
      await Bun.write(join(deps.uploadsDir, name), file);
      return c.json({ path: name }, 201);
    })
    .get("/:name", validate("param", nameParam), async (c) => {
      const file = Bun.file(join(deps.uploadsDir, c.req.valid("param").name));
      if (!(await file.exists())) throw notFound("Receipt");
      return new Response(file, {
        headers: { "content-type": file.type, "cache-control": "private, max-age=86400" },
      });
    });
