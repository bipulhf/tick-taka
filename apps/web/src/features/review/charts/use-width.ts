import { useEffect, useRef, useState } from "react";

/** The rendered width of an element, kept up to date, so SVG text stays at its real size. */
export function useWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth || fallback);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width) || fallback);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

/** ← / → / Home / End over `count` marks; returns the new index or null. */
export function stepIndex(key: string, index: number | null, count: number): number | null {
  if (count === 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
  // The first arrow lands on the latest mark, where the reader's eye already is.
  if (index === null) return count - 1;
  return key === "ArrowLeft" ? Math.max(0, index - 1) : Math.min(count - 1, index + 1);
}
