"use client";

import { useTideCloak } from "@tidecloak/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// OIDC callback page. The TideCloakProvider in the layout already completes the
// login: its init reads ?code= from this URL and exchanges it once. This page
// must NOT start a second exchange (the SDK's useAuthCallback does): the Tide
// network accepts each login approval once, so two concurrent exchanges of the
// same code are both refused (ORK TidecloakSessionStartTokenSign). It only
// waits for the provider, then navigates client-side so the in-memory session
// survives (a full reload would depend on silent SSO, which browsers block).
export default function AuthRedirectPage() {
  const { isInitializing, authenticated } = useTideCloak();
  const router = useRouter();

  useEffect(() => {
    if (isInitializing) return;
    const params = new URLSearchParams(window.location.search);
    if (authenticated || (!params.has("code") && !params.has("error"))) {
      const stored = sessionStorage.getItem("kc_return_url") || "/";
      const url = new URL(stored, window.location.origin);
      router.replace(url.origin === window.location.origin ? url.pathname + url.search : "/");
    } else {
      console.error("[auth/redirect] login failed: not authenticated after the code exchange");
    }
  }, [isInitializing, authenticated, router]);

  if (isInitializing || authenticated) return <p>Completing login...</p>;
  return (
    <p>
      Authentication failed — <a href="/">back to start</a>
    </p>
  );
}
