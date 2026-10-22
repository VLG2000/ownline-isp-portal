import { withAuth } from "@/lib/auth/middleware";
import { readJson, writeJson, isCiphertext } from "@/lib/store";
import { sharedKeysAllowed } from "@/lib/privacy";
import { prefsFor } from "@/lib/prefsStore";

// Billing needs the monthly total (gbUsed), so it is always visible to the ISP.
// The per-device breakdown and notes follow the customer's privacy choices:
// encrypted in the browser (tag `usage`) into detailCiphertext, or shared as
// plaintext in detailShared.
interface UsageMonth {
  month: string; // YYYY-MM
  gbUsed: number;
  detailCiphertext: string | null;
  detailShared: Record<string, unknown> | null;
}

// GET /api/usage — monthly usage, newest first
export const GET = withAuth(async (_req, jwt) => {
  const months = readJson<UsageMonth[]>("usage", jwt.sub!, []).map((m) => ({ ...m, detailShared: m.detailShared ?? null }));
  return Response.json({ months: months.sort((a, b) => b.month.localeCompare(a.month)) });
});

// POST /api/usage — upsert one month. Body: { month, gbUsed, detailCiphertext?, detailShared? }
export const POST = withAuth(async (req, jwt) => {
  const { month, gbUsed, detailCiphertext, detailShared } = await req.json();
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }
  if (typeof gbUsed !== "number" || !Number.isFinite(gbUsed) || gbUsed < 0 || gbUsed > 100_000) {
    return Response.json({ error: "Invalid gbUsed" }, { status: 400 });
  }
  if (detailCiphertext != null && !isCiphertext(detailCiphertext)) {
    return Response.json({ error: "detailCiphertext must be Tide ciphertext" }, { status: 400 });
  }
  if (!sharedKeysAllowed(detailShared, "usage", prefsFor(jwt.sub!))) {
    return Response.json({ error: "Plaintext sent for a field you chose to encrypt" }, { status: 400 });
  }
  if (detailShared != null && JSON.stringify(detailShared).length > 20_000) {
    return Response.json({ error: "detailShared too large" }, { status: 400 });
  }
  const months = readJson<UsageMonth[]>("usage", jwt.sub!, []).filter((m) => m.month !== month);
  months.push({ month, gbUsed, detailCiphertext: detailCiphertext ?? null, detailShared: detailShared ?? null });
  writeJson("usage", jwt.sub!, months);
  return Response.json({ ok: true }, { status: 201 });
});
