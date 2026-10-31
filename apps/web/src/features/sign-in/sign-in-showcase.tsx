import { Tiki } from "@/components/tiki/tiki";
import { cx } from "@/components/ui/cx";

/** A sticker: thick ink edge, hard shadow, a slight tilt. Same look as the home page. */
export const sticker =
  "border-2 border-ink bg-card shadow-[4px_5px_0_var(--tt-ink)] dark:shadow-[4px_5px_0_rgb(0_0_0)]";

/** Dotted paper, the home page's background. */
export const paperStyle = {
  backgroundImage:
    "radial-gradient(color-mix(in oklab, var(--tt-ink) 10%, transparent) 1.2px, transparent 1.3px)",
  backgroundSize: "22px 22px",
};

function Underline() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 300 30"
      preserveAspectRatio="none"
      className="absolute -bottom-[0.14em] left-[-2%] -z-10 h-[0.3em] w-[106%]"
    >
      <path
        d="M4 20 C 60 6, 120 28, 180 14 S 270 8, 296 18"
        fill="none"
        stroke="var(--tt-coral)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The sign-in page's left half on a wide screen: the home page's headline and a few
 * stickers of what's waiting inside. Decorative; the words are read once as a summary.
 */
export function SignInShowcase() {
  return (
    <section
      aria-label="What's inside: today's plan, what's safe to spend, and your streaks"
      className="relative isolate flex flex-col justify-center gap-10"
    >
      <div className="flex flex-wrap gap-2.5" aria-hidden>
        {[
          ["বাংলা + English", "bg-mint/25 -rotate-3"],
          ["No ads. Ever.", "bg-grape/20 rotate-2"],
          ["Phone + browser", "bg-sky/20 -rotate-1"],
        ].map(([label, tone]) => (
          <span
            key={label}
            className={cx(
              "rounded-full border-2 border-ink px-3 py-1 text-caption font-extrabold shadow-[3px_3px_0_var(--tt-ink)] dark:shadow-[3px_3px_0_rgb(0_0_0)]",
              tone,
            )}
          >
            {label}
          </span>
        ))}
      </div>
      <h2 className="text-[clamp(3rem,5.4vw,5.25rem)] leading-[0.95] font-black tracking-[-0.045em]">
        <span className="block">Your days.</span>
        <span className="block text-mango-text">Your taka.</span>
        <span className="relative inline-block whitespace-nowrap">
          One app.
          <Underline />
        </span>
      </h2>

      <div aria-hidden className="relative h-64 max-w-xl">
        <div className={cx(sticker, "absolute top-0 left-0 w-60 -rotate-3 rounded-3xl p-5")}>
          <p className="text-caption text-muted">Safe to spend today</p>
          <p className="text-[2.5rem] leading-tight font-black text-mint-text tabular">৳1,785</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full w-1/5 rounded-full bg-mint" />
          </div>
        </div>
        <div
          className={cx(
            sticker,
            "absolute top-8 left-[16.5rem] w-56 rotate-2 rounded-3xl bg-sky/15 p-5",
          )}
        >
          <p className="text-caption text-muted">Top three</p>
          <p className="mt-1 text-heading">1 of 3 done</p>
          <div className="mt-3 flex gap-2">
            <span className="size-5 rounded-full border-2 border-sky bg-sky" />
            <span className="size-5 rounded-full border-2 border-sky-text" />
            <span className="size-5 rounded-full border-2 border-sky-text" />
          </div>
        </div>
        <div
          className={cx(
            sticker,
            "absolute top-40 left-24 w-52 -rotate-1 rounded-3xl bg-grape/15 px-5 py-4",
          )}
        >
          <p className="text-heading">7-day streak 🔥</p>
          <p className="text-caption text-muted">Two freeze days left this month</p>
        </div>
        <div className="absolute top-44 left-[23rem] flex items-end gap-2">
          <Tiki mood="cheering" size={92} />
          <p
            className={cx(
              sticker,
              "mb-16 w-max max-w-56 rounded-2xl rounded-bl-md bg-mango px-3 py-2 text-callout font-extrabold text-on-mango",
            )}
          >
            I kept your streak warm.
          </p>
        </div>
      </div>
    </section>
  );
}
