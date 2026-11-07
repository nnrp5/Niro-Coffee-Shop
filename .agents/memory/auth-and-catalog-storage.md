---
name: Authentication and catalog storage
description: Architecture choice for customer identity and the NOIR Coffee product catalog.
---

Use Supabase Auth for customer registration, sign-in, password handling, and sessions. Customer signup asks only for email and password; customer names are optional profile data. Passwords must stay in the managed Auth system, never in the public customer profile table. MongoDB Atlas remains the chosen product catalog store.

**Why:** The user explicitly chose Supabase Auth instead of retaining Clerk, after being told existing Clerk accounts would not transfer automatically. The user separately requested MongoDB for catalog products.

**How to apply:** Preserve Supabase Auth for identity and keep passwords out of application profile tables. Do not reintroduce Clerk or move the catalog to another database without an explicit request. Assign administrator privileges through trusted, verified identities, not signup metadata or first-user rules.
