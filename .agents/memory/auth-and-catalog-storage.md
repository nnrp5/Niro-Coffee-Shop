---
name: Authentication and catalog storage
description: Architecture choice for customer identity and the NOIR Coffee product catalog.
---

Use Supabase Auth for customer registration, sign-in, password handling, and sessions. Customer signup asks only for email and password; customer names are optional profile data. Passwords must stay in the managed Auth system, never in the public customer profile table. MongoDB Atlas remains the chosen product catalog store.

**Why:** The user explicitly chose Supabase Auth instead of retaining Clerk, after being told existing Clerk accounts would not transfer automatically. The user separately requested MongoDB for catalog products.

**How to apply:** Preserve Supabase Auth for identity and keep passwords out of application profile tables. Do not reintroduce Clerk or move the catalog to another database without an explicit request. Assign administrator privileges through trusted, verified identities, not signup metadata or first-user rules.

## Public-key configuration safety

Reject non-public Supabase key types before Vite substitutes environment variables into browser code. If configuration is invalid, keep the login screen visible with authentication explicitly disabled; never bypass the guard to restore the preview.

**Why:** A value entered under a `VITE_` name is browser-visible even when stored in Replit Secrets. An accidentally supplied privileged key must not be bundled, and a configuration problem should not turn the entire site into a blank page.

**How to apply:** Accept publishable keys or legacy JWT keys whose role is `anon`. Filter rejected values in the build configuration, not only after they have reached browser code. Never log the rejected value.
