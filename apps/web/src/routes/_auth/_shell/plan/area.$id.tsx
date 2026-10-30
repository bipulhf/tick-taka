import { createFileRoute } from "@tanstack/react-router";
import { AreaDetail } from "@/features/plan/area-detail";

export const Route = createFileRoute("/_auth/_shell/plan/area/$id")({
  component: AreaPage,
});

function AreaPage() {
  const { id } = Route.useParams();
  return <AreaDetail key={id} areaId={id} />;
}
