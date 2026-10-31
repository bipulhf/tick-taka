import { createFileRoute } from "@tanstack/react-router";
import { NotFound } from "@/components/shell/not-found";

/** Any signed-in address that isn't a page (an old link, a typo) shows inside the shell. */
export const Route = createFileRoute("/_auth/_shell/$")({
  component: () => <NotFound search />,
});
