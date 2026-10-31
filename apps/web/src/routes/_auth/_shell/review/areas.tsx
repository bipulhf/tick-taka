import { createFileRoute, redirect } from "@tanstack/react-router";

/** Each area's summary is on its own page now, and Plan lists the areas; old links land there. */
export const Route = createFileRoute("/_auth/_shell/review/areas")({
  beforeLoad: () => {
    throw redirect({ to: "/plan", replace: true });
  },
});
