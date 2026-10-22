"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell, Badge, useApi, useTide, cardStyle, btnSmall, statusStyle } from "../ui";

// ISP admin console. Shows every customer's records exactly as the ISP's
// database holds them, masked until the admin clicks Reveal:
//   - a field the customer SHARED is revealed (it is stored in plaintext);
//   - a field the customer kept ENCRYPTED triggers a real decrypt attempt with
//     the admin's own credentials, which is refused — only the customer holds
//     the key. What is shared or encrypted is read from the stored record
//     itself, so the console can never show more than the database really has.
// The role check here only hides the page; /api/admin/customers enforces
// `isp-admin` on the server.
interface Customer {
  id: string;
  service: { planId: string; connectionId: string; status: string } | null;
  account: { ciphertext: string | null; shared: Record<string, string>; updatedAt: string } | null;
  usage: { month: string; gbUsed: number; detailCiphertext: string | null; detailShared: Record<string, unknown> | null }[];
  tickets: { id: string; subject: string; status: string; privateCiphertext: string | null; privateShared: string | null }[];
}

type Source =
  | { kind: "shared"; value: string }
  | { kind: "encrypted"; ciphertext: string; tag: string }
  | { kind: "none" };

type RevealState = { state: "trying" } | { state: "shown"; value: string } | { state: "refused" };

const ACCOUNT_FIELDS: [string, string][] = [
  ["fullName", "Full name"],
  ["serviceAddress", "Service address"],
  ["phone", "Phone"],
  ["dateOfBirth", "Date of birth"],
];

function accountSource(c: Customer, key: string): Source {
  if (!c.account) return { kind: "none" };
  if (key in c.account.shared) return c.account.shared[key] ? { kind: "shared", value: c.account.shared[key] } : { kind: "none" };
  return c.account.ciphertext ? { kind: "encrypted", ciphertext: c.account.ciphertext, tag: "account" } : { kind: "none" };
}

function usageSource(m: Customer["usage"][number] | undefined, key: "devices" | "notes"): Source {
  if (!m) return { kind: "none" };
  const shared = m.detailShared?.[key];
  if (shared !== undefined) {
    if (key === "devices") {
      const list = (shared as { name: string; gb: number }[]).map((d) => `${d.name} ${d.gb} GB`).join(" · ");
      return list ? { kind: "shared", value: list } : { kind: "none" };
    }
    return shared ? { kind: "shared", value: String(shared) } : { kind: "none" };
  }
  return m.detailCiphertext ? { kind: "encrypted", ciphertext: m.detailCiphertext, tag: "usage" } : { kind: "none" };
}

function notesSource(t: Customer["tickets"][number]): Source {
  if (t.privateShared) return { kind: "shared", value: t.privateShared };
  if (t.privateCiphertext) return { kind: "encrypted", ciphertext: t.privateCiphertext, tag: "account" };
  return { kind: "none" };
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString(undefined, { month: "short", year: "numeric" });
}

