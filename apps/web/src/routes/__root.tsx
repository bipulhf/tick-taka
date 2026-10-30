import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ConfettiLayer } from "@/components/ui/confetti";
import { ErrorState } from "@/components/ui/empty-state";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";

export const Route = createRootRoute({
  component: Root,
  // Any render error below the root shows a way out instead of a blank page.
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-md pt-24">
      <ErrorState
        message="Something broke on this page. Try again, or reload it."
        onRetry={() => {
          reset();
          window.location.reload();
        }}
      />
    </div>
  ),
});

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Outlet />
        <Toaster />
        <ConfettiLayer />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
