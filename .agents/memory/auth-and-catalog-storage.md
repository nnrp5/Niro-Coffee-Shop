---
name: Authentication and catalog storage
description: Architecture choice for customer identity and the NOIR Coffee product catalog.
---

Keep the existing Clerk-managed authentication for customer registration, sign-in, password handling, and sessions. Use MongoDB Atlas for the store's product catalog, accessed only from the API server with the server-side `MONGODB_URI`.

**Why:** Clerk is already integrated and manages password security and sessions; moving credentials into the product database would duplicate identity handling and increase risk.

**How to apply:** For follow-up work, preserve Clerk as the identity provider and keep password data out of MongoDB. Limit the MongoDB integration to catalog data unless the user explicitly changes this architecture.
