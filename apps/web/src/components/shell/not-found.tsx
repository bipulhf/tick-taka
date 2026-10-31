import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect } from "react";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { pageTitle } from "@/lib/page-title";
import { notFoundStore, paletteOpenStore } from "@/lib/ui-state";

/**
 * An address the app doesn't have (an old link, a typo): Tiki, one friendly line,
 * Today, and a way to search. Inside the shell (`search`), it keeps the sidebar and
 * quick-add around it; the window title says "Not found".
 */
export function NotFound({ search = false }: { search?: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    notFoundStore.set(true);
    // Outside the shell nothing else sets the title.
    if (!search) document.title = pageTitle("", { notFound: true });
    return () => notFoundStore.set(false);
  }, [search]);
  return (
    <div className="flex flex-col items-center gap-2 px-6 pt-16 pb-10 text-center">
      <Tiki mood="curious" size={96} />
      <h1 className="mt-2 text-title">Nothing here</h1>
      <p className="max-w-sm text-callout text-muted">
        This page has moved or never existed. Today is a good place to start.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="primary" onClick={() => void navigate({ to: "/" })}>
          Go to Today
        </Button>
        {search ? (
          <Button icon={Search} onClick={() => paletteOpenStore.set(true)}>
            Search
          </Button>
        ) : null}
      </div>
    </div>
  );
}
