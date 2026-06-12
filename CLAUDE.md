# Signal Scout — project conventions for Claude Code

## What this is
Open-source, real-time prospect **signal intelligence + deep-research** platform for GTM teams.
Watch free/public sources for buying signals about a user's ICP, show them in a live filtered
feed, and generate **cited** research dossiers on people. Web app first. Free to use (quota'd).
Full spec: `BUILD_PLAN.md`. Live checklist: `PHASES.md`.

## Stack (chosen, concrete)
- **Next.js 15 (App Router) + TypeScript** — dashboard + REST API + HTTP MCP endpoint
- **Postgres 16 + pgvector + pg_trgm**, **Drizzle ORM** (schema in `lib/db/schema.ts`)
- **pg-boss** for jobs/cron — the worker runs as a SEPARATE process (`pnpm worker`)
- **Vercel AI SDK (`ai`)** behind an `LLMProvider` interface (anthropic default, ollama swap)
- **SearchProvider** interface (tavily/exa default, searxng+fetch open swap)
- **Octokit** (GitHub), plain `fetch` (SEC + public ATS), HTML-diff fetch (web changes)
- **Auth.js v5** (GitHub OAuth + email magic link) + Drizzle adapter
- **Tailwind + hand-rolled shadcn-style primitives** (`components/ui/*`), Recharts, lucide-react
- **@modelcontextprotocol/sdk** (stdio `mcp/` + HTTP `app/api/mcp`)
- **zod** on every external input + every LLM output

## Repo layout (flat single-package — not a workspace, for speed)
```
app/        Next.js App Router: pages + /api + HTTP MCP
worker/     pg-boss entry: schedulers + job handlers
lib/
  db/         schema.ts, client.ts, queries
  adapters/   sec.ts, greenhouse.ts, lever.ts, ashby.ts, github.ts, web-diff.ts, luma.ts
  entity/     resolution.ts (domain/name/person matching, dedupe)
  classify/   classifier.ts + prompt + zod schema + taxonomy
  research/   agent.ts + dossier schema + citation guard + tools
  providers/  llm.ts, search.ts, email.ts, embed.ts (pluggable interfaces)
  delivery/   csv.ts, webhook.ts, slack.ts
  quota/      rate limiting + budget guards
components/  ui primitives + app components
mcp/        stdio MCP server
evals/      golden/ + run.ts
scripts/    setup-db.ts, seed.ts, test-adapter.ts
db/init/    docker extension bootstrap SQL
```

## Commands
`pnpm dev` | `pnpm worker` | `pnpm db:push` | `pnpm seed` | `pnpm test` | `pnpm eval` | `pnpm typecheck` | `pnpm build` | `pnpm mcp`

## Hard rules (GUARDRAILS — the trust layer, not optional)
- **Entity resolution:** companies by normalized domain; people by `linkedin_url` OR `email` (strong keys only). NEVER auto-merge people on name alone — name+company is a low-confidence *suggestion*, stored separately. Dedupe every signal by per-source `content_hash` (UNIQUE).
- **Dossier citations:** every factual field carries `source_url` + `snippet`. Post-process drops uncited facts; `confidence = cited/total`; `< 0.6` → "low confidence" badge. A plausible-but-wrong dossier is worse than an empty one.
- **Cost/abuse:** deep-research ONLY ICP-matched people; cache dossiers with `expires_at`; per-org daily budget ceiling; log EVERY model call to `llm_runs` with tokens + `cost_usd`.
- **SSRF:** the research `fetch_page` tool refuses private/loopback/link-local IPs and non-http(s) schemes. Resolve + validate before fetching.
- **Legality:** NO LinkedIn/X scraping. Free/public sources only. Paid enrichment is off-by-default behind `ENABLE_PAID_ENRICHMENT`.
- **Validation:** zod on every external input and every LLM output.
- **Politeness:** SEC requires a `User-Agent` + ~10 req/s cap; backoff + cache all crawls.
- **Secrets:** `.env` only, never in code; keep `.env.example` current.
- **Tenancy:** every query org-scoped; cross-tenant reads must fail closed (Phase 11).

## Brand
Clean-room. Name "Signal Scout" (placeholder, easy to rename). Beacon/radar metaphor.
Our own colors/copy. NEVER reference or copy another company's name, logo, assets, or marketing.

## Local infra notes
- DB on host port **5434** (compose) — avoids colliding with other local Postgres.
- Extensions (`vector`, `pg_trgm`, `uuid-ossp`) created by `scripts/setup-db.ts` before `drizzle-kit push`.
- `next build` lint is disabled (checkpoints gate on `typecheck`/`test`/`eval`).

## Definition of done (per phase)
Build → checkpoint passes (typecheck/test/eval) → conventional commit → tick `PHASES.md` → next phase.
