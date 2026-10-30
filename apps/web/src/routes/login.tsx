import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Tiki } from "@/components/tiki/tiki";
import { GoogleButton } from "@/features/sign-in/google-button";
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
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <Tiki mood={notice ? "calm" : "happy"} size={112} />
        <h1 className="mt-6 text-large-title">Tick & Taka</h1>
        <p className="mt-2 text-body text-muted">
          Your days and your money, on one screen. See what to do next and what's safe to spend, and
          log anything in a few seconds.
        </p>
        <div className="mt-8 flex w-full flex-col items-center gap-3 rounded-3xl bg-card px-6 py-7">
          {notice ? (
            <p role="status" className="text-callout font-semibold">
              {notice}
            </p>
          ) : profile ? (
            <p className="text-callout font-semibold">
              Welcome back, {profile.name ?? profile.email}.
            </p>
          ) : null}
          {busy ? (
            <p role="status" className="text-callout text-muted">
              Signing you in…
            </p>
          ) : (
            <GoogleButton
              onCredential={(idToken) => void finish(signInWithGoogle(idToken))}
              onUnavailable={onUnavailable}
            />
          )}
          {error ? (
            <p role="alert" className="text-callout text-coral-text">
              {error}
            </p>
          ) : null}
          <p className="text-caption font-normal text-muted">
            The same account as the Android app. Your data lives in its own space on the server and
            is never shared.
          </p>
        </div>
        <nav className="mt-6 flex gap-4 text-caption text-muted">
          <a href="/privacy" className="hover:text-ink">
            Privacy
          </a>
          <a href="/terms" className="hover:text-ink">
            Terms
          </a>
        </nav>
      </div>
    </main>
  );
}
