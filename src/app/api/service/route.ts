import { withAuth } from "@/lib/auth/middleware";
import { readJson, writeJson } from "@/lib/store";
import { PLANS, type PlanId } from "@/lib/plans";

// Operational service data. The ISP must see this to deliver and bill the
// service, so it is stored in plaintext and labelled "Visible to ISP" in the UI.

interface Service {
  planId: PlanId;
  connectionId: string;
  status: "active" | "suspended";
  nextBillDate: string;
}

function defaultService(userId: string): Service {
  const next = new Date();
  next.setMonth(next.getMonth() + 1, 1);
  return {
    planId: "standard",
    connectionId: `CN-${userId.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    status: "active",
    nextBillDate: next.toISOString().slice(0, 10),
  };
}

// GET /api/service — the customer's plan and connection status
export const GET = withAuth(async (_req, jwt) => {
  const service = readJson<Service>("service", jwt.sub!, defaultService(jwt.sub!));
  return Response.json({ service, plan: PLANS[service.planId], plans: PLANS });
});

// POST /api/service — change plan. Body: { planId }
export const POST = withAuth(async (req, jwt) => {
  const { planId } = await req.json();
  if (!(planId in PLANS)) {
    return Response.json({ error: "Unknown plan" }, { status: 400 });
  }
  const service = { ...readJson<Service>("service", jwt.sub!, defaultService(jwt.sub!)), planId };
  writeJson("service", jwt.sub!, service);
  return Response.json({ service, plan: PLANS[planId as PlanId] });
});
