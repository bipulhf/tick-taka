import { useEffect, useState } from "react";
import { cx } from "@/components/ui/cx";
import { ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ViewSkeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/lib/queries";
import { AccountSection } from "./account-section";
import { AiSection } from "./ai-section";
import { AppearanceSection } from "./appearance-section";
import { AreasSection } from "./areas-section";
import { MoneySection } from "./money-section";
import { NotificationsSection } from "./notifications-section";
import { PlanningSection } from "./planning-section";
import { DataSection, PrivacySection } from "./privacy-data-sections";
import { useUpdateSettings } from "./use-update-settings";

const SECTIONS = [
  { id: "settings-appearance", label: "Appearance" },
  { id: "settings-planning", label: "Today and planning" },
  { id: "settings-money", label: "Money" },
  { id: "settings-areas", label: "Areas and categories" },
  { id: "settings-notifications", label: "Notifications" },
  { id: "settings-ai", label: "AI" },
  { id: "settings-privacy", label: "Privacy" },
  { id: "settings-data", label: "Data" },
  { id: "settings-account", label: "Account" },
];

/** The section nearest the top of the scrolling view, for the list on the left. */
function useCurrentSection(ready: boolean): string {
  const [current, setCurrent] = useState(SECTIONS[0]?.id ?? "");
  useEffect(() => {
    if (!ready) return;
    const seen = new Map<string, boolean>();
    const ids = new WeakMap<Element, string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(ids.get(entry.target) ?? "", entry.isIntersecting);
        const first = SECTIONS.find((s) => seen.get(s.id));
        if (first) setCurrent(first.id);
      },
      { rootMargin: "-10% 0px -60% 0px" },
    );
    for (const { id } of SECTIONS) {
      const node = document.getElementById(`${id}-title`)?.closest("section");
      if (node) {
        ids.set(node, id);
        observer.observe(node);
      }
    }
    // The last sections never reach the top; at the very bottom, the last one is current.
    const main = document.getElementById("main");
    const onScroll = () => {
      if (main && main.scrollTop + main.clientHeight >= main.scrollHeight - 8)
        setCurrent(SECTIONS[SECTIONS.length - 1]?.id ?? "");
    };
    main?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      main?.removeEventListener("scroll", onScroll);
    };
  }, [ready]);
  return current;
}

/**
 * Settings as one page: a sticky list of sections on the left of a wide screen and
 * the sections as grouped lists beside it; on a narrow screen, just the sections.
 */
export function SettingsView() {
  const { data: s, isError, refetch } = useSettings();
  const update = useUpdateSettings();
  const current = useCurrentSection(Boolean(s));

  const jump = (id: string) => {
    const heading = document.getElementById(`${id}-title`);
    if (!heading) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // Keyboard users carry on from the section they picked.
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Settings" />
      {!s ? (
        isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <ViewSkeleton />
        )
      ) : (
        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="Settings sections" className="hidden lg:block">
            <ul className="sticky top-2 flex flex-col gap-0.5">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    aria-current={current === section.id ? "true" : undefined}
                    onClick={() => jump(section.id)}
                    className={cx(
                      "flex h-9 w-full items-center rounded-xl px-3 text-left text-callout font-semibold transition-colors",
                      current === section.id
                        ? "bg-card text-ink shadow-sm shadow-ink/5"
                        : "text-muted hover:bg-line/50 hover:text-ink",
                    )}
                  >
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex max-w-[760px] flex-col gap-10 [&_h2]:scroll-mt-6 [&_section]:scroll-mt-6">
            <AppearanceSection s={s} update={update} />
            <PlanningSection s={s} update={update} />
            <MoneySection s={s} update={update} />
            <AreasSection />
            <NotificationsSection s={s} update={update} />
            <AiSection s={s} update={update} />
            <PrivacySection />
            <DataSection />
            <AccountSection />
          </div>
        </div>
      )}
    </div>
  );
}
