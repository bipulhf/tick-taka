import { createFileRoute } from "@tanstack/react-router";
import { ProjectView } from "@/features/plan/project-view";

export const Route = createFileRoute("/_auth/_shell/plan/project/$id")({
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  return <ProjectView key={id} projectId={id} />;
}
