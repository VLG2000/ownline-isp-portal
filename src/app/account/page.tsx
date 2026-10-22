"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell, Badge, useApi, usePrefs, useTide, cardStyle, inputStyle, btnPrimary, statusStyle } from "../ui";
import { decodeAccount, encodeAccount, EMPTY_PROFILE, type AccountRecord, type Profile } from "../records";

// Each field is encrypted (tag `account`, only this customer can decrypt) or
// shared with the ISP, per the customer's choices on the privacy page.
const FIELDS: { key: keyof Profile; label: string; type?: string }[] = [
  { key: "fullName", label: "Full name" },
  { key: "serviceAddress", label: "Service address" },
  { key: "phone", label: "Phone" },
  { key: "dateOfBirth", label: "Date of birth", type: "date" },
];

function Account() {
  const { authenticated, doEncrypt, doDecrypt } = useTide();
  const api = useApi();
  const [prefs] = usePrefs();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [record, setRecord] = useState<AccountRecord | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    api<{ account: AccountRecord | null }>("/api/account")
      .then(({ account }) => {
        setRecord(account);
        if (!account) {
          setUnlocked(true); // nothing stored yet — start with an empty form
        } else if (!account.ciphertext) {
          setProfile({ ...EMPTY_PROFILE, ...account.shared }); // nothing encrypted to unlock
          setUnlocked(true);
        }
      })
      .catch((e) => setStatus(`Could not load account: ${e.message}`));
  }, [authenticated, api]);

  const unlock = async () => {
    if (!record) return;
    setBusy(true);
    setStatus("Decrypting in your browser...");
    try {
      setProfile(await decodeAccount(record, doDecrypt));
      setUnlocked(true);
      setStatus("Decrypted in your browser.");
    } catch (e: any) {
      setStatus(`Decrypt failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!prefs) return;
    setBusy(true);
    setStatus("Encrypting your private fields in your browser...");
    try {
      const { account } = await api<{ account: AccountRecord }>("/api/account", {
        method: "PUT",
        body: JSON.stringify(await encodeAccount(profile, prefs, doEncrypt)),
      });
      setRecord(account);
      setStatus("Saved. Below is exactly what the ISP's database now holds.");
    } catch (e: any) {
      setStatus(`Save failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 style={{ marginTop: 0 }}>My account</h1>
      <p style={{ color: "var(--muted)" }}>
        Private fields are encrypted in your browser before they are sent — the ISP stores them but cannot read them.
        Choose which fields to share on <Link href="/privacy" style={{ color: "var(--blue)" }}>What your ISP sees</Link>.
      </p>

      {status && <p style={statusStyle}>{status}</p>}

      {!unlocked ? (
        <div style={cardStyle}>
          <p>Your private details are locked.</p>
          <button onClick={unlock} disabled={busy} style={btnPrimary}>
            {busy ? "Working..." : "Unlock my details"}
          </button>
        </div>
      ) : (
        <div style={cardStyle}>
          {FIELDS.map((f) => (
            <label key={f.key} style={{ display: "block" }}>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
                {f.label}
                {prefs && <Badge kind={prefs[`account.${f.key}`] === "shared" ? "visible" : "encrypted"} />}
              </span>
              <input
                type={f.type ?? "text"}
                value={profile[f.key]}
                onChange={(e) => setProfile({ ...profile, [f.key]: e.target.value })}
                style={inputStyle}
              />
            </label>
          ))}
          <button onClick={save} disabled={busy || !prefs} style={btnPrimary}>
            {busy ? "Working..." : "Save"}
          </button>
        </div>
      )}

      {record && (
        <div style={cardStyle}>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
            What the ISP&apos;s database holds (saved {new Date(record.updatedAt).toLocaleString()}):
          </div>
          {Object.entries(record.shared).map(([k, v]) => (
            <div key={k} style={{ fontSize: "0.85rem" }}>
              <span style={{ color: "var(--amber)" }}>{k}</span>: {v || <span style={{ color: "var(--faint)" }}>(empty)</span>}
            </div>
          ))}
          {record.ciphertext ? (
            <code style={{ display: "block", wordBreak: "break-all", fontSize: "0.8rem", color: "var(--faint)", marginTop: "0.5rem" }}>
              <span style={{ color: "var(--green)" }}>encrypted</span>: {record.ciphertext.slice(0, 160)}…
            </code>
          ) : (
            <div style={{ fontSize: "0.85rem", color: "var(--faint)", marginTop: "0.5rem" }}>No encrypted fields.</div>
          )}
        </div>
      )}
    </>
  );
}

export default function AccountPage() {
  return (
    <Shell>
      <Account />
    </Shell>
  );
}
