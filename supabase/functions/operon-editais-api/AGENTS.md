# AGENTS
- Operon external read API is the `operon-editais-api` edge function: GET-only, no CORS, `OPERON_API_KEY` checked in constant time, service-role reads limited to published editais, released events and the shaping in its core.ts (no user ids, embeddings or unconfirmed values as numbers); this gives tools like Claude Code read access without a curator account that could write.
