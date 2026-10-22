"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Shell, Badge, useApi, usePrefs, useTide, cardStyle, inputStyle, btnPrimary, btnSmall, statusStyle } from "../ui";
import { decodeUsage, encodeUsage, type UsageDetail, type UsageMonth } from "../records";

// Billing needs each month's total, so `gbUsed` is always visible to the ISP.
// The per-device breakdown and notes are encrypted (tag `usage`) or shared,
// per the customer's choices on the privacy page.
const DEMO_DEVICES = ["Laptop", "Phone", "Smart TV", "Game console", "Tablet"];

function demoDetail(): { gbUsed: number; detail: UsageDetail } {
  const devices = DEMO_DEVICES.map((name) => ({ name, gb: Math.round(Math.random() * 120 + 5) }));
  return { gbUsed: devices.reduce((s, d) => s + d.gb, 0), detail: { devices, notes: "" } };
}

function Usage() {
  const { authenticated, doEncrypt, doDecrypt } = useTide();
  const api = useApi();
  const [prefs] = usePrefs();
  const [months, setMonths] = useState<UsageMonth[]>([]);
  const [details, setDetails] = useState<Record<string, UsageDetail>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteMonth, setNoteMonth] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const load = useCallback(async () => {
    const { months } = await api<{ months: UsageMonth[] }>("/api/usage");
    setMonths(months);
    // Months with nothing encrypted need no unlock.
    const open: Record<string, UsageDetail> = {};
    for (const m of months) if (!m.detailCiphertext && m.detailShared) open[m.month] = await decodeUsage(m, doDecrypt);
    setDetails((d) => ({ ...open, ...d }));
  }, [api, doDecrypt]);

  useEffect(() => {
    if (authenticated) load().catch((e) => setStatus(`Could not load usage: ${e.message}`));
  }, [authenticated, load]);

  const save = (month: string, gbUsed: number, detail: UsageDetail) =>
    encodeUsage(detail, prefs!, doEncrypt).then((enc) =>
      api("/api/usage", { method: "POST", body: JSON.stringify({ month, gbUsed, ...enc }) })
    );

  const generateDemo = async () => {
    if (!prefs) return;
    setBusy(true);
    setStatus("Generating 6 months of demo usage...");
    try {
      const now = new Date();
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const { gbUsed, detail } = demoDetail();
        await save(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, gbUsed, detail);
      }
      setDetails({});
      await load();
      setStatus("Demo usage stored, following your privacy choices.");
    } catch (e: any) {
      setStatus(`Failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const revealAll = async () => {
    setBusy(true);
    setStatus("Decrypting your usage detail in your browser...");
    try {
      const next = { ...details };
      for (const m of months) if (!next[m.month]) next[m.month] = await decodeUsage(m, doDecrypt);
      setDetails(next);
      setStatus("Decrypted in your browser.");
    } catch (e: any) {
      setStatus(`Decrypt failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async (m: UsageMonth) => {
    const detail = details[m.month];
    if (!detail || !prefs) return;
    setBusy(true);
    try {
      const updated = { ...detail, notes: noteText };
      await save(m.month, m.gbUsed, updated);
      setDetails({ ...details, [m.month]: updated });
      setNoteMonth(null);
      await load();
      setStatus("Note saved.");
    } catch (e: any) {
      setStatus(`Save failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const kind = (key: string) => (prefs?.[key] === "shared" ? "visible" : "encrypted");
  const locked = months.some((m) => m.detailCiphertext && !details[m.month]);

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Usage</h1>
      <p style={{ color: "var(--muted)" }}>
        Your ISP needs each month&apos;s total to bill you. Device detail and notes follow your choices on{" "}
        <Link href="/privacy" style={{ color: "var(--blue)" }}>What your ISP sees</Link>.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button onClick={revealAll} disabled={busy || !locked} style={btnPrimary}>
          Unlock device detail
        </button>
        <button onClick={generateDemo} disabled={busy || !prefs} style={{ ...btnPrimary, background: "var(--surface-2)" }}>
          Generate demo usage
        </button>
      </div>
      {status && <p style={statusStyle}>{status}</p>}

      {months.length === 0 && <p style={{ color: "var(--faint)" }}>No usage yet. Generate demo usage to try it out.</p>}

      {months.map((m) => {
        const d = details[m.month];
        return (
          <div key={m.month} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <strong>{m.month}</strong>
              <span>
                {m.gbUsed} GB <Badge kind="visible" />
              </span>
            </div>
            <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Device breakdown</span>
              <Badge kind={kind("usage.devices")} />
            </div>
            {d ? (
              <>
                <table style={{ width: "100%", fontSize: "0.9rem", marginTop: "0.5rem", borderCollapse: "collapse" }}>
                  <tbody>
                    {d.devices.map((dev) => (
                      <tr key={dev.name} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.3rem 0" }}>{dev.name}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{dev.gb} GB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Notes</span>
                  <Badge kind={kind("usage.notes")} />
                </div>
                {noteMonth === m.month ? (
                  <div style={{ marginTop: "0.5rem" }}>
                    <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} style={inputStyle} />
                    <button onClick={() => saveNote(m)} disabled={busy} style={btnSmall}>
                      Save note
                    </button>
                  </div>
                ) : (
                  <p style={{ fontSize: "0.9rem", color: "#c3c8d4" }}>
                    {d.notes || <span style={{ color: "var(--faint)" }}>No notes.</span>}{" "}
                    <button
                      onClick={() => {
                        setNoteMonth(m.month);
                        setNoteText(d.notes);
                      }}
                      style={{ ...btnSmall, background: "var(--surface-2)" }}
                    >
                      Edit note
                    </button>
                  </p>
                )}
              </>
            ) : (
              <code style={{ display: "block", wordBreak: "break-all", fontSize: "0.75rem", color: "var(--faint)", marginTop: "0.5rem" }}>
                {m.detailCiphertext ? `${m.detailCiphertext.slice(0, 100)}…` : "No detail recorded."}
              </code>
            )}
          </div>
        );
      })}
    </>
  );
}

export default function UsagePage() {
  return (
    <Shell>
      <Usage />
    </Shell>
  );
}
