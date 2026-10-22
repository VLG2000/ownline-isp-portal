"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTideCloak } from "@tidecloak/nextjs";
import { useCallback, useEffect, useState } from "react";
import { DEMO_MODE, PERSONAS, PERSONA_HEADER, getPersona, setPersona, demoEncrypt, demoDecrypt, type PersonaId } from "@/lib/demo";
import type { Prefs } from "@/lib/privacy";

// The subset of the Tide SDK the pages use. In demo mode it is served by
// src/lib/demo.ts; DEMO_MODE is a build-time constant, so the hook choice is fixed.
interface TideApi {
  authenticated: boolean;
  isInitializing: boolean;
  login: () => void;
  logout: () => void;
  hasRealmRole: (role: string) => boolean;
  doEncrypt: (items: { data: string; tags: string[] }[]) => Promise<string[]>;
  doDecrypt: (items: { encrypted: string; tags: string[] }[]) => Promise<string[]>;
  secureFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const DEMO_TIDE: TideApi = {
  authenticated: true,
  isInitializing: false,
  login: () => {},
  logout: () => {},
  hasRealmRole: (role) => (PERSONAS[getPersona()].roles as readonly string[]).includes(role),
  doEncrypt: demoEncrypt,
  doDecrypt: demoDecrypt,
  // The server's demo bypass reads the persona from this header (dev only).
  secureFetch: (url, init) => {
    const headers = new Headers(init?.headers);
    headers.set(PERSONA_HEADER, getPersona());
    return fetch(url, { ...init, headers });
  },
};

export const useTide: () => TideApi = DEMO_MODE ? () => DEMO_TIDE : (useTideCloak as unknown as () => TideApi);

// Calls our own API through the SDK's secureFetch, which attaches the DPoP
// proof every protected route verifies. A bare fetch would be rejected (AP-73).
// secureFetch needs an absolute URL to build the proof's htu (AP-74).
export function useApi() {
  const { secureFetch } = useTide();
  return useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const res = await secureFetch(new URL(path, window.location.origin).href, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      return body as T;
    },
    [secureFetch]
  );
}

