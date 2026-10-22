import { withAuth } from "@/lib/auth/middleware";
import { readJson, writeJson } from "@/lib/store";
import { normalizePrefs, DEFAULT_PREFS } from "@/lib/privacy";

// The customer's per-field encrypt/share choices. The choices themselves are
// not secret: the server needs them to refuse plaintext for encrypted fields.

// GET /api/privacy
export const GET = withAuth(async (_req, jwt) => {
  return Response.json({ prefs: normalizePrefs(readJson("privacy", jwt.sub!, DEFAULT_PREFS)) });
});

// PUT /api/privacy — Body: { prefs: { "<field key>": "encrypted" | "shared" } }
export const PUT = withAuth(async (req, jwt) => {
  const { prefs } = await req.json();
  const clean = normalizePrefs(prefs);
  writeJson("privacy", jwt.sub!, clean);
  return Response.json({ prefs: clean });
});
