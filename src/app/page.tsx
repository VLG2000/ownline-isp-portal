"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell, Badge, useApi, cardStyle, btnSmall, statusStyle, useTide } from "./ui";
import type { Plan, PlanId } from "@/lib/plans";

interface ServiceResponse {
  service: { planId: PlanId; connectionId: string; status: string; nextBillDate: string };
  plan: Plan;
  plans: Record<PlanId, Plan>;
}

function Dashboard() {
  const { authenticated } = useTide();
  const api = useApi();
  const [data, setData] = useState<ServiceResponse | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!authenticated) return;
    api<ServiceResponse>("/api/service").then(setData).catch((e) => setStatus(`Could not load service: ${e.message}`));
  }, [authenticated, api]);

  const changePlan = async (planId: PlanId) => {
    try {
      const res = await api<Pick<ServiceResponse, "service" | "plan">>("/api/service", {
        method: "POST",
        body: JSON.stringify({ planId }),
      });
      setData((d) => (d ? { ...d, ...res } : d));
      setStatus(`Plan changed to ${res.plan.name}.`);
    } catch (e: any) {
      setStatus(`Plan change failed: ${e.message}`);
    }
  };

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Your service</h1>
      {status && <p style={statusStyle}>{status}</p>}
      {data && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>{data.plan.name}</h2>
            <Badge kind="visible" />
          </div>
          <p style={{ color: "#c3c8d4" }}>
            {data.plan.downMbps}/{data.plan.upMbps} Mbps · ${data.plan.priceAud}/month · Connection{" "}
            {data.service.connectionId} ·{" "}
            <span style={{ color: data.service.status === "active" ? "var(--green)" : "var(--red)" }}>{data.service.status}</span>
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Next bill: {data.service.nextBillDate}</p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(Object.keys(data.plans) as PlanId[]).map((id) => (
              <button
                key={id}
                disabled={id === data.service.planId}
                onClick={() => changePlan(id)}
                style={{ ...btnSmall, background: id === data.service.planId ? "var(--surface-2)" : "var(--accent-strong)" }}
              >
                {id === data.service.planId ? `Current: ${data.plans[id].name}` : `Switch to ${data.plans[id].name}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        <Tile href="/account" title="My account" kind="encrypted" text="Name, address, phone and date of birth — encrypted in your browser." />
        <Tile href="/usage" title="Usage" kind="encrypted" text="Monthly totals for billing; device detail and notes stay private." />
        <Tile href="/support" title="Support" kind="shared" text="You choose exactly what the support team can read." />
        <Tile href="/privacy" title="What your ISP sees" kind="visible" text="A plain-language map of every field and who can read it." />
      </div>
    </>
  );
}

function Tile({ href, title, text, kind }: { href: string; title: string; text: string; kind: "encrypted" | "visible" | "shared" }) {
  return (
    <Link href={href} style={{ ...cardStyle, display: "block", color: "inherit", textDecoration: "none", marginBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" }}>
        <strong>{title}</strong>
        <Badge kind={kind} />
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 0 }}>{text}</p>
    </Link>
  );
}

export default function HomePage() {
  return (
    <Shell>
      <Dashboard />
    </Shell>
  );
}
