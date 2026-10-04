import { newId } from "@tick-taka/shared/ids";
import { queryEpochSchema } from "@tick-taka/shared/schemas/common";
import {
  SMS_STATUSES,
  smsImportBatchSchema,
  smsImportPatchSchema,
} from "@tick-taka/shared/schemas/money";
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { smsImports } from "../../db/schema/money";
import type { Deps } from "../../lib/deps";
import { notFound } from "../../lib/errors";
import { validate } from "../../lib/validate";

const listQuery = z.object({
  status: z.enum(SMS_STATUSES).optional(),
  since: queryEpochSchema.optional(),
});
const fingerprintParam = z.object({ fingerprint: z.string().min(3).max(120) });

/**
 * The server keeps parsed fields and the fingerprint only; raw SMS text never
 * leaves the phone. Fingerprints stop a reinstall from re-offering old messages.
 */
export const smsImportsRoutes = (deps: Deps) =>
  new Hono()
    .get("/", validate("query", listQuery), (c) => {
      const { status, since } = c.req.valid("query");
      return c.json(
        deps.db
          .select()
          .from(smsImports)
          .where(
            and(
              isNull(smsImports.deletedAt),
              status ? eq(smsImports.status, status) : undefined,
              since === undefined ? undefined : gte(smsImports.receivedAt, since),
            ),
          )
          .orderBy(desc(smsImports.receivedAt))
          .limit(500)
          .all(),
      );
    })
    .post("/", validate("json", smsImportBatchSchema), (c) => {
      const { items } = c.req.valid("json");
      const fingerprints = items.map((item) => item.fingerprint);
      const known = fingerprints.length
        ? deps.db
            .select({
              fingerprint: smsImports.fingerprint,
              status: smsImports.status,
              transactionId: smsImports.transactionId,
            })
            .from(smsImports)
            .where(inArray(smsImports.fingerprint, fingerprints))
            .all()
        : [];
      const knownSet = new Set(known.map((row) => row.fingerprint));
      const now = deps.now();
      const fresh = items.filter((item) => !knownSet.has(item.fingerprint));
      deps.db.transaction((tx) => {
        for (const item of fresh) {
          tx.insert(smsImports)
            .values({ id: newId(now), ...item, status: "pending", createdAt: now, updatedAt: now })
            .onConflictDoNothing()
            .run();
        }
      });
      return c.json({ known, created: fresh.map((item) => item.fingerprint) });
    })
    .patch(
      "/:fingerprint",
      validate("param", fingerprintParam),
      validate("json", smsImportPatchSchema),
      (c) => {
        const { fingerprint } = c.req.valid("param");
        const { status, transactionId } = c.req.valid("json");
        const now = deps.now();
        const updated = deps.db
          .update(smsImports)
          .set({
            status,
            ...(transactionId === undefined ? {} : { transactionId }),
            updatedAt: now,
          })
          .where(eq(smsImports.fingerprint, fingerprint))
          .returning()
          .all();
        if (updated.length === 0) throw notFound("SMS import");
        return c.json(updated[0]!);
      },
    );
