"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell, Badge, useApi, usePrefs, useTide, cardStyle, inputStyle, btnPrimary, btnSmall, statusStyle } from "../ui";
import { decodeNotes, encodeNotes } from "../records";

// The customer writes two things: a summary they choose to share with support
// (plaintext, by explicit choice), and extra notes that follow the
// "support.privateNotes" privacy choice — encrypted (tag `account`, support
// never receives the ciphertext) or shared with support.

interface Ticket {
  id: string;
  subject: string;
  category: string;
  sharedSummary: string;
  privateCiphertext: string | null;
  privateShared: string | null;
  status: string;
  createdAt: string;
}

function Support() {
  const { authenticated, doEncrypt, doDecrypt } = useTide();
  const api = useApi();
  const [prefs] = usePrefs();
  const notesShared = prefs?.["support.privateNotes"] === "shared";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("outage");
  const [shared, setShared] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { tickets } = await api<{ tickets: Ticket[] }>("/api/support");
    setTickets(tickets);
  }, [api]);

  useEffect(() => {
    if (authenticated) load().catch((e) => setStatus(`Could not load tickets: ${e.message}`));
  }, [authenticated, load]);

  const submit = async () => {
    if (!subject.trim()) {
      setStatus("A subject is required.");
      return;
    }
    if (!prefs) return;
    setBusy(true);
    setStatus(privateNotes.trim() && !notesShared ? "Encrypting your extra notes..." : "Opening ticket...");
    try {
      const notes = await encodeNotes(privateNotes, prefs, doEncrypt);
      await api("/api/support", {
        method: "POST",
        body: JSON.stringify({ subject, category, sharedSummary: shared, ...notes }),
      });
      setSubject("");
      setShared("");
      setPrivateNotes("");
      await load();
      setStatus(notesShared ? "Ticket opened. Support can read the summary and your extra notes." : "Ticket opened. Support can read only the shared summary.");
    } catch (e: any) {
      setStatus(`Failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const reveal = async (t: Ticket) => {
    setBusy(true);
    try {
      setRevealed({ ...revealed, [t.id]: await decodeNotes(t, doDecrypt) });
    } catch (e: any) {
      setStatus(`Decrypt failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Support</h1>
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Open a ticket</h2>
        <input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          <option value="outage">Outage</option>
          <option value="speed">Slow speed</option>
          <option value="billing">Billing</option>
          <option value="other">Other</option>
        </select>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>What support needs to know</span>
          <Badge kind="shared" />
        </div>
        <textarea
          placeholder="e.g. Connection drops every evening around 8pm"
          value={shared}
          onChange={(e) => setShared(e.target.value)}
          rows={3}
          style={{ ...inputStyle, marginTop: "0.25rem" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            {notesShared ? "Extra notes (sent to support)" : "Private notes (for your own records)"}
          </span>
          <Badge kind={notesShared ? "shared" : "encrypted"} />
        </div>
        <textarea
          placeholder={notesShared ? "More detail for the support team" : "Anything you don't want the ISP to read"}
          value={privateNotes}
          onChange={(e) => setPrivateNotes(e.target.value)}
          rows={2}
          style={{ ...inputStyle, marginTop: "0.25rem" }}
        />
        <button onClick={submit} disabled={busy} style={btnPrimary}>
          {busy ? "Working..." : "Open ticket"}
        </button>
      </div>

      {status && <p style={statusStyle}>{status}</p>}

      <h2>Your tickets ({tickets.length})</h2>
      {tickets.length === 0 && <p style={{ color: "var(--faint)" }}>No tickets yet.</p>}
      {tickets.map((t) => (
        <div key={t.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
            <strong>{t.subject}</strong>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              {t.category} · {t.status} · {new Date(t.createdAt).toLocaleString()}
            </span>
          </div>
          <p style={{ color: "#c3c8d4", fontSize: "0.9rem" }}>
            <Badge kind="shared" /> {t.sharedSummary || <span style={{ color: "var(--faint)" }}>(nothing shared)</span>}
          </p>
          {t.privateShared && (
            <p style={{ fontSize: "0.9rem" }}>
              <Badge kind="shared" /> {t.privateShared}
            </p>
          )}
          {t.privateCiphertext &&
            (revealed[t.id] ? (
              <p style={{ fontSize: "0.9rem" }}>
                <Badge kind="encrypted" /> {revealed[t.id]}
              </p>
            ) : (
              <button onClick={() => reveal(t)} disabled={busy} style={{ ...btnSmall, background: "var(--surface-2)" }}>
                Show my private notes
              </button>
            ))}
        </div>
      ))}
    </>
  );
}

export default function SupportPage() {
  return (
    <Shell>
      <Support />
    </Shell>
  );
}
