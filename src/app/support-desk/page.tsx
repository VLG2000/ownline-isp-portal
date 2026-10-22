"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell, Badge, useApi, cardStyle, btnSmall, statusStyle, useTide } from "../ui";

// Support staff view. The role check here only hides the page; the real check
// is server-side in /api/support-desk (withRole "support-agent").
interface DeskTicket {
  id: string;
  subject: string;
  category: string;
  sharedSummary: string;
  privateShared: string | null;
  hasPrivateDetails: boolean;
  status: string;
  createdAt: string;
}

const STATUSES = ["open", "in-progress", "resolved"];

function Desk() {
  const { authenticated, hasRealmRole } = useTide();
  const api = useApi();
  const [tickets, setTickets] = useState<DeskTicket[]>([]);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const { tickets } = await api<{ tickets: DeskTicket[] }>("/api/support-desk");
    setTickets(tickets);
  }, [api]);

  useEffect(() => {
    if (authenticated && hasRealmRole("support-agent")) load().catch((e) => setStatus(`Could not load: ${e.message}`));
  }, [authenticated, hasRealmRole, load]);

  if (!hasRealmRole("support-agent")) {
    return <p>This page is for support staff (role <code>support-agent</code>).</p>;
  }

  const setTicketStatus = async (id: string, next: string) => {
    try {
      await api("/api/support-desk", { method: "PATCH", body: JSON.stringify({ id, status: next }) });
      await load();
    } catch (e: any) {
      setStatus(`Update failed: ${e.message}`);
    }
  };

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Support desk</h1>
      <p style={{ color: "var(--muted)" }}>
        You see what each customer chose to share. Their private notes and account details are encrypted and are never
        sent to this page.
      </p>
      {status && <p style={statusStyle}>{status}</p>}
      {tickets.length === 0 && <p style={{ color: "var(--faint)" }}>No tickets.</p>}
      {tickets.map((t) => (
        <div key={t.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
            <strong>{t.subject}</strong>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              {t.category} · {new Date(t.createdAt).toLocaleString()}
            </span>
          </div>
          <p style={{ color: "#c3c8d4", fontSize: "0.9rem" }}>
            <Badge kind="shared" /> {t.sharedSummary || "(customer shared nothing)"}
          </p>
          {t.privateShared && (
            <p style={{ color: "#c3c8d4", fontSize: "0.9rem" }}>
              <Badge kind="shared" /> Extra notes: {t.privateShared}
            </p>
          )}
          {t.hasPrivateDetails && (
            <p style={{ fontSize: "0.85rem", color: "var(--faint)" }}>🔒 The customer also has private notes you cannot read.</p>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {STATUSES.map((s) => (
              <button
                key={s}
                disabled={s === t.status}
                onClick={() => setTicketStatus(t.id, s)}
                style={{ ...btnSmall, background: s === t.status ? "var(--surface-2)" : "var(--accent-strong)" }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function SupportDeskPage() {
  return (
    <Shell>
      <Desk />
    </Shell>
  );
}
