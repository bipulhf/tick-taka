import { idSchema, localDateSchema } from "@tick-taka/shared/schemas/common";
import { z } from "zod";

export const idParam = z.object({ id: idSchema });
export const dateQuery = z.object({ date: localDateSchema.optional() });
