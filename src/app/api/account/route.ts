import { withAuth } from "@/lib/auth/middleware";
import { readJson, writeJson, isCiphertext } from "@/lib/store";
import { sharedKeysAllowed } from "@/lib/privacy";
import { prefsFor } from "@/lib/prefsStore";

// The customer's personal details. Fields the customer keeps private are
// encrypted in the browser (tag `account`) and arrive as one ciphertext blob;
// fields they chose to share with the ISP arrive in `shared` as plaintext.
interface AccountRecord {
  ciphertext: string | null;
  shared: Record<string, string>;
  updatedAt: string;
}

// GET /api/account — the profile record, or null if none saved yet
export const GET = withAuth(async (_req, jwt) => {
  const account = readJson<AccountRecord | null>("account", jwt.sub!, null);
  return Response.json({ account: account && { ...account, shared: account.shared ?? {} } });
});

// PUT /api/account — replace the profile. Body: { ciphertext | null, shared }
// Plaintext is accepted only for fields the customer set to "shared".
export const PUT = withAuth(async (req, jwt) => {
  const { ciphertext, shared = {} } = await req.json();
  if (ciphertext != null && !isCiphertext(ciphertext)) {
    return Response.json({ error: "Expected Tide ciphertext" }, { status: 400 });
  }
  if (!sharedKeysAllowed(shared, "account", prefsFor(jwt.sub!))) {
    return Response.json({ error: "Plaintext sent for a field you chose to encrypt" }, { status: 400 });
  }
  if (Object.values(shared).some((v) => typeof v !== "string" || v.length > 500)) {
    return Response.json({ error: "Invalid shared field" }, { status: 400 });
  }
  const account: AccountRecord = { ciphertext: ciphertext ?? null, shared, updatedAt: new Date().toISOString() };
  writeJson("account", jwt.sub!, account);
  return Response.json({ account });
});
