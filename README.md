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

## Configuration

Everything is read from the environment (see [`.env.example`](./.env.example)). Nothing is required to boot — missing keys degrade to safe fallbacks:

| Variable | Purpose | If unset |
|---|---|---|
| `DATABASE_URL` | Postgres + pgvector | defaults to the local `:5434` container |
| `AUTH_SECRET` | session signing | generate with `openssl rand -hex 32` |
| `AUTH_GITHUB_ID/SECRET` | GitHub OAuth login | dev password-less sign-in is used |
| `SMTP_URL` | email magic links + digests | links/digests are logged, not sent |
| `SEC_USER_AGENT` | required by SEC EDGAR | a default UA is sent |
| `GITHUB_TOKEN` | higher GitHub rate limit | unauthenticated (60/hr) |
| `LLM_PROVIDER` + `ANTHROPIC_API_KEY` | classifier + dossiers | deterministic mock classifier/dossier |
| `SEARCH_PROVIDER` + `TAVILY_API_KEY`/`EXA_API_KEY` | web search in research | GitHub-only, cited dossiers |
| `DAILY_*_QUOTA`, `GLOBAL_KILL_SWITCH` | free-tier guards | sensible defaults |

## Deployment

Two processes: the **web app** (serverless-friendly) and the **worker** (always-on, runs pg-boss).

- **Render** — `render.yaml` provisions app + worker + Postgres in one blueprint. Point `DATABASE_URL` at a pgvector-capable Postgres (Render managed PG, Neon, or Supabase).
- **Fly.io** — `fly.toml` deploys the app from `Dockerfile`; deploy the worker as a second Fly app from `Dockerfile.worker`.
- **Vercel** — `vercel.json` for the app; run the worker elsewhere (Fly/Render/a VM) — never inside serverless.
- **Self-host** — `docker build -t ss-app .` and `docker build -f Dockerfile.worker -t ss-worker .`, point both at a Postgres with `vector`/`pg_trgm`.

**Migrations on deploy:** `pnpm db:generate` writes SQL to `drizzle/`; `pnpm db:migrate` applies it (and creates extensions). The worker image runs `db:migrate` on boot. Health check: `GET /api/health` (checks DB).

## Legal & data

Signal Scout stores public professional data about real people. Before running it for strangers, review the bundled
[Privacy Policy](/privacy), [Terms](/terms), and [data-removal request](/data-removal) templates and your **GDPR/CCPA**
obligations (legitimate-interest basis, access/deletion rights, statutory response windows). Dossiers are **not** FCRA
consumer reports. No LinkedIn/X scraping; free/public sources only.

## Open-source posture

The core is MIT/Apache/Postgres-licensed and self-hostable end-to-end. License: MIT. The only optional closed pieces —
the LLM API and hosted search — sit behind interfaces with open self-host swaps (Ollama/vLLM; SearXNG + fetch). No
closed dependency is load-bearing; no secret ever goes in code.
