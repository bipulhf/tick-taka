import { useSyncExternalStore } from "react";

/** Whether a media query matches, kept up to date. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** 640 px and up: panels slide in beside the content instead of covering the screen. */
export const useIsWide = () => useMedia("(min-width: 640px)");
/** 1024 px and up: the full sidebar and two-column views. */
export const useIsDesk = () => useMedia("(min-width: 1024px)");
