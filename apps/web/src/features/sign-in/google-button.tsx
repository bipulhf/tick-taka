import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID } from "@/lib/config";

// hl=en: the page is in English; otherwise Google follows the browser's language.
const SCRIPT_URL = "https://accounts.google.com/gsi/client?hl=en";
let scriptLoad: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoad = null;
      reject(new Error("Google sign-in didn't load"));
    };
    document.head.append(script);
  });
  return scriptLoad;
}

/**
 * Google's own "Sign in with Google" button (Google Identity Services). It hands
 * back an ID token for our Web client ID, the same one the phone uses.
 */
export function GoogleButton({
  onCredential,
  onUnavailable,
}: {
  onCredential: (idToken: string) => void;
  onUnavailable: (message: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const callback = useRef(onCredential);
  callback.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      onUnavailable("Google sign-in isn't set up for this site yet (VITE_GOOGLE_CLIENT_ID).");
      return;
    }
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        const google = window.google;
        if (cancelled || !google || !host.current) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => callback.current(response.credential),
          ux_mode: "popup",
          use_fedcm_for_prompt: true,
        });
        google.accounts.id.renderButton(host.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 280,
          logo_alignment: "left",
          // The page is in English; without this Google follows the browser's language.
          locale: "en",
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) onUnavailable("Couldn't reach Google. Check your connection and reload.");
      });
    return () => {
      cancelled = true;
    };
  }, [onUnavailable]);

  return (
    <div className="flex min-h-11 items-center justify-center">
      <div ref={host} />
      {ready ? null : <span className="text-callout text-muted">Loading Google sign-in…</span>}
    </div>
  );
}
