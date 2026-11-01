import { createFileRoute } from "@tanstack/react-router";
import { SectionLayout } from "@/components/shell/section-tabs";

/** Every Plan page sits under its row of page tabs. */
export const Route = createFileRoute("/_auth/_shell/plan")({
  component: () => <SectionLayout to="/plan" />,
});
