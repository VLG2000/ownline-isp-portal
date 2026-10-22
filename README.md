[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

# OwnLine — your internet account, your keys

## Project overview

_A privacy-first ISP portal where customers decide, field by field, what their provider can read._

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

- **Encrypted by default:** personal details, device usage and support notes are encrypted in the browser.
- **Sharing is per field:** customers share or revoke each field at any time.

### 2. Trust constraint insight

**Hard today:** whoever stores your data can read it.

**Now possible:** the ISP stores data it cannot read, so a breach leaks only ciphertext.

### 3. Value & impact

**Customers:** control they can revoke. **ISPs:** a smaller attack surface and a provable privacy promise.

### 4. Why TideCloak matters

| Need | TideCloak feature |
|---|---|
| No ISP-held keys | Self-encryption, keys split across the Tide network |
| Unforgeable logins | Threshold sign-in |
| Stolen tokens useless | DPoP binding |
| No silent admin access | IGA approvals |

### 5. Prototype & storytelling

1. As **Customer**, share Full name and Phone, then fill in *My account*.
2. As **ISP admin**, reveal fields: shared ones appear, the rest are **refused**.
3. As **Customer**, make Full name private.
4. As **ISP admin**, reveal Full name: now refused.

> **Prototype note:** demo mode gives each persona a browser key. Real Tide mode is implemented and tested; our free-tier realm allows one Tide user.

## Setup

### Option A: demo mode

Requires Node.js 22.

```bash
npm install
printf 'NEXT_PUBLIC_DEMO_MODE=1\nDEMO_MODE=1\n' > .env.local
npm run dev
```

Open http://localhost:3000 and switch personas with **Viewing as**.

### Option B: real Tide

1. `cp .env.example .env`, then set the admin password, licence email and `TIDE_TERMS_ACCEPTED=yes`.
2. `npm run init` (Docker).
3. Delete `.env.local`, run `npm run dev`; use Chrome or Brave.
