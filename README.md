<div align="center">

# SignalScout

### Real-time prospect signal intelligence and deep research, built on public data.

Watch free public sources for the moment a company is ready to buy. Filter to your ICP.
Research the person behind the signal with a cited dossier. Ship it to your stack.

![License](https://img.shields.io/badge/license-MIT-111111?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15-111111?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-111111?style=flat-square)
![Postgres](https://img.shields.io/badge/Postgres-16%20+%20pgvector-111111?style=flat-square)
![Drizzle](https://img.shields.io/badge/ORM-Drizzle-111111?style=flat-square)
![MCP](https://img.shields.io/badge/MCP-stdio%20+%20HTTP-111111?style=flat-square)
![Tests](https://img.shields.io/badge/tests-66%20passing-1f8f4e?style=flat-square)
![Eval](https://img.shields.io/badge/eval-100%25%20accuracy-1f8f4e?style=flat-square)

[Quickstart](#quickstart) · [What it does](#what-it-does) · [Trust layer](#the-trust-layer) · [How it works](#how-it-works) · [Prove it](#how-we-prove-it) · [Go live](#go-live)

</div>

---

## The pitch

Your next customer is telling you they are ready to buy, in public, right now. A Form D hits SEC EDGAR. A careers page sprouts three GTM roles. A repo cuts a release. A founder posts that they just incorporated. These signals are gold, and they decay in hours. Tracking them by hand across dozens of sources, for thousands of accounts, is not a job a human can do.

SignalScout watches the free, public sources for you, classifies every event against the customer profiles you define, and surfaces the matches in a live feed. Point it at any person in that feed and it writes a research dossier where every fact links back to its source. Then it plugs into your stack over a REST API, an MCP server, CSV, and webhooks.

It is open source, free to run, and self-hostable end to end. No LinkedIn or X scraping. No bought or breached data.

---

## What it does

Four surfaces, one loop.

- **Live signal feed.** A continuous, ICP-filtered stream of typed buying signals from SEC EDGAR, public ATS boards (Greenhouse, Lever, Ashby), GitHub, web and changelog diffs, and lu.ma events. Eleven signal types, strength-scored, deduped, with filters for ICP, type, source, strength, and date, plus infinite scroll.
- **Cited deep research.** Point it at a person and get a structured dossier (role, company, public technical footprint, talks, focus) where every factual field carries a source URL and a snippet. Uncited claims are dropped. Low-confidence results are flagged, never faked.
- **GTM workflows.** Enterprise account monitoring with a department org-tree, lookalike prospecting that finds similar people and builds a list, conference prep that prioritizes event attendees, and incorporation prospecting that catches founders the moment a company forms.
- **Delivery anywhere.** A key-authed REST API, a first-class MCP server for Claude and Cursor (stdio and HTTP), CSV export, HMAC-signed webhooks, Slack, email digests, and a gated CRM push.

---

## The trust layer

The model calls are the easy five percent. The ninety-five percent that makes this safe to put in front of a real rep is the trust layer, and it is built in from the first commit.

> A plausible-but-wrong dossier is worse than an empty one.

- **Strong-key entity resolution.** Companies match on normalized domain, people on a verified LinkedIn URL or email. People are never merged on name alone. Every signal is deduped by a per-source content hash.
- **Citation guard.** `confidence = cited facts / total facts`. Anything under 0.6 renders a low-confidence badge, and uncited facts are removed before they reach you.
- **Cost and abuse control.** Deep research runs only on ICP-matched people. Dossiers are cached. Per-org daily quotas, a Postgres token-bucket rate limiter, a global budget kill switch, and a bring-your-own-key path keep spend predictable. Every model call is logged with tokens and cost.
- **Tenancy.** Every query is org-scoped and fails closed. API keys are hashed at rest. Webhooks are HMAC signed. The research fetch tool is SSRF guarded against private, loopback, and link-local addresses.
- **Legal by construction.** Free and public sources only. The SEC User-Agent and rate cap are respected. Paid enrichment, CRM push, and S3 delivery are off by default behind flags.

---

## How it works

```
free sources            worker (pg-boss cron)                         Postgres + pgvector
------------            ---------------------                         -------------------
SEC EDGAR        \                                             /  companies . people
Greenhouse        \   adapters ---> normalizer + strong-key   /   signals . icps . dossiers
Lever              >  (cursor,      entity resolution     --->    lists . audit_logs
Ashby             /    RawItem)          |                    \   llm_runs . cursors
GitHub           /                       v                     \
web + changelog          embedding prefilter ---> LLM classifier ---> signals (typed, ICP-matched)
lu.ma events                                                            |
                  deep-research agent (search + fetch + github, cited) -+
                                                                        v
   Next.js app:  feed . research . lists . events . companies . integrations
                 REST API . HTTP MCP . CSV export . signed webhooks   +   stdio MCP server
```

Adapters are pure functions: given a cursor, fetch new items, return a normalized `RawItem[]`. The normalizer turns those into company and person upserts plus a deduped signal row. An embedding prefilter keeps spend down by only sending likely-relevant items to the classifier. The deep-research agent runs an agentic loop over search, fetch, and GitHub tools, fills a fixed dossier schema, and attaches a source to every claim.

The web app and the worker run as two processes, because pg-boss needs a long-running host. The worker schedule is ingest every 30 minutes, then classify, then notify, plus a daily digest.

---

## Quickstart

Runs with zero API keys. Missing keys degrade to safe fallbacks (a deterministic mock classifier and dossier, a local hash embedder, a mock search), so a fresh clone works the moment you boot it.

```bash
git clone https://github.com/sahielbose/Signal-Scout.git
cd Signal-Scout
pnpm install
cp .env.example .env          # fill in what you have; it runs with nothing set

docker compose up -d db       # Postgres 16 + pgvector on host port 5434

pnpm db:push                  # create extensions + schema
pnpm seed                     # optional: an org, an ICP, and sample signals
pnpm dev                      # web + REST + HTTP MCP on http://localhost:3000
pnpm worker                   # a second process: schedulers + ingestion jobs
```

Open `http://localhost:3000`, sign in, and define your first ICP. Or click "Seed a sample ICP and signals" on the empty feed and watch it populate from real public sources.

> Two processes. The Next app (`pnpm dev`) and the worker (`pnpm worker`) run separately. In production, the app goes on Vercel or Fly, the worker runs as a separate always-on service, and Postgres lives on Neon or Supabase. Or self-host the whole thing with Docker.

---

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next dev server: dashboard, REST API, HTTP MCP |
| `pnpm worker` | pg-boss worker: schedulers and ingestion jobs |
| `pnpm db:push` | create extensions and sync the schema |
| `pnpm db:migrate` | apply generated SQL migrations (used on deploy) |
| `pnpm seed` | seed an org, an ICP, and sample signals |
| `pnpm test` | unit tests (vitest) |
| `pnpm eval` | classification eval harness, the CI gate |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm mcp` | stdio MCP server for Claude Desktop and Cursor |
| `pnpm test-adapter <source> <key>` | smoke-test a source adapter against real data |

---

## Configuration

Everything reads from the environment. Nothing is required to boot; missing keys fall back to safe defaults.

| Variable | Purpose | If unset |
| --- | --- | --- |
| `DATABASE_URL` | Postgres 16 + pgvector | defaults to the local `:5434` container |
| `AUTH_SECRET` | session signing | generate with `openssl rand -hex 32` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth login | password-less dev sign-in is used |
| `SMTP_URL` | email magic links and digests | links and digests are logged, not sent |
| `LLM_PROVIDER` + `ANTHROPIC_API_KEY` | classifier and dossiers | deterministic mock classifier and dossier |
| `SEARCH_PROVIDER` + `TAVILY_API_KEY` / `EXA_API_KEY` | web search in research | GitHub-only cited dossiers |
| `GITHUB_TOKEN` | higher GitHub rate limit | unauthenticated, 60 per hour |
| `SEC_USER_AGENT` | required by SEC EDGAR | a default User-Agent is sent |
| `DAILY_*_QUOTA`, `GLOBAL_KILL_SWITCH` | free-tier guards | sensible defaults |
| `ENABLE_CRM`, `ENABLE_PAID_ENRICHMENT`, `SCHEDULED_CSV_DELIVERY` | Stage-2 integrations | off; a clean no-op until a key is set |

The only optional closed pieces are the hosted LLM API and hosted search. Both sit behind interfaces with open self-host swaps (Ollama or vLLM, SearXNG plus fetch). No closed dependency is load bearing, and no secret ever goes in code.

---

## How we prove it

The eval harness is the highest-leverage thing in the repo. `evals/golden/classification` holds 30 hand-labeled real items pulled from actual EDGAR filings, Greenhouse boards, and GitHub releases. `pnpm eval` scores per-type precision, recall, and F1, plus a strength gate, and exits non-zero under threshold so a prompt change can never silently regress.

```
Classification eval, 30 labeled items

  overall accuracy : 1.000 (30/30)
  strength gate    : 0.933 (28/30)

  eval passed
```

Run the full gate before every commit:

```bash
pnpm typecheck && pnpm test && pnpm eval
```

---

## Plugs into your stack

- **Dashboard.** One workspace to define ICPs, scan the live feed, research people, build lists, monitor accounts, and export.
- **REST API.** Key-authed and org-scoped: `GET /api/signals`, `GET /api/people/:id`, `POST /api/people/:id/dossier`, `POST /api/research`, `GET /api/lists/:id/export.csv`, `GET /api/feed`, `GET /api/health`. Bring your own LLM key with an `X-LLM-Key` header.
- **MCP server.** A first-class Model Context Protocol server over stdio and HTTP, with five tools: `search_signals`, `get_person`, `generate_dossier`, `list_signals_for_company`, `export_list`. The integrations page ships copy-paste config for Claude Desktop and Cursor.
- **Flat files and delivery.** CSV export, HMAC-signed outbound webhooks, Slack, daily email digests, scheduled CSV delivery, and a gated, audited CRM push.

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App and API | Next.js 15 App Router, TypeScript | one app for dashboard, REST, webhooks, and HTTP MCP |
| Database | Postgres 16, pgvector, pg_trgm | relational, vector, and fuzzy in one engine |
| ORM | Drizzle | lightweight, SQL-first, pgvector-friendly |
| Jobs | pg-boss | Postgres-backed queue and cron, no extra infra |
| LLM | Vercel AI SDK behind an `LLMProvider` interface | Anthropic by default, Ollama swap |
| Search | `SearchProvider` interface | Tavily or Exa, with an open SearXNG plus fetch path |
| Sources | Octokit, plain fetch, HTML-diff fetch | GitHub, SEC, public ATS, web changes |
| Auth | Auth.js v5 | GitHub OAuth and email magic link |
| UI | Tailwind, hand-rolled shadcn-style primitives, Recharts | a clean, dense, warm dashboard |
| MCP | @modelcontextprotocol/sdk | stdio and HTTP servers |
| Validation | zod | on every external input and every model output |

---

## Repo layout

```
app/        Next.js App Router: marketing site, dashboard, /api, HTTP MCP
worker/     pg-boss entry: schedulers and job handlers
lib/
  db/         schema, client, queries
  adapters/   sec, greenhouse, lever, ashby, github, web-diff, luma
  entity/     resolution: domain, name, and person matching, dedupe
  classify/   classifier, prompt, zod schema, taxonomy
  research/   agent, dossier schema, citation guard, similar-people, tools
  providers/  llm, search, email, embed, crm, enrichment (pluggable interfaces)
  delivery/   csv, webhook, slack, scheduled, s3
  quota/      rate limiting and budget guards
components/  ui primitives, app components, marketing components
mcp/        stdio MCP server
evals/      golden sets and the eval runner
scripts/    setup-db, seed, migrate, backfills, adapter smoke tests
```

---

## Go live

Two processes: the web app (serverless friendly) and the worker (always on, runs pg-boss).

- **Render.** `render.yaml` provisions the app, the worker, and Postgres in one blueprint.
- **Fly.io.** `fly.toml` deploys the app from `Dockerfile`; deploy the worker as a second app from `Dockerfile.worker`.
- **Vercel.** `vercel.json` for the app; run the worker elsewhere, never inside serverless.
- **Self-host.** `docker build` both images and point them at a Postgres with `vector` and `pg_trgm`.

Migrations apply on deploy with `pnpm db:migrate`. Health check at `GET /api/health`.

---

## Legal and data

SignalScout stores public professional data about real people. Before running it for strangers, review the bundled [Privacy Policy](/privacy), [Terms](/terms), and [data-removal request](/data-removal) templates and your GDPR and CCPA obligations (legitimate-interest basis, access and deletion rights, statutory response windows). Dossiers are not FCRA consumer reports. Free and public sources only. No LinkedIn or X scraping.

---

## Docs

- [BUILD_PLAN.md](./BUILD_PLAN.md) the full product and architecture spec
- [PHASES.md](./PHASES.md) the build log, phase by phase
- [CLAUDE.md](./CLAUDE.md) the project conventions and guardrails

---

## Contributing

Keep the trust layer non-negotiable. Strong keys only, every dossier fact cited, free and public sources only, zod on every boundary, and no secret in code. Run `pnpm typecheck && pnpm test && pnpm eval` before you commit, and keep the eval gate green. Small, frequent, conventional commits.

MIT licensed. Built on public data.