function Admin() {
  const { authenticated, hasRealmRole, doDecrypt } = useTide();
  const api = useApi();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [revealed, setRevealed] = useState<Record<string, RevealState>>({});
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const { customers } = await api<{ customers: Customer[] }>("/api/admin/customers");
    setCustomers(customers);
  }, [api]);

  useEffect(() => {
    if (authenticated && hasRealmRole("isp-admin")) load().catch((e) => setStatus(`Could not load: ${e.message}`));
  }, [authenticated, hasRealmRole, load]);

  if (!hasRealmRole("isp-admin")) {
    return <p>This page is for ISP administrators (role <code>isp-admin</code>).</p>;
  }

  const reveal = async (id: string, source: Source) => {
    if (source.kind === "shared") {
      setRevealed((r) => ({ ...r, [id]: { state: "shown", value: source.value } }));
      return;
    }
    if (source.kind !== "encrypted") return;
    setRevealed((r) => ({ ...r, [id]: { state: "trying" } }));
    try {
      // A genuine attempt with the admin's own credentials — expected to fail.
      const [plain] = await doDecrypt([{ encrypted: source.ciphertext, tags: [source.tag] }]);
      setRevealed((r) => ({ ...r, [id]: { state: "shown", value: `⚠ unexpectedly decrypted: ${plain}` } }));
    } catch {
      setRevealed((r) => ({ ...r, [id]: { state: "refused" } }));
    }
  };

  const fieldsOf = (c: Customer): [string, Source][] => {
    const latest = c.usage[0];
    return [
      ...ACCOUNT_FIELDS.map(([k]) => [`${c.id}:account:${k}`, accountSource(c, k)] as [string, Source]),
      [`${c.id}:usage:devices`, usageSource(latest, "devices")],
      [`${c.id}:usage:notes`, usageSource(latest, "notes")],
      ...c.tickets.flatMap((t) => [[`${c.id}:ticket:${t.id}`, notesSource(t)] as [string, Source]]),
    ];
  };

  const revealAll = (c: Customer) => fieldsOf(c).forEach(([id, src]) => revealed[id] || reveal(id, src));

  const Field = ({ id, label, source }: { id: string; label: string; source: Source }) => {
    const r = revealed[id];
    return (
      <div className="field-row">
        <div className="field-label">{label}</div>
        <div className="field-value">
          {source.kind === "none" ? (
            <span style={{ color: "var(--faint)" }}>Not provided</span>
          ) : !r ? (
            <span className="masked">••••••••••</span>
          ) : r.state === "trying" ? (
            <span style={{ color: "var(--muted)" }}>Attempting to decrypt…</span>
          ) : r.state === "shown" ? (
            <span>{r.value}</span>
          ) : (
            <span className="refused">🔒 Not shared by the customer — encrypted with their key. Decryption refused.</span>
          )}
        </div>
        {source.kind !== "none" && !r && (
          <button onClick={() => reveal(id, source)} style={{ ...btnSmall, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            Reveal
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <h1>ISP admin console</h1>
      <p className="lede">
        Everything the ISP&apos;s database holds about each customer, masked until you reveal it. Details a customer chose
        to share can be revealed. Details they kept private are stored only as ciphertext — no one on the ISP side can
        decrypt them.
      </p>
      {status && <p style={statusStyle}>{status}</p>}
      {customers.length === 0 && <p style={{ color: "var(--faint)" }}>No customer records yet.</p>}

      {customers.map((c) => {
        const latest = c.usage[0];
        const conn = c.service?.connectionId ?? `CN-${c.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
        return (
          <section key={c.id} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <div
                style={{ width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                👤
              </div>
              <div>
                <strong>Customer {conn}</strong>
                <div style={{ fontSize: "0.8rem", color: "var(--faint)" }}>
                  {c.account ? `Profile updated ${new Date(c.account.updatedAt).toLocaleString()}` : "No profile saved"}
                </div>
              </div>
              <button onClick={() => revealAll(c)} style={{ ...btnSmall, marginLeft: "auto" }}>
                Reveal all
              </button>
            </div>

            <div className="section-title">
              Service <Badge kind="visible" />
            </div>
            <div className="field-row">
              <div className="field-label">Plan &amp; status</div>
              <div className="field-value">
                {c.service ? `${c.service.planId} · ${c.service.status}` : "standard · active"}{" "}
                <span style={{ color: "var(--faint)", fontSize: "0.8rem" }}>(required to run the service)</span>
              </div>
            </div>

            <div className="section-title">Account details</div>
            {ACCOUNT_FIELDS.map(([k, label]) => (
              <Field key={k} id={`${c.id}:account:${k}`} label={label} source={accountSource(c, k)} />
            ))}

            <div className="section-title">Usage</div>
            <div className="field-row">
              <div className="field-label">Monthly totals</div>
              <div className="field-value">
                {c.usage.length === 0
                  ? <span style={{ color: "var(--faint)" }}>No usage yet</span>
                  : c.usage.slice(0, 6).map((m) => `${monthLabel(m.month)}: ${m.gbUsed} GB`).join(" · ")}{" "}
                {c.usage.length > 0 && <span style={{ color: "var(--faint)", fontSize: "0.8rem" }}>(needed for billing)</span>}
              </div>
            </div>
            <Field id={`${c.id}:usage:devices`} label={`Device breakdown${latest ? ` (${monthLabel(latest.month)})` : ""}`} source={usageSource(latest, "devices")} />
            <Field id={`${c.id}:usage:notes`} label="Usage notes" source={usageSource(latest, "notes")} />

            <div className="section-title">Support tickets</div>
            {c.tickets.length === 0 && (
              <div className="field-row">
                <div className="field-value" style={{ color: "var(--faint)" }}>No tickets.</div>
              </div>
            )}
            {c.tickets.map((t) => (
              <Field key={t.id} id={`${c.id}:ticket:${t.id}`} label={`“${t.subject}” — extra notes`} source={notesSource(t)} />
            ))}
          </section>
        );
      })}
    </>
  );
}

export default function AdminPage() {
  return (
    <Shell>
      <Admin />
    </Shell>
  );
}
