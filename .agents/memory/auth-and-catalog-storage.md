---
name: Authentication and catalog storage
description: Architecture choice for customer identity and the NOIR Coffee product catalog.
---

Use Supabase Auth for customer registration, sign-in, password handling, and sessions. Customer signup asks only for email and password; customer names are optional profile data. Passwords must stay in the managed Auth system, never in the public customer profile table. Store the NOIR product catalog in Supabase `public.products`; do not add a hardcoded frontend catalog.

**Why:** The user explicitly chose Supabase Auth and later specified that the store's products must be loaded from the Supabase products table.

**How to apply:** Preserve Supabase Auth for identity and keep passwords out of application profile tables. Read catalog rows from Supabase; never substitute a hardcoded frontend catalog. The connected Supabase MCP is read-only and returns 403 for writes. For an explicitly requested write, use credentials only through Replit Secrets and server-side, never bundle or log them, and remove temporary privileged credentials afterward; otherwise provide SQL for the user to run. Assign administrator privileges through trusted, verified identities, not signup metadata or first-user rules.

## Public-key configuration safety

Reject non-public Supabase key types before Vite substitutes environment variables into browser code. If configuration is invalid, keep the login screen visible with authentication explicitly disabled; never bypass the guard to restore the preview.

**Why:** A value entered under a `VITE_` name is browser-visible even when stored in Replit Secrets. An accidentally supplied privileged key must not be bundled, and a configuration problem should not turn the entire site into a blank page.

**How to apply:** Accept publishable keys or legacy JWT keys whose role is `anon`. Filter rejected values in the build configuration, not only after they have reached browser code. Never log the rejected value.
