[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

# OwnLine — your internet account, your keys

## Project overview

_OwnLine is a privacy-first ISP customer portal where customers manage their internet service while deciding, field by field, which account and usage details their provider can read — everything else stays encrypted under the customer's own key._

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

Today an ISP account is a one-way deal: you hand over your name, address, phone, date of birth
and a detailed record of how your household uses the internet, and the provider keeps all of it
in readable form.

OwnLine flips that relationship. The customer owns the keys to their own account:

- **Encrypted by default.** Personal details, per-device usage breakdowns and private support
  notes are encrypted in the customer's browser before they ever reach the ISP.
- **Sharing is a dial, not a checkbox.** On *What your ISP sees*, every field has its own switch.
  Share your phone number so the ISP can call you about outages; keep your date of birth and
  your household's device usage private. Flipping a switch re-saves your existing data in its
  new form immediately.
- **Honest about what the ISP needs.** Plan, billing totals and connection status are visibly
  locked, with the reason shown. The customer can see exactly what the provider holds.

What's distinctive is that privacy here is **enforced by cryptography, not promised by policy**.
The ISP's own admin console shows customer records masked. Revealing a field the customer kept
private triggers a real decryption attempt that is refused, because no one on the ISP side holds
the key.

### 2. Trust constraint insight

**What is hard today:** to run the service, an ISP must store customer data. Whoever stores the
data can read it. So every customer has to trust the provider's staff, its security, its data
retention and its business incentives, including the temptation to profile households or sell
"anonymised" usage data. One breached database or one curious insider exposes everyone.

Privacy-minded customers have no real alternative. They can't run their own ISP, and "we value
your privacy" policies can't be verified.

**What becomes possible when that constraint is removed:** if the provider can **store** data
without being able to **read** it, the trust bottleneck disappears.

- The ISP can deliver, bill and support the service using only what it genuinely needs, plus
  whatever each customer *chooses* to share.
- A breach of the ISP's database leaks ciphertext, not customer profiles.
- "We can't sell your data" becomes a technical fact, not a marketing claim.
- Customers can share more when it helps them, such as a device breakdown to debug slow
  evenings, and take it back afterwards.

### 3. Value & impact

**Customers:** control and transparency. They see a plain-language map of every field and who
can read it, and they change it whenever they like.

**ISPs:** a smaller attack surface and a differentiator. Data they can't read can't be leaked,
subpoenaed in readable form, or misused by an insider. Compliance with privacy law gets simpler
when the most sensitive data was never readable.

**Support teams:** they get exactly the context the customer chose to share. That is often
*more* than today, because customers trust the system.

**A concrete example:** a customer's connection drops every evening. They open a ticket and
choose to share the device breakdown for this month and a note: *"router is in the garage."* The
support agent sees exactly that, enough to diagnose interference. Their name, address and date
of birth stay encrypted. When the ticket is closed, they flip the device breakdown back to
private. At no point could the ISP have built a profile of the household's devices without
the customer saying yes.

### 4. Why TideCloak matters

OwnLine depends on one property: **no single server, including the ISP's, can hold the key to
customer data.** With a normal identity provider and encryption keys on the server, "encrypted"
would only mean "encrypted until someone with server access decrypts it." TideCloak removes that
loophole.

| Need | How OwnLine uses TideCloak |
|---|---|
| Customer-controlled encryption | Tide **self-encryption** (`doEncrypt` / `doDecrypt`) with tags `account` and `usage`. The key is split across the Tide network (threshold cryptography). Decryption needs the customer's own login plus live network participation, and happens only in their browser. |
| Logins that can't be faked by the ISP | **Threshold authentication.** No password hash is stored anywhere, and tokens are signed by the Tide network, so even a compromised server cannot mint a valid customer session. |
| Stolen tokens are useless | **DPoP token binding.** Every API call carries a fresh proof tied to the customer's browser key, and the server verifies it on every route. |
| Admins can't quietly grant themselves access | **IGA governance in Tide mode.** Creating roles, adding users and even deleting users are change requests that must be approved in the Tide enclave. |
| Server-side authorization | Every API route verifies the Tide-signed JWT and the DPoP proof. Roles (`support-agent`, `isp-admin`) are checked on the server, not just in the UI. |

The server also **refuses plaintext** for any field the customer marked as encrypted, so a buggy
client can't leak private data either.

### 5. Prototype & storytelling

**What the prototype demonstrates today:**

- A full customer portal: dashboard and plan switching, *My account*, *Usage*, *Support*, and
  *What your ISP sees* with a switch per field.
- A **support desk** view (role `support-agent`) that only ever receives what the customer shared.
- An **ISP admin console** (role `isp-admin`) showing every customer record **masked**, with a
  *Reveal* button per field.
- Real Tide integration: Tide sign-in, Tide network encryption, DPoP-verified APIs and governed
  admin changes, all running against a local TideCloak.

**The key interaction judges should look for (about 2 minutes):**

1. **As the customer:** open *What your ISP sees* and share **Full name** and **Phone**. Leave
   everything else encrypted.
2. In *My account*, fill in all four fields and save. The *What the ISP's database holds* panel
   shows name and phone in plaintext and the rest as ciphertext.
3. In *Usage*, generate demo usage. Monthly totals are visible; the device breakdown is encrypted.
4. **Switch to the ISP admin** and open the admin console. Everything is masked.
5. Click **Reveal**. Name and phone appear. Address, date of birth and device usage come back
   **refused**: *"🔒 Not shared by the customer — encrypted with their key."*
6. Go back as the customer, flip **Phone** to private, and reveal again as admin. It is now refused.

> **Prototype note:** for the multi-person demo the app runs in **demo mode**, where each demo
> user (customer, support agent, ISP admin) has their own encryption key kept in the browser.
> This shows the exact data flow and access rules. With demo mode off, customers sign in with
> Tide and their data is encrypted by the Tide network. That path is implemented and was tested
> with a real Tide account. Our free-tier realm currently refuses to link a second Tide user, so
> the live two-person demo uses demo mode.

## Setup

All commands below run from the project root (the folder containing `package.json`).

### Prerequisites

- **Node.js 22**
- **Docker Desktop**, running (only needed for real Tide mode)
- `curl` and `jq` (preinstalled on macOS)
- **Chrome or Brave** for real Tide sign-in. Safari blocks the secure Tide page from talking to
  `http://localhost`. In Brave, turn Shields off for `localhost` and allow pop-ups.

### Option A: demo mode (fastest, no TideCloak needed)

```bash
npm install
cat > .env.local <<'EOF'
NEXT_PUBLIC_DEMO_MODE=1
DEMO_MODE=1
EOF
npm run dev
```

Open **http://localhost:3000**. Use the yellow banner's **Viewing as** selector to switch
between **Customer**, **Support agent** and **ISP admin**.

Demo mode works only under `npm run dev`. A production build ignores it.

### Option B: real Tide

1. **Configure**

   ```bash
      npm install
   cp .env.example .env
   ```

   In `.env`, set `KC_BOOTSTRAP_ADMIN_PASSWORD` (a strong local admin password),
   `TIDE_LICENSE_EMAIL` (the email that will manage your Tide licence) and
   `TIDE_TERMS_ACCEPTED=yes`, the last one only after **you** have agreed to
   https://tide.org/legal.

2. **Bootstrap TideCloak (once)**

   ```bash
   npm run init
   ```

   This starts TideCloak in Docker on http://localhost:8080, creates and licenses the
   `isp-portal` realm with governance enabled, and prints an **invite link**. Open the link in
   Chrome or Brave to link your Tide account. The script finishes by writing
   `data/tidecloak.json`.

   ⚠️ `npm run init` wipes and recreates the realm. After a reboot, run `docker start tidecloak`
   instead.

3. **Run**

   ```bash
   rm -f .env.local    # make sure demo mode is off
   npm run dev
   ```

   Open **http://localhost:3000** and click **Sign in with Tide**.

4. **Roles (optional).** Admin changes in this realm need approval. Create or assign the
   `isp-admin` and `support-agent` roles in the realm console
   (**http://localhost:8080/admin/isp-portal/console/**), then approve them under
   *Change Requests*. Users must sign out and back in to pick up new roles.

5. **Check the setup (optional).** Download the Tide pack once (it is gitignored), then run its
   checker from the project root:

   ```bash
   mkdir -p .tide-pack && curl -fsSL "https://mcp.tide.org/pack/templates.tgz" | tar -xz -C .tide-pack
   bash .tide-pack/templates/shared/tide-doctor.sh --app . --url http://localhost:3000 --realm isp-portal
   ```

   It should end with `RESULT: OK`.

### Project structure

```
src/app/
  page.tsx, account/, usage/, support/   Customer pages
  privacy/                               Per-field encrypt/share switches
  support-desk/                          Support agent view   (role support-agent)
  admin/                                 ISP admin console    (role isp-admin)
  auth/redirect/                         OIDC callback (waits for the provider; exchanges the code once)
  records.ts                             Splits records into encrypted and shared parts
  api/                                   Routes verified with Tide JWT + DPoP (withAuth / withRole)
src/lib/
  auth/                                  Server-side JWT + DPoP verification
  privacy.ts                             Field definitions and the server-side plaintext check
  demo.ts                                Demo-mode users and per-user browser keys
scripts/
  init-tidecloak.sh, realm.json.template TideCloak bootstrap
```

### Troubleshooting

| Symptom | Fix |
|---|---|
| Sign-in loops back to the login button | Make sure only the provider exchanges the login code (`auth/redirect/page.tsx` must not use `useAuthCallback`). The Tide network accepts each approval once. |
| "Network request failed" | You're in Safari. Use Chrome or Brave. |
| Brave private window stuck loading | Use a normal window or a separate profile. |
| Role or user change has no effect | It is a pending change request. Approve it in the realm console. |
| "This action isn't available on your current plan" when linking a user | The free-tier realm's user limit. Ask the Tide team to raise it. |

Logs: `docker logs tidecloak`.
