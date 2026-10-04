import { areaCreateSchema, areaUpdateSchema } from "@tick-taka/shared/schemas/time";
import { asc } from "drizzle-orm";
import { areas } from "../../db/schema/time";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { resourceRoutes } from "../../lib/resource-routes";

export const areaService = (deps: Deps) => {
  const base = crud(deps.db, areas, "Area", deps.now);
  return { ...base, list: () => base.list(undefined, asc(areas.sort)) };
};

export const areasRoutes = (deps: Deps) =>
  resourceRoutes({
    service: () => areaService(deps),
    createSchema: areaCreateSchema,
    updateSchema: areaUpdateSchema,
  });
