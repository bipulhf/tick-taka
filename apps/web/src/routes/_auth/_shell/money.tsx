import { createFileRoute } from "@tanstack/react-router";
import { SectionLayout } from "@/components/shell/section-tabs";

/** Every Money page sits under its row of page tabs. */
export const Route = createFileRoute("/_auth/_shell/money")({
  component: () => <SectionLayout to="/money" />,
});
