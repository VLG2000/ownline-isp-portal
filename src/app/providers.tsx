"use client";

import { TideCloakProvider } from "@tidecloak/nextjs";
import tcConfig from "../../data/tidecloak.json";
import { DEMO_MODE } from "@/lib/demo";

// The provider takes the adapter JSON directly as the config prop.
// useDPoP goes inside the config object, not as a separate JSX prop (I-12).
// In demo mode the provider is skipped entirely, so no login redirect runs.
export function Providers({ children }: { children: React.ReactNode }) {
  if (DEMO_MODE) return <>{children}</>;
  return (
    <TideCloakProvider
      config={{ ...tcConfig, useDPoP: { mode: "strict", alg: "ES256" } }}
    >
      {children}
    </TideCloakProvider>
  );
}
