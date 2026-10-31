import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { profileStore } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { type Box, placeCard, TOUR_STEPS } from "./tour-steps";
import { markTourDone, tourStore } from "./tour-store";

const PAD = 8;
const CARD_WIDTH = 360;

/** The first part of the screen with this `data-tour` name that is actually showing. */
function findTarget(name: string): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const rect = element.getBoundingClientRect();
    // checkVisibility, not offsetParent: a fixed element (Tiki's button) has no offsetParent.
    const shown = element.checkVisibility?.() ?? element.offsetParent !== null;
    if (rect.width > 0 && rect.height > 0 && shown) return element;
  }
  return null;
}

const toBox = (rect: DOMRect): Box => ({
  top: rect.top - PAD,
  left: rect.left - PAD,
  width: rect.width + PAD * 2,
  height: rect.height + PAD * 2,
});

/**
 * The guided tour over the real app: a spotlight on one part of the screen at a time
 * and Tiki's card beside it. Back / Next / Skip, or ← → and Esc. Finishing or
 * skipping remembers it for this person in this browser.
 */
export function AppTour() {
  const step = useStore(tourStore);
  const profile = useStore(profileStore);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/^\/app/, "") || "/" });
  const [box, setBox] = useState<Box | null>(null);
  const [ready, setReady] = useState(false);
  const [cardHeight, setCardHeight] = useState(240);
  const target = useRef<HTMLElement | null>(null);
  const direction = useRef(1);
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const open = step !== null;
  const current = step === null ? null : TOUR_STEPS[step];

  const close = useCallback(() => {
    markTourDone(profile?.id);
    tourStore.set(null);
    target.current = null;
  }, [profile?.id]);

  const go = useCallback(
    (by: number) => {
      const at = tourStore.get();
      if (at === null) return;
      direction.current = by;
      const to = at + by;
      if (to < 0) return;
      if (to >= TOUR_STEPS.length) close();
      else tourStore.set(to);
    },
    [close],
  );

  // The tour points at Today's parts, so it runs on Today.
  useEffect(() => {
    if (open && path !== "/") void navigate({ to: "/" });
  }, [open, path, navigate]);

  // Find this step's target (it may still be loading), bring it into view, measure it.
  useEffect(() => {
    if (!current) return;
    setReady(false);
    target.current = null;
    if (!current.target) {
      setBox(null);
      setReady(true);
      return;
    }
    const name = current.target;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const find = () => {
      const element = findTarget(name);
      if (element) {
        target.current = element;
        element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        timer = setTimeout(
          () => {
            setBox(toBox(element.getBoundingClientRect()));
            setReady(true);
          },
          reduce ? 0 : 320,
        );
      } else if (current.waits && tries++ < 20) timer = setTimeout(find, 100);
      // Not on screen here (no AI chat, a phone without that link): carry on past it.
      else go(direction.current);
    };
    find();
    return () => clearTimeout(timer);
  }, [current, go]);

  // Follow the target when the window or the view scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const remeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (target.current) setBox(toBox(target.current.getBoundingClientRect()));
      });
    };
    window.addEventListener("resize", remeasure);
    document.addEventListener("scroll", remeasure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", remeasure);
      document.removeEventListener("scroll", remeasure, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (ready && card.current) setCardHeight(card.current.offsetHeight);
  }, [ready]);

  useEffect(() => {
    if (ready) next.current?.focus({ preventScroll: true });
  }, [ready]);

  // ← → and Esc, before the app's own shortcuts see them.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "Escape") close();
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, go, close]);

  if (!current || step === null) return null;
  const last = step === TOUR_STEPS.length - 1;
  const width = Math.min(CARD_WIDTH, window.innerWidth - 24);
  const place = placeCard(
    box,
    { width, height: cardHeight },
    { width: window.innerWidth, height: window.innerHeight },
  );

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Holds clicks back from the app while the tour runs. */}
      <div aria-hidden className={cx("absolute inset-0", (!box || !ready) && "bg-ink/55")} />
      {box && ready ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-[3px] ring-mango"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: "0 0 0 9999px rgb(22 21 28 / 0.58)",
          }}
        />
      ) : null}
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className={cx(
          "absolute flex flex-col gap-4 rounded-3xl border-2 border-ink bg-card p-5 shadow-[6px_7px_0_var(--tt-ink)] dark:shadow-[6px_7px_0_rgb(0_0_0)]",
          ready ? "animate-fade-in" : "opacity-0",
        )}
        style={{ top: place.top, left: place.left, width }}
      >
        <div className="flex items-start gap-3">
          <Tiki mood={current.mood} size={52} />
          <div className="min-w-0 flex-1">
            <p className="text-caption text-muted">
              {step + 1} of {TOUR_STEPS.length}
            </p>
            <h2 id="tour-title" className="text-heading">
              {current.title}
            </h2>
          </div>
        </div>
        <p id="tour-body" aria-live="polite" className="text-callout">
          {current.body}
        </p>
        <div className="flex gap-1.5" aria-hidden>
          {TOUR_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={cx(
                "h-1.5 rounded-full transition-[width] duration-200",
                i === step ? "w-5 bg-mango" : i < step ? "w-1.5 bg-ink/60" : "w-1.5 bg-line",
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {last ? null : (
            <Button variant="ghost" size="sm" onClick={close}>
              Skip tour
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            {step > 0 ? (
              <Button size="sm" onClick={() => go(-1)}>
                Back
              </Button>
            ) : null}
            <Button ref={next} size="sm" variant="primary" onClick={() => go(1)}>
              {step === 0 ? "Show me" : last ? "Let's go" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
