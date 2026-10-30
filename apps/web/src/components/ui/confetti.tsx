import { useEffect, useRef } from "react";
import { playSound } from "@/lib/sounds";
import { createStore, useStore } from "@/lib/store";

/** Big wins only: all top three done, a routine finished, a savings goal reached. */
export const confettiStore = createStore(0);
export const celebrate = () => {
  confettiStore.set(confettiStore.get() + 1);
  playSound("celebrate");
};

const COLORS = ["#FFB547", "#5B8CFF", "#2EC4A0", "#FF7A6B", "#A57BFF"];
const PIECES = 48;
const DURATION_MS = 1800;

/** One burst of falling pieces over everything; skipped when motion is reduced. */
export function ConfettiLayer() {
  const run = useStore(confettiStore);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (run === 0 || !element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = element.getContext("2d");
    if (!context) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    element.width = width;
    element.height = height;
    const pieces = Array.from({ length: PIECES }, (_, i) => ({
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 200,
      spin: Math.random() * Math.PI * 4,
      delay: Math.random() * 250,
      color: COLORS[i % COLORS.length] ?? "#FFB547",
    }));
    const began = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      context.clearRect(0, 0, width, height);
      let alive = false;
      for (const piece of pieces) {
        const t = Math.min(1, Math.max(0, (now - began - piece.delay) / DURATION_MS));
        if (t < 1) alive = true;
        const eased = 1 - (1 - t) ** 2;
        context.save();
        context.globalAlpha = 1 - t;
        context.translate(piece.x + piece.drift * eased, -20 + height * 0.85 * eased);
        context.rotate(piece.spin * eased);
        context.fillStyle = piece.color;
        context.fillRect(-4, -7, 8, 14);
        context.restore();
      }
      if (alive) frame = requestAnimationFrame(draw);
      else context.clearRect(0, 0, width, height);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [run]);

  return <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-[60]" />;
}
