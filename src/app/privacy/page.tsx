"use client";

import { useState } from "react";
import { Shell, Badge, useApi, usePrefs, useTide, cardStyle, statusStyle } from "../ui";
import { FIELDS, type Prefs, type Visibility } from "@/lib/privacy";
import {
  decodeAccount, encodeAccount, decodeUsage, encodeUsage, decodeNotes, encodeNotes,
  type AccountRecord, type UsageMonth, type TicketNotes,
} from "../records";

// A live data map: each customer-controllable field can be switched between
// encrypted and shared. Switching re-saves existing records in the new form —
// decrypted and re-encrypted in this browser, never on the server.
const SECTIONS = ["Account", "Usage", "Support", "Service"] as const;

function Privacy() {
  const { doEncrypt, doDecrypt } = useTide();
  const api = useApi();
  const [prefs, setPrefs] = usePrefs();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  // Re-save every stored record that contains a field under `prefix`, using
  // the new prefs. Order matters: prefs are saved first, so the server accepts
  // the new plaintext / stops accepting the old.
  const migrate = async (prefix: string, next: Prefs) => {
    if (prefix === "account") {
      const { account } = await api<{ account: AccountRecord | null }>("/api/account");
      if (!account) return 0;
      const profile = await decodeAccount(account, doDecrypt);
      await api("/api/account", { method: "PUT", body: JSON.stringify(await encodeAccount(profile, next, doEncrypt)) });
      return 1;
    }
    if (prefix === "usage") {
      const { months } = await api<{ months: UsageMonth[] }>("/api/usage");
      for (const m of months) {
        const detail = await decodeUsage(m, doDecrypt);
        await api("/api/usage", {
          method: "POST",
          body: JSON.stringify({ month: m.month, gbUsed: m.gbUsed, ...(await encodeUsage(detail, next, doEncrypt)) }),
        });
      }
      return months.length;
    }
    if (prefix === "support") {
      const { tickets } = await api<{ tickets: (TicketNotes & { id: string })[] }>("/api/support");
      const withNotes = tickets.filter((t) => t.privateCiphertext || t.privateShared);
      for (const t of withNotes) {
        const text = await decodeNotes(t, doDecrypt);
        await api("/api/support", { method: "PATCH", body: JSON.stringify({ id: t.id, ...(await encodeNotes(text, next, doEncrypt)) }) });
      }
      return withNotes.length;
    }
    return 0;
  };

  const toggle = async (key: string, to: Visibility) => {
    if (!prefs) return;
    const prev = prefs;
    const next = { ...prefs, [key]: to };
    setBusyKey(key);
    setStatus(to === "encrypted" ? "Encrypting existing data in your browser..." : "Decrypting existing data to share it...");
    try {
      // Going private: re-encrypt first, then tighten the server rule — so plaintext never lingers.
      // Going shared: loosen the server rule first, then upload the plaintext.
      if (to === "shared") await api("/api/privacy", { method: "PUT", body: JSON.stringify({ prefs: next }) });
      const count = await migrate(key.split(".")[0], next);
      if (to === "encrypted") await api("/api/privacy", { method: "PUT", body: JSON.stringify({ prefs: next }) });
      setPrefs(next);
      const label = FIELDS.find((f) => f.key === key)!.label;
      setStatus(`${label}: now ${to === "encrypted" ? "encrypted — only you can read it" : "shared with your ISP"}. ${count} record(s) updated.`);
    } catch (e: any) {
      setStatus(`Change failed, nothing was switched: ${e.message || e}`);
      await api("/api/privacy", { method: "PUT", body: JSON.stringify({ prefs: prev }) }).catch(() => {});
      setPrefs(prev);
    } finally {
      setBusyKey(null);
    }
  };

  const encryptedCount = prefs ? Object.values(prefs).filter((v) => v === "encrypted").length : 0;
  const controllable = FIELDS.filter((f) => !f.locked).length;

  return (
    <>
      <h1 style={{ marginTop: 0 }}>What your ISP can see</h1>
      <p style={{ color: "var(--muted)" }}>
        You decide. Encrypted items can only be decrypted with your login — the ISP stores them but can&apos;t read
        them. Shared items help the ISP serve you. Switching re-saves your existing data straight away.
      </p>
      {prefs && (
        <p style={{ fontSize: "0.95rem" }}>
          <strong>{encryptedCount}</strong> of {controllable} personal fields are encrypted.
        </p>
      )}
      {status && <p style={statusStyle}>{status}</p>}
      {!prefs && <p>Loading your choices...</p>}

      {prefs &&
        SECTIONS.map((section) => (
          <section key={section}>
            <h2 style={{ fontSize: "1.1rem", marginTop: "1.5rem" }}>{section}</h2>
            {FIELDS.filter((f) => f.section === section).map((f) => {
              const vis = f.locked ? "visible" : prefs[f.key];
              const kind = f.key === "support.summary" ? "shared" : vis === "encrypted" ? "encrypted" : "visible";
              return (
                <div key={f.key} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ flex: "1 1 320px" }}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{f.label}</strong>
                      <Badge kind={kind} />
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                      {vis === "shared" && f.whyShared ? f.whyShared : f.why}
                    </div>
                  </div>
                  {f.locked ? (
                    <span style={{ color: "var(--faint)", fontSize: "0.85rem" }}>🔐 Required by ISP</span>
                  ) : (
                    <Switch
                      on={vis === "encrypted"}
                      busy={busyKey === f.key}
                      disabled={busyKey !== null}
                      onChange={(on) => toggle(f.key, on ? "encrypted" : "shared")}
                    />
                  )}
                </div>
              );
            })}
          </section>
        ))}

      <div style={{ ...cardStyle, borderColor: "#5a4a1a", marginTop: "1.5rem" }}>
        <strong>Not covered by this portal</strong>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 0 }}>
          Like any ISP, the network itself carries your traffic, and the law may require some connection records to be
          kept. This portal protects the account and usage data it stores, not traffic on the wire.
        </p>
      </div>
    </>
  );
}

function Switch({ on, busy, disabled, onChange }: { on: boolean; busy: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        display: "flex", alignItems: "center", gap: "0.5rem", background: "transparent", border: "none",
        color: "#ededed", cursor: disabled ? "wait" : "pointer", fontSize: "0.85rem", opacity: disabled && !busy ? 0.5 : 1,
      }}
    >
      <span style={{ width: 70, textAlign: "right" }}>{busy ? "Saving..." : on ? "Encrypted" : "Shared"}</span>
      <span style={{ width: 40, height: 22, borderRadius: 999, background: on ? "#16a34a" : "#b45309", position: "relative", transition: "background 0.2s" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </span>
    </button>
  );
}

export default function PrivacyPage() {
  return (
    <Shell>
      <Privacy />
    </Shell>
  );
}
