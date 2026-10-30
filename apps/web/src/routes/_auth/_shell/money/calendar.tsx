import { createFileRoute } from "@tanstack/react-router";
import { MoneyCalendar } from "@/features/money/money-calendar";

export const Route = createFileRoute("/_auth/_shell/money/calendar")({
  component: MoneyCalendar,
});