// The customer's per-field privacy choices (see src/lib/privacy.ts).
export function usePrefs() {
  const { authenticated } = useTide();
  const api = useApi();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => {
    if (authenticated) api<{ prefs: Prefs }>("/api/privacy").then((r) => setPrefs(r.prefs)).catch(() => setPrefs(null));
  }, [authenticated, api]);
  return [prefs, setPrefs] as const;
}

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/account", label: "My account" },
  { href: "/usage", label: "Usage" },
  { href: "/support", label: "Support" },
  { href: "/privacy", label: "What your ISP sees" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { authenticated, isInitializing, login, logout, hasRealmRole } = useTide();
  const pathname = usePathname();
  // Demo persona lives in localStorage, which the server render cannot see:
  // render only after mount so server and client markup match.
  const [mounted, setMounted] = useState(!DEMO_MODE);
  useEffect(() => setMounted(true), []);

  if (isInitializing || !mounted) return <p className="page" style={{ color: "var(--muted)", paddingTop: "4rem" }}>Loading…</p>;

  if (!authenticated) {
    return (
      <div className="hero">
        <div className="brand" style={{ justifyContent: "center", marginBottom: "1.5rem" }}>
          <span className="brand-mark">◆</span> OwnLine
        </div>
        <h1>Your internet account. Your keys.</h1>
        <p className="lede" style={{ margin: "0 auto" }}>
          Manage your service while your personal details and usage history stay encrypted in your browser. Your ISP
          stores them but can&apos;t read them — unless you choose to share.
        </p>
        <div className="value-props">
          <div>
            <strong>🔒 Encrypted by default</strong>
            Name, address, phone and usage detail are locked to your login.
          </div>
          <div>
            <strong>🎚 You decide</strong>
            Share any field with your ISP, and take it back at any time.
          </div>
          <div>
            <strong>🛡 No data to sell</strong>
            No single server — not even the ISP&apos;s — holds the key.
          </div>
        </div>
        <button onClick={login} style={{ ...btnPrimary, padding: "0.8rem 1.8rem", fontSize: "1rem" }}>
          Sign in with Tide
        </button>
      </div>
    );
  }

  const nav = [
    ...links,
    ...(hasRealmRole("support-agent") ? [{ href: "/support-desk", label: "Support desk" }] : []),
    ...(hasRealmRole("isp-admin") ? [{ href: "/admin", label: "ISP admin" }] : []),
  ];

  return (
    <>
      {DEMO_MODE && (
        <div className="demo-banner">
          <span>
            <strong>Demo mode</strong> — Tide sign-in is skipped; each person&apos;s data is encrypted with their own key
            kept in this browser, not the Tide network.
          </span>
          <button
            onClick={async () => {
              if (!confirm("Reset all demo data? Every demo user's saved details, usage and tickets are deleted.")) return;
              await fetch("/api/demo/reset", { method: "POST" });
              (Object.keys(PERSONAS) as PersonaId[]).forEach((p) => {
                try {
                  localStorage.removeItem(`isp-portal-demo-key-${p}`);
                } catch {}
              });
              window.location.assign("/");
            }}
            style={{ ...btnSmall, background: "transparent", color: "var(--amber)", border: "1px solid #4a3a14", marginLeft: "auto" }}
          >
            Reset demo data
          </button>
          <label style={{ whiteSpace: "nowrap" }}>
            Viewing as{" "}
            <select
              value={getPersona()}
              onChange={(e) => {
                setPersona(e.target.value as PersonaId);
                window.location.assign(e.target.value === "admin" ? "/admin" : e.target.value === "agent" ? "/support-desk" : "/");
              }}
              style={{ background: "var(--bg)", color: "var(--amber)", border: "1px solid #4a3a14", borderRadius: 6, padding: "0.25rem 0.4rem" }}
            >
              {(Object.keys(PERSONAS) as PersonaId[]).map((p) => (
                <option key={p} value={p}>
                  {PERSONAS[p].label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <span className="brand-mark">◆</span> OwnLine
          </Link>
          <nav className="nav">
            {nav.map((l) => (
              <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          {!DEMO_MODE && (
            <button onClick={logout} style={{ ...btnSmall, background: "var(--surface-2)", marginLeft: "auto" }}>
              Sign out
            </button>
          )}
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

export function Badge({ kind }: { kind: "encrypted" | "visible" | "shared" }) {
  const map = {
    encrypted: { text: "🔒 Encrypted", bg: "var(--green-bg)", fg: "var(--green)" },
    visible: { text: "👁 Visible to ISP", bg: "var(--amber-bg)", fg: "var(--amber)" },
    shared: { text: "↗ Shared with support", bg: "var(--blue-bg)", fg: "var(--blue)" },
  }[kind];
  return (
    <span style={{ background: map.bg, color: map.fg, fontSize: "0.74rem", fontWeight: 500, padding: "0.18rem 0.55rem", borderRadius: 999, whiteSpace: "nowrap" }}>
      {map.text}
    </span>
  );
}

export const btnPrimary: React.CSSProperties = {
  background: "var(--accent-strong)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "0.6rem 1.2rem",
  fontSize: "0.95rem",
  fontWeight: 500,
  cursor: "pointer",
};

export const btnSmall: React.CSSProperties = {
  background: "var(--accent-strong)",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "0.4rem 0.8rem",
  fontSize: "0.85rem",
  cursor: "pointer",
};

export const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "1.25rem 1.4rem",
  marginBottom: "1rem",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.7rem",
  marginBottom: "0.75rem",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: "0.95rem",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export const statusStyle: React.CSSProperties = { color: "var(--blue)", fontSize: "0.9rem", margin: "1rem 0" };
