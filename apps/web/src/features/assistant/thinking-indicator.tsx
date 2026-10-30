import { useEffect, useState } from "react";
import { Tiki } from "@/components/tiki/tiki";

/** Three neutral dots: purple means habits and mango the primary action, so neither waves here. */
const DOTS = ["first", "second", "third"];
const THINKING = ["Thinking", "Reading your day", "Doing the sums", "Almost there"];
const WORKING = ["Working on it", "Checking the results", "Tidying up"];

/** Tiki at work: a little wave of dots and a line that changes as it goes. */
export function ThinkingIndicator({ working = false }: { working?: boolean }) {
  const lines = working ? WORKING : THINKING;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    const timer = setInterval(() => setIndex((i) => Math.min(i + 1, lines.length - 1)), 2200);
    return () => clearInterval(timer);
  }, [lines]);
  return (
    <div
      role="status"
      aria-label={working ? "Tiki is working" : "Tiki is thinking"}
      className="flex items-center gap-3"
    >
      <Tiki mood="focused" size={28} />
      <span aria-hidden className="flex h-4 items-end gap-1.5">
        {DOTS.map((dot, i) => (
          <span
            key={dot}
            className="size-2 rounded-full bg-muted motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </span>
      <span key={lines[index]} aria-hidden className="animate-fade-in text-callout text-muted">
        {lines[index]}…
      </span>
    </div>
  );
}

/** The blinking caret at the end of a reply that's still arriving. */
export function StreamingCaret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 rounded-full bg-mango motion-safe:animate-pulse"
    />
  );
}
