# Awaaz OPD — Har awaaz suni jaye

Urdu voice intake → AI extraction → rules-based triage → live OPD queue → prescription reader → Urdu voice-back.
AICON'26 Build With AI, Health Operations track.

```bash
pnpm install
cp .env.example .env.local   # add GEMINI_API_KEY / GROQ_API_KEY
pnpm dev                     # http://localhost:3000
```

See `CLAUDE.md` for project rules, ownership and commands. Contracts: `types/contracts.ts`.
