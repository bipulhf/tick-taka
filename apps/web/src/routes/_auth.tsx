import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageTitle } from "@/components/shell/page-title";
import { ThemeSync } from "@/components/shell/theme-sync";
import { refreshSessionIfStale, tokenStore } from "@/lib/auth";
import { useStore } from "@/lib/store";

/** Everything signed in. Without a session, the sign-in page; with one, refreshed when stale. */
export const Route = createFileRoute("/_auth")({
  beforeLoad: () => {
    if (!tokenStore.get()) throw redirect({ to: "/login" });
  },
  component: SignedIn,
});

function SignedIn() {
  const token = useStore(tokenStore);
  const navigate = useNavigate();
  useEffect(() => {
    if (!token) void navigate({ to: "/login", replace: true });
  }, [token, navigate]);
  useEffect(() => void refreshSessionIfStale(), []);
  if (!token) return null;
  return (
    <>
      <ThemeSync />
      <PageTitle />
      <Outlet />
    </>
  );
}
