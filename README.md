# Signal Scout

> Open-source, real-time **prospect signal intelligence + deep-research** platform for GTM teams.

Signal Scout watches **free, public sources** for buying signals about your ideal customers
(funding filings, hiring surges, product launches, GitHub releases, web/changelog diffs, events),
shows them in a **live ICP-filtered feed**, and generates **cited research dossiers** on the people
behind them — delivered via a web dashboard, REST API, CSV export, and an **MCP server** you can
wire into Claude or Cursor.

Clean-room build, our own brand. Free to use (quota'd). Self-hostable end-to-end.

---

## Why it's trustworthy by construction

The LLM calls are the easy 5%. The 95% that makes this usable is the trust layer, built in from hour one:

- **Strong-key entity resolution** — companies by normalized domain, people by LinkedIn URL or email. People are **never** auto-merged on name alone. Per-source `content_hash` dedupe.
- **Cited dossiers** — every factual field carries a `source_url` + `snippet`. Uncited facts are dropped; `confidence = cited/total`; `< 0.6` renders a low-confidence badge. A plausible-but-wrong dossier is worse than an empty one.
- **Eval harness** — golden datasets score classification precision/recall and dossier citation coverage; the run **fails** under threshold.
- **Cost & abuse control** — deep-research only ICP-matched people, dossier caching, per-org daily budget ceilings, every model call logged to `llm_runs` with tokens + cost.
- **Legal & polite** — no LinkedIn/X scraping; free/public sources only; SEC `User-Agent` + rate cap; SSRF-guarded fetch; paid enrichment off by default.

## Stack

Next.js 15 (App Router) · TypeScript · Postgres 16 + pgvector · Drizzle ORM · pg-boss ·
Vercel AI SDK (Anthropic default, Ollama swap) · Auth.js v5 · Tailwind + Radix · MCP SDK.

The only optional closed pieces — the LLM API and hosted search — sit **behind interfaces**
with open self-host swaps (Ollama/vLLM; SearXNG + fetch). No closed dependency is load-bearing.

## Quick start

```bash
git clone https://github.com/sahielbose/Signal-Scout.git
cd Signal-Scout
pnpm install
cp .env.example .env          # fill in what you have — it runs with zero keys (mocks kick in)

# start Postgres+pgvector (host port 5434).
# If you have the docker compose plugin:
docker compose up -d db
# else run it directly:
docker run -d --name signalscout-db \
  -e POSTGRES_USER=signalscout -e POSTGRES_PASSWORD=signalscout -e POSTGRES_DB=signalscout \
  -p 5434:5432 -v "$PWD/db/init:/docker-entrypoint-initdb.d:ro" \
  -v signalscout-pgdata:/var/lib/postgresql/data pgvector/pgvector:pg16

pnpm db:push                  # create extensions + schema
pnpm seed                     # optional: an org, an ICP, sample signals
pnpm dev                      # http://localhost:3000   (web + REST + HTTP MCP)
pnpm worker                   # separate process: schedulers + ingestion jobs
```

> **Two processes.** pg-boss needs a long-running host, so the Next app (`pnpm dev`) and the
> worker (`pnpm worker`) run separately. In prod: app on Vercel/Fly, worker as a separate
> always-on service, Postgres on Neon/Supabase — or fully self-hosted via Docker.

### Runs with zero keys

Every closed dependency has an offline fallback so a fresh clone works immediately:
no `ANTHROPIC_API_KEY` → deterministic mock classifier/dossier; no embedder → local hash embedding;
no search key → mock search. Wire real keys in `.env` to upgrade in place. **No secret goes in code.**

## Commands

| Command | What |
|---|---|
| `pnpm dev` | Next dev server (dashboard + API + HTTP MCP) |
| `pnpm worker` | pg-boss worker: schedulers + ingestion jobs |
| `pnpm db:push` | create extensions + sync schema |
| `pnpm seed` | seed an org/ICP/sample signals |
| `pnpm test` | unit tests (vitest) |
| `pnpm eval` | classification + dossier eval harness (CI gate) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm mcp` | stdio MCP server for Claude Desktop / Cursor |
| `pnpm test-adapter <source> <key>` | smoke-test a source adapter against real data |

## Architecture

```
Free sources ─▶ Source adapters ─▶ Normalizer + entity resolution ─▶ Postgres
(SEC, ATS, GitHub,        (cursor-based,        (strong keys, content_hash dedupe)
 web diffs, lu.ma)         RawItem[])
                                   │
              embedding prefilter ─┴─▶ LLM classifier ─▶ signals (typed, ICP-matched)
                                                              │
   Deep-research agent (search + fetch + github, cited) ──────┤
                                                              ▼
                  Next.js app:  /feed · /research · /people · /lists · /integrations
                                REST API · HTTP MCP · CSV export · webhooks
```

See [`BUILD_PLAN.md`](./BUILD_PLAN.md) for the full spec and [`PHASES.md`](./PHASES.md) for build status.

## Open-source posture

The core is MIT/Apache/Postgres-licensed and self-hostable. License: MIT.
We store data about real people from public sources — see the privacy/data-removal notes
(Phase 14) for GDPR/CCPA obligations before running this for strangers.
