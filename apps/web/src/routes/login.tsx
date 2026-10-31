import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Tiki } from "@/components/tiki/tiki";
import { cx } from "@/components/ui/cx";
import { IconButton } from "@/components/ui/icon-button";
import { GoogleButton } from "@/features/sign-in/google-button";
import { paperStyle, SignInShowcase, sticker } from "@/features/sign-in/sign-in-showcase";
import {
  profileStore,
  signedOutNoticeStore,
  signInWithDemoToken,
  signInWithGoogle,
  tokenStore,
} from "@/lib/auth";
import { DEMO_SIGN_IN } from "@/lib/config";
import { friendlyError } from "@/lib/error-copy";
import { useStore } from "@/lib/store";
import { toggleTheme, useTheme } from "@/lib/theme";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { demoToken?: string } =>
    typeof search.demoToken === "string" ? { demoToken: search.demoToken } : {},
  beforeLoad: ({ search }) => {
    if (tokenStore.get() && !search.demoToken) throw redirect({ to: "/" });
  },
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const { demoToken } = Route.useSearch();
  const notice = useStore(signedOutNoticeStore);
  const profile = useStore(profileStore);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dark = useTheme() === "dark";

  const finish = useCallback(
    async (attempt: Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await attempt;
        void navigate({ to: "/", replace: true });
      } catch (caught) {
        setError(friendlyError(caught, "signIn"));
      } finally {
        setBusy(false);
      }
    },
    [navigate],
  );

  const triedDemo = useRef(false);
  useEffect(() => {
    if (!demoToken || !DEMO_SIGN_IN || triedDemo.current) return;
    triedDemo.current = true;
    void finish(signInWithDemoToken(demoToken));
  }, [demoToken, finish]);

  const onUnavailable = useCallback((message: string) => setError(message), []);

  return (
    <div className="flex min-h-dvh flex-col" style={paperStyle}>
      <header className="flex items-center gap-3 px-5 py-4 sm:px-10">
        <a href="/" className="flex items-center gap-2 rounded-xl text-heading font-black">
          <Tiki mood="happy" size={36} />
          TickNTaka
        </a>
        <IconButton
          icon={dark ? Sun : Moon}
          label={dark ? "Switch to light theme" : "Switch to dark theme"}
          onClick={toggleTheme}
          className="ml-auto"
        />
      </header>
      <main className="grid flex-1 items-center gap-12 px-5 pt-4 pb-12 sm:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 xl:px-20">
        <div className="hidden lg:block">
          <SignInShowcase />
        </div>
        <div className="mx-auto w-full max-w-md">
          <div
            className={cx(
              sticker,
              "flex flex-col items-center gap-5 rounded-[2rem] px-7 py-9 text-center sm:px-10",
            )}
          >
            <Tiki mood={notice ? "calm" : "cheering"} size={96} />
            <div>
              <h1 className="text-large-title font-black tracking-tight">
                {profile && !notice ? "Welcome back" : "Hello there"}
              </h1>
              <p className="mt-2 text-body text-muted">
                {notice ??
                  (profile
                    ? `Good to see you, ${profile.name ?? profile.email}. Tiki kept your seat warm.`
                    : "Your days and your money, on one screen. Sign in and log your first cha.")}
              </p>
            </div>
            {busy ? (
              <p
                role="status"
                className="flex min-h-11 items-center gap-2 text-callout font-bold text-muted"
              >
                <span
                  aria-hidden
                  className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                Signing you in…
              </p>
            ) : (
              <GoogleButton
                onCredential={(idToken) => void finish(signInWithGoogle(idToken))}
                onUnavailable={onUnavailable}
              />
            )}
            {error ? (
              <p
                role="alert"
                className="rounded-2xl bg-coral/15 px-4 py-2 text-callout font-semibold text-coral-text"
              >
                {error}
              </p>
            ) : null}
            <ul className="flex w-full flex-col gap-2 border-t-2 border-dashed border-line pt-5 text-left text-callout">
              {[
                "Same account as the Android app",
                "Your data lives in its own space, never shared",
                "No ads, no trackers, no nonsense",
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="flex size-5 shrink-0 items-center justify-center rounded-full bg-mint text-[0.7rem] font-black text-on-mango"
                  >
                    ✓
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <nav className="mt-6 flex justify-center gap-5 text-caption text-muted">
            <a href="/" className="hover:text-ink">
              Home
            </a>
            <a href="/privacy" className="hover:text-ink">
              Privacy
            </a>
            <a href="/terms" className="hover:text-ink">
              Terms
            </a>
          </nav>
        </div>
      </main>
    </div>
  );
}
