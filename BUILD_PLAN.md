# Build Plan — "Signal Scout" (working name)

> An open-source, real-time **prospect signal intelligence + deep-research** platform for GTM teams.
> Functionally equivalent to Autumn AI (YC W26). **Your own brand, your own copy, your own name** — none of theirs.
> Web app first. Built to be vibe-coded with Claude Code in a focused day, then hardened.

---

## 0. TL;DR — what we ship on Day 1

A working web app where a user can:

1. **Define an ICP** (industries, titles, company size, keywords, geos, which signal types they care about).
2. **See a live signal feed** of real events pulled from **free/open sources** (SEC EDGAR funding filings, Greenhouse/Lever/Ashby hiring, GitHub releases & activity, blog/changelog/careers diffs, lu.ma events), each item **classified** (funding / hiring / product launch / buying intent / expansion / …) and **matched to the ICP**.
3. **Run a deep-research dossier** on any person → structured profile (role, company, public technical footprint, talks/posts) + a narrative + a suggested opener, **with a source URL on every claim**.
4. **Build a list** and **export it as CSV**.
5. **Plug it into Claude/Cursor via an MCP server** (this is the half-day feature that makes you look AI-native).
6. All of it sitting on an **eval harness** so you can measure classification precision and dossier hallucination from hour one.

Everything else (webhooks→CRM push, Slack/email digests, org-tree account monitoring, hardened entity resolution, "real-time at scale") is **Stage 2** — explicitly out of scope for Day 1 and flagged below.

**The honest framing (from your own context file):** the LLM calls are ~5% of this. The 95% that makes it sellable is entity resolution, source citation, dedup/freshness, evals, cost control, and ToS compliance. Day 1 builds a real slice of that — not a demo that looks done.

---

## 1. Product teardown — what Autumn actually does

So we replicate **function**, not brand. (Source: their YC page + autumnai.com, June 2026.)

Autumn calls itself an "AI maximalist sales platform" and pitches "deep people intelligence to stalk your prospects at scale." It has **three surfaces**:

### 1a. The live signal feed (the centerpiece)
A continuously updating feed of public events about your target universe, each tagged with a **signal type** and filtered by your ICP/intents. Observed signal types and sources on their site:

| Signal type (their taxonomy) | Example source on their feed |
|---|---|
| Funding / Announcement | LinkedIn post "we closed our Series B"; TechCrunch; **SEC EDGAR Form D** |
| Hiring / Expansion | Careers page adds GTM roles |
| Product launch / Shipping | "shipped our new API docs"; GitHub release |
| Buying intent | Case-study / spend-report style posts |
| Thought leadership / Publication | "published at NeurIPS" |
| Event | lu.ma meetup / conference RSVP lists |
| SEC filing | Form D (Reg D 506(b)) |
| GitHub release / activity | `released v2.1.0`, contribution counts |
| Content / Website change | new blog post; changelog diff |
| Partnership / Integration | "added X integration to changelog" |

Workflows they advertise: **incorporation prospecting** (catch founders the moment they incorporate, then track banking/payroll/ML-infra signals), **enterprise account monitoring** (org trees + department-wide buying signals), **conference prep** (monitor attendee lists, prioritize warm ones).

### 1b. The deep-research agent ("your best BDR, running 24/7")
Point it at a person → it crawls "GitHub repos, Facebook groups, and sources you'd never think to check" and returns a **dossier**. Their example dossier (shape we mirror):

```
John Doe — Product Manager @ Brex — New York, NY
Tags: DevX · Docs Tooling · Developer Platform · F500
Company: Brex
Role: Product Manager
GitHub: 847 contributions
Focus: Docs Infrastructure
Summary: PM in Brex's developer-platform org. Heavy contributor to docs-tooling
repos on GitHub. Stars mintlify, readme, docusaurus. Published about docs
infrastructure. Speaker at DevXCon SF 2025.
```

So the dossier = identity + segment tags + structured fields + a narrative grounded in **public technical footprint** (GitHub, talks, posts).

### 1c. Delivery / "plugs into your stack"
- **Dashboard** — one workspace to search, research, build lists.
- **MCP / API** — plug into Claude/Cursor/any MCP agent; full REST API + webhooks.
- **Flat files** — export enriched lists as CSV to your inbox or S3, drop into your sequencer.

### Branding rules (hard requirement — clone idea, not company)
- **Do not** use the name "Autumn", their logo, their colors, their screenshots, their copy ("stalk your prospects at scale", "AI maximalist sales platform", etc.), or their customer logos.
- Pick **your own name**. Working placeholder in this doc is **"Signal Scout"** — *verify it's free and trademark-check before you commit; it's a placeholder.* Naming directions to riff on: a watchtower/lookout metaphor (Outpost, Lookout, Watchtower), a signal/wave metaphor (Wavelength, Pulse, Resonance), a tracking metaphor (Trailhead, Compass, Beacon), or an invented coinage. Avoid collisions (e.g., "Lighthouse" = Google's tool, "Verge" = media).
- Write your **own** marketing copy and UI strings. You may build a UI with a **similar information architecture** (a typed live feed, a dossier panel, a list builder) — structure and function aren't protected; pixel-copying their assets is.

---

## 2. System architecture

```mermaid
flowchart TB
    subgraph Sources["Free / open data sources"]
        SEC["SEC EDGAR<br/>(Form D funding)"]
        ATS["Greenhouse / Lever / Ashby<br/>(public job boards)"]
        GH["GitHub API<br/>(releases, activity)"]
        WEB["Blog / changelog / careers<br/>(crawl + diff)"]
        LUMA["lu.ma events"]
    end

    subgraph Worker["Worker process (pg-boss): scheduled jobs"]
        ADP["Source adapters<br/>(incremental, cursor-based)"]
        NORM["Normalizer +<br/>Entity Resolution"]
        PRE["Embedding prefilter<br/>(cheap ICP match)"]
        CLS["LLM Classifier<br/>(type · strength · ICP match)"]
        RES["Deep-Research Agent<br/>(search + fetch + github, cited)"]
    end

    subgraph Data["Postgres + pgvector"]
        DB[("companies · people · signals<br/>icps · dossiers · lists<br/>audit_logs · llm_runs · cursors")]
    end

    subgraph App["Next.js app (apps/web)"]
        FEED["Dashboard / Signal Feed UI"]
        REST["REST API + outbound webhooks"]
        MCPH["HTTP MCP endpoint"]
        CSV["CSV / flat-file export"]
    end

    MCP["stdio MCP server<br/>(Claude Desktop / Cursor)"]
    EVAL["Eval harness<br/>(golden sets, CI gate)"]

    Sources --> ADP --> NORM --> DB
    NORM --> PRE --> CLS --> DB
    RES --> DB
    DB --> FEED
    DB --> REST
    DB --> MCPH
    DB --> CSV
    DB --> MCP
    CLS -. logs .-> EVAL
    RES -. logs .-> EVAL
    REST -. triggers .-> RES
    FEED -. triggers .-> RES
```

### Component responsibilities
- **Source adapters** — one module per source. Pure functions: given a cursor (last-seen), fetch new items, return a normalized `RawItem[]`. No LLM here.
- **Normalizer + entity resolution** — turn `RawItem` into a `company`/`person` upsert + a `signal` row; dedupe by `content_hash`. **This is the unglamorous 30%** — see §5b.
- **Embedding prefilter** — embed the item, cosine-compare to active ICP embeddings, keep only items above threshold (cap N/day/source). Controls LLM spend.
- **LLM classifier** — assign `{type, strength, matched_icp_ids, justification}`. Logged to `llm_runs` for evals.
- **Deep-research agent** — agentic loop (search + fetch + github tools), fills a fixed dossier schema, **attaches a source to every claim**, capped tool-calls, cached, budget-guarded.
- **Next.js app** — dashboard, REST API, outbound webhooks, HTTP MCP endpoint, CSV export.
- **MCP servers** — stdio package for local agents (Claude Desktop/Cursor) + an HTTP endpoint in the app.
- **Eval harness** — golden datasets + a runner that scores classification precision/recall and dossier accuracy/hallucination. Runs on every prompt change.

### Monorepo layout (keep it flat for a 1-day build)
```
signal-scout/
  app/                 # Next.js 15 (App Router): dashboard + /api + HTTP MCP
  worker/              # pg-boss worker entrypoint: schedulers + jobs
  lib/
    db/                # Drizzle schema, migrations, client
    adapters/          # sec.ts, greenhouse.ts, lever.ts, github.ts, web-diff.ts, luma.ts
    entity/            # resolution.ts (domain/name/person matching)
    classify/          # classifier.ts + prompt + zod schema + taxonomy
    research/          # agent.ts + dossier schema + citation guard
    providers/         # llm.ts, search.ts, email.ts  (pluggable interfaces)
    delivery/          # csv.ts, webhook.ts, slack.ts
  mcp/                 # stdio MCP server (Claude/Cursor)
  evals/
    golden/            # classification/*.json, dossiers/*.json
    run.ts             # eval runner
  docker-compose.yml   # postgres + pgvector (+ optional searxng)
  .env.example
```

---

## 3. Tech stack (and why each pick is open-source-clean)

| Layer | Pick | License | Why | Closed-dependency flag |
|---|---|---|---|---|
| App + API | **Next.js 15 (App Router)**, TypeScript | MIT | One app for dashboard, REST, webhooks, HTTP-MCP. App-heavy → TS over Python. | — |
| DB | **Postgres + pgvector** | PostgreSQL / OSL | Relational + vector in one. | — |
| ORM/migrations | **Drizzle** | Apache-2.0 | Lightweight, pgvector-friendly, SQL-first. | — |
| Jobs/scheduling | **pg-boss** (or Graphile Worker) | MIT | Postgres-backed queue + cron. **No extra infra.** | — (avoids Inngest/Temporal cloud) |
| LLM access | **Vercel AI SDK** (`ai`) + `@ai-sdk/anthropic` | Apache-2.0 | Provider-agnostic tool-calling for the agent. | Model API is a service; **swap to `ollama-ai-provider` for fully-local/open** — keep the interface. |
| Search (deep research) | **`SearchProvider` interface** → default Tavily/Exa, open path SearXNG + Playwright | mixed | Day-1 speed via hosted; open path keeps core clean. | **Tavily/Exa = closed SaaS** (Tavily MCP is MIT). Open swap: **SearXNG** (AGPL, self-host) + **Crawl4AI** (Apache-2.0) / **Playwright** (Apache-2.0). |
| Page fetch / diffs | **Crawl4AI** or **Playwright** | Apache-2.0 | Open, self-hostable scraping for blog/changelog/careers. | (Firecrawl self-host is **AGPL-3.0** — usable but more copyleft than MIT/Apache; prefer Crawl4AI to stay MIT/Apache-aligned.) |
| GitHub | **Octokit** | MIT | Releases, contributions, starred repos. | needs a GitHub token (free). |
| SEC / job boards | **plain `fetch`** | — | All free, no-auth public JSON. | — |
| Email / notify | **Nodemailer** + SMTP | MIT | Open; works with any SMTP. | Resend is a closed drop-in if you want it. |
| Slack | **Incoming Webhooks** | — | One URL, no SDK for v1. | — |
| Auth | **Auth.js (NextAuth v5)** | ISC/MIT | GitHub OAuth or email magic link. | — |
| MCP | **`@modelcontextprotocol/sdk`** | MIT | stdio + HTTP servers. | — |
| UI | **Tailwind + shadcn/ui** + Recharts | MIT | Fast modern dashboard; similar IA to Autumn, your brand. | — |

**Open-source posture:** the *core* is MIT/Apache/Postgres-licensed and self-hostable end-to-end. The only optional closed pieces are (a) the hosted search API and (b) the LLM API — **both behind interfaces** with open swaps (SearXNG+Crawl4AI; Ollama/vLLM). No closed dependency is load-bearing. No secrets in code (`.env` only). This satisfies your "publishable to a clean public repo" requirement.

**Deployment note:** pg-boss needs a long-running process, so run the **Next app and the worker as two processes** (locally `pnpm dev` + `pnpm worker`; in prod, app on Vercel/Fly + worker as a separate Fly/Render/Docker service + Postgres on Neon/Supabase, or fully self-hosted via the compose file). Don't try to run the worker inside Vercel serverless.

---

## 4. Data model (Postgres — Drizzle/SQL sketch)

```sql
-- tenancy
create table organizations (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz default now());
create table users (id uuid primary key default gen_random_uuid(), org_id uuid references organizations(id), email text unique not null, name text, role text default 'member', created_at timestamptz default now());

-- entities (entity resolution targets)
create table companies (
  id uuid primary key default gen_random_uuid(),
  domain text unique,                 -- normalized registrable domain (the strong key)
  name text, normalized_name text,
  metadata jsonb default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null, normalized_name text,
  linkedin_url text unique,           -- strong key (nullable)
  email text,                         -- strong key (nullable)
  company_id uuid references companies(id),
  title text, location text,
  metadata jsonb default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ICPs
create table icps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  name text not null,
  definition jsonb not null,          -- {industries[], titles[], company_size, keywords[], geos[], signal_types[], notify{email,slack}}
  embedding vector(1536),             -- embed the definition for the prefilter
  created_at timestamptz default now()
);

-- signals
create table signals (
  id uuid primary key default gen_random_uuid(),
  source text not null,               -- sec | greenhouse | lever | ashby | github | web | luma
  source_url text, external_id text,
  content_hash text not null,         -- dedup key (per source)
  person_id uuid references people(id),
  company_id uuid references companies(id),
  raw_content text,
  type text,                          -- funding|hiring|product_launch|buying_intent|expansion|thought_leadership|event|sec_filing|github_release|content|partnership
  strength numeric,                   -- 0..1
  matched_icp_ids uuid[] default '{}',
  classification jsonb default '{}',  -- {justification, model, prompt_version}
  embedding vector(1536),
  published_at timestamptz, ingested_at timestamptz default now(),
  unique (source, content_hash)
);

-- dossiers (cited)
create table dossiers (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references people(id),
  org_id uuid references organizations(id),
  summary text,
  structured jsonb,                   -- {role, company, focus, github_contributions, tags[], why_they_care, suggested_opener}
  sources jsonb,                      -- [{claim, url, snippet}]  <-- every fact cited
  confidence numeric,                 -- = cited_facts / total_facts
  model text, prompt_version text, tool_calls int, cost_usd numeric,
  created_at timestamptz default now(), expires_at timestamptz
);

-- lists
create table lists (id uuid primary key default gen_random_uuid(), org_id uuid references organizations(id), name text, created_at timestamptz default now());
create table list_members (list_id uuid references lists(id), person_id uuid references people(id), added_at timestamptz default now(), primary key (list_id, person_id));

-- ingestion state + trust/cost
create table source_cursors (id uuid primary key default gen_random_uuid(), source text, key text, last_seen_at timestamptz, last_external_id text, unique(source, key));
create table audit_logs (id uuid primary key default gen_random_uuid(), org_id uuid, actor text, action text, subject_type text, subject_id uuid, detail jsonb, created_at timestamptz default now());
create table llm_runs (id uuid primary key default gen_random_uuid(), org_id uuid, kind text, model text, prompt_version text, input jsonb, output jsonb, tokens int, cost_usd numeric, latency_ms int, created_at timestamptz default now());
create table webhooks (id uuid primary key default gen_random_uuid(), org_id uuid, url text, secret text, events text[], active boolean default true);
create table deliveries (id uuid primary key default gen_random_uuid(), org_id uuid, kind text, target text, status text, detail jsonb, created_at timestamptz default now());

-- vector indexes
create index on signals using hnsw (embedding vector_cosine_ops);
create index on icps using hnsw (embedding vector_cosine_ops);
-- (also: pg_trgm on companies.normalized_name + people.normalized_name for fuzzy matching)
```

Auth.js will add its own `accounts`/`sessions`/`verification_tokens` tables via the Drizzle adapter.

---

## 5. The signal pipeline (in detail)

### 5a. Source adapters — exact endpoints (all free, no scraping of LinkedIn/X)

> **Hard rule (legality):** do **NOT** scrape LinkedIn or X directly — they litigate, and it breaks the open/clean-repo goal. For LinkedIn/X-style person data, treat it as an **optional, off-by-default enrichment adapter** the user supplies their own credits for (Apollo / People Data Labs / Proxycurl-class), behind a flag. Day 1 uses only the truly-free/public sources below.

- **SEC EDGAR (funding — Form D):**
  - Full-text search (free, official): `POST https://efts.sec.gov/LATEST/search-index` with a JSON body (or the documented query form) filtering `forms=D`; or pull the daily index. New filings searchable in <60s.
  - Submissions JSON (free): `https://data.sec.gov/submissions/CIK##########.json`.
  - **Required:** send a `User-Agent: YourApp your@email` header; respect ~10 req/s. No API key.
- **Hiring (public ATS JSON, no auth):**
  - Greenhouse: `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`
  - Lever: `GET https://api.lever.co/v0/postings/{company}?mode=json` (supports `team`, `location`, `department`, `limit`)
  - Ashby: public board JSON (`includeCompensation=true` for comp). Workable/Recruitee/Personio also expose public feeds.
  - Signal = a board's job set **changing** vs. last cursor (new roles, esp. GTM titles → "expansion/hiring").
- **GitHub (product/technical signals):** Octokit — releases (`repos.listReleases`), user activity/contributions, starred repos. Free token, generous rate limit.
- **Web diffs (blog / changelog / careers / report PDFs):** Crawl4AI/Playwright fetch on a schedule → store content hash → emit a `content`/`website_change` signal when the hash changes. Cheap and fully open.
- **Events (lu.ma):** fetch public event/attendee pages → `event` signals (conference-prep workflow).

Each adapter returns:
```ts
type RawItem = {
  source: 'sec'|'greenhouse'|'lever'|'ashby'|'github'|'web'|'luma';
  externalId: string;            // stable id from the source
  url: string;
  publishedAt?: string;
  actor: { kind:'company'|'person'; name:string; domain?:string; linkedinUrl?:string; email?:string };
  text: string;                  // human-readable content to classify
};
```

### 5b. Normalization + entity resolution (the part vibe-coding gets silently wrong)

```ts
// lib/entity/resolution.ts  — illustrative, not the whole thing
import { parse } from 'tldts'; // public-suffix aware

export function normalizeDomain(input: string): string | null {
  try { const u = input.includes('@') ? input.split('@')[1] : input;
        const d = parse(u.replace(/^https?:\/\//,'').replace(/^www\./,''));
        return d.domain ? d.domain.toLowerCase() : null; } catch { return null; }
}
export const normalizeName = (n: string) =>
  n.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/g,' ').trim();

// COMPANY: domain is the strong key. Fall back to fuzzy name (pg_trgm) ONLY to suggest, not auto-merge.
// PERSON:  linkedin_url OR email is the strong key.
//          DO NOT auto-merge people on name alone — "John Doe, PM" collides with dozens of humans.
//          If only (name + company) match, create/keep separate and mark low-confidence for review.
```

**Why this matters:** the #1 silent failure for this product is **merging two different people** (or failing to merge the same one across sources). A generated naive `WHERE name = ?` join will look fine in the demo and quietly corrupt your data and your dossiers. Strong keys only; everything else is a *suggestion* with a confidence score.

### 5c. Two-stage relevance (controls cost) → classifier

1. **Embedding prefilter:** embed each new item; cosine-match against active ICP embeddings; keep items ≥ threshold for *any* ICP; cap N/day/source. (Most items never reach the LLM → cheap.)
2. **LLM classifier** (logged to `llm_runs`):
```
SYSTEM: You classify a single public event about a company/person for a B2B sales team.
Output ONLY JSON matching the schema. Be conservative: when unsure, lower the strength.
Taxonomy: funding | hiring | product_launch | buying_intent | expansion |
          thought_leadership | event | sec_filing | github_release | content | partnership
Given the ITEM and the user's ICP DEFINITIONS, return:
{ "type": <one taxonomy value>,
  "strength": <0..1 how strong a buying signal this is for this ICP>,
  "matched_icp_ids": [<ids of ICPs this item is relevant to>],
  "justification": "<=1 sentence" }
```
Validate with zod; store `signal` + embedding. If `strength ≥ ICP.notify_threshold` and the ICP has notify on → enqueue a notification (deduped). **Confidence threshold before notifying = your churn defense** (three false alarms and the user is gone).

### 5d. Dedup / freshness
- Per-source `content_hash` UNIQUE → never emit the same item twice.
- `source_cursors` track `last_seen_at` / `last_external_id` for incremental pulls.
- "Real-time" = short cron intervals (SEC ~5 min, ATS hourly, GitHub hourly, web/luma daily). **Honest:** true low-latency real-time at scale is a Stage-2 infra problem; cron is the right Day-1 answer.

---

## 6. The deep-research agent

### 6a. Dossier schema (mirrors Autumn's *function*; your strings)
```ts
const Fact = z.object({ value: z.string(), source_url: z.string().url(), snippet: z.string() });
const Dossier = z.object({
  identity: z.object({ full_name:z.string(), title:z.string().optional(), company:z.string().optional(), location:z.string().optional() }),
  tags: z.array(z.string()),                                  // segment/focus tags
  structured: z.object({
    role: Fact.optional(), company: Fact.optional(),
    github_contributions: Fact.optional(), focus: Fact.optional(),
    talks: z.array(Fact).optional(), publications: z.array(Fact).optional(),
    starred_repos: z.array(Fact).optional(),
  }),
  why_they_care: z.string(),                                  // tailored to YOUR product
  suggested_opener: z.string(),
  confidence: z.number(),                                     // cited_facts / total_facts
});
```

### 6b. Agent loop
- Tools (Vercel AI SDK `tool()`): `web_search(query)` (SearchProvider), `fetch_page(url)` (Crawl4AI/Playwright → markdown), `github_lookup(handleOrName)` (Octokit).
- **Cap tool calls** (e.g. 8–12) and set a per-run cost ceiling. Cache page fetches.
- The model fills the schema; **each factual field must carry `source_url` + `snippet`.**

### 6c. Citation guard (do not skip — this is the trust story)
```ts
function enforceCitations(d: Dossier) {
  const facts = collectFacts(d);                       // every Fact in structured{}
  const cited = facts.filter(f => isValidHttpUrl(f.source_url) && f.snippet?.length > 0);
  d.confidence = facts.length ? cited.length / facts.length : 0;
  // drop uncited facts; if confidence < 0.6 mark the dossier "low confidence" in the UI
  return { ...d, structured: dropUncited(d.structured), lowConfidence: d.confidence < 0.6 };
}
```
**Why:** name collisions make this agent *confidently wrong* ("John Doe the PM" gets attributed another John Doe's repos). A plausibly-wrong dossier is worse than an empty one. Cited claims the rep can click = the difference between trustworthy and dangerous. Cap enrichment to **ICP-matched people only** — never deep-research everything (that's how the unit economics die).

---

## 7. Delivery & integrations

- **Dashboard** — see §8.
- **REST API** — `GET /api/signals` (filter by icp/type/source/strength/date), `GET /api/people/:id`, `POST /api/people/:id/dossier`, `GET /api/lists/:id/export.csv`, `POST /api/research` (ad-hoc). Key-auth via `Authorization` header.
- **Outbound webhooks** — `webhooks` table; on new high-strength matched signal, POST a signed payload (HMAC with stored secret). **CRM push (HubSpot/Salesforce) is a Stage-2, explicitly gated action** — never auto-push; require a per-list confirmation + audit-log entry.
- **MCP server** — `mcp/` stdio package + `app/api/mcp` HTTP endpoint. Tools: `search_signals`, `get_person`, `generate_dossier`, `list_signals_for_company`, `export_list`. Ship copy-paste config for Claude Desktop/Cursor in `/integrations`. **This is ~half a day and instantly differentiates you with AI-native teams.**
- **Flat files** — CSV export now; "email me / drop to S3 on a schedule" is a thin Stage-2 add (Nodemailer + `@aws-sdk/client-s3`).
- **Slack / email digests** — Stage 2 (Incoming Webhook + a daily digest job).

---

## 8. The web app — pages (so it's a usable product, not a "book a demo" page)

> When Claude Code builds the frontend, have it read the **frontend-design** skill first. Aim for a clean, modern dashboard with a **similar information architecture** to Autumn (typed live feed + dossier panel + list builder) but entirely your own brand, colors, and copy.

| Route | What it does | Day-1? |
|---|---|---|
| `/login` | Auth.js (GitHub OAuth fastest, or magic link) | ✅ |
| `/feed` | **Live signal feed** — typed signal cards, filter bar (ICP, type, source, strength, date), infinite scroll; each card has **Deep research** + **Add to list** | ✅ (centerpiece) |
| `/icps` | Create/edit ICPs (industries, titles, size, keywords, geos, signal types, notify settings) | ✅ |
| `/research` | Ad-hoc: paste a name + company (or LinkedIn URL) → dossier on demand | ✅ |
| `/people/[id]` | Person profile + dossier panel (structured fields + narrative + **clickable sources** + suggested opener + refresh) | ✅ |
| `/lists` + `/lists/[id]` | List builder: add people, bulk deep-research (ICP-gated), **export CSV** | ✅ (export), bulk ⚠️ stretch |
| `/companies/[id]` | Company profile: signal timeline + people; **org-tree account monitoring** | ⚠️ Stage 2 |
| `/integrations` | API keys, MCP connect instructions, outbound webhooks, Slack, S3/CSV delivery | ✅ (keys + MCP), rest ⚠️ |
| `/settings` | Org, members, billing placeholder | partial |
| `/evals` (dev) | Latest classification precision/recall + dossier hallucination rate | nice-to-have |

A marketing landing page is **optional** — your explicit goal is the working product, so build the app first and add a thin landing later if you want one.

---

## 9. The trust layer (the 95% — build it from hour one)

1. **Eval harness** (`/evals`) — **highest-leverage thing in the whole project.**
   - `golden/classification/*.json`: `{ input: RawItem, expected: { type, min_strength } }` — hand-label **30–50 real items per source** (pull actual EDGAR filings, real Greenhouse boards, real GitHub releases).
   - `golden/dossiers/*.json`: `{ input:{name,company}, expect_facts:[{must_include, source_required:true}], must_not_say:[...] }`.
   - `run.ts` computes: classification **precision/recall per type**; dossier **fact-accuracy**, **citation-coverage**, **hallucination-rate**. Print a table; **fail the run** below thresholds. Re-run on every prompt edit. (This is exactly the discipline your context file calls the single highest-leverage move.)
2. **Audit logging** — every classification (`llm_runs`), every dossier (with sources + cost), every export/webhook (`deliveries`), every entity merge decision (`audit_logs`).
3. **Cost / budget guards** — per-org daily ceiling on classifier + research spend; deep-research **only** ICP-matched people; cache dossiers (`expires_at`).
4. **Confidence thresholds** — `strength ≥ notify_threshold` before any notification; dossier `confidence < 0.6` → "low confidence" badge, uncited facts dropped.
5. **ToS / rate-limit compliance** — SEC `User-Agent` + 10 req/s; honor `robots`/rate limits on crawls; **no LinkedIn/X scraping**; enrichment vendors only via user-supplied credits.
6. **Approval gate** — outbound CRM push is a confirmed, audited, per-list action (never automatic).

---

## 10. One-day execution plan (with Claude Code)

> A long, focused day. Each block: **goal → what Claude Code builds → "done" checkpoint → what you validate by hand.** Build in this order; don't skip the eval block.

**Block 1 (≈45 min) — Scaffold & infra.** Next.js 15 + TS + Tailwind + shadcn/ui; `docker-compose.yml` for Postgres+pgvector; Drizzle wired; `.env.example`; pnpm scripts (`dev`, `worker`, `db:push`, `eval`). *Done:* app boots, `db:push` creates tables. *Validate:* tables exist, pgvector extension on.

**Block 2 (≈45 min) — Schema & auth.** All tables from §4 in Drizzle; Auth.js with GitHub OAuth; org/user bootstrap on first login. *Done:* you can log in, an org+user row exists. *Validate:* RLS/tenant scoping intent is documented (Day-1 single-tenant is OK).

**Block 3 (≈90 min) — Source adapters (free sources).** SEC EDGAR (Form D), Greenhouse + Lever, GitHub releases/activity. Each = pure fn returning `RawItem[]` + cursor handling. Unit-test each against a **real** token/CIK/repo. *Done:* `pnpm tsx scripts/test-adapter.ts greenhouse stripe` prints real jobs. *Validate (critical):* eyeball that the data is real and fields map correctly — adapters are where "looks done, is empty" hides.

**Block 4 (≈75 min) — Normalizer + entity resolution.** `normalizeDomain`/`normalizeName`, company-by-domain, person-by-strong-key, **no name-only auto-merge**, `content_hash` dedup, upserts. *Done:* running adapters twice produces **no duplicates**. *Validate (critical):* deliberately feed two different "John Doe" items → confirm they do **not** merge.

**Block 5 (≈75 min) — ICPs + prefilter + classifier.** `/icps` CRUD; embed ICP definitions; embedding prefilter; LLM classifier with the §5c prompt + zod; persist signals; log `llm_runs`. *Done:* a seeded ICP produces classified, matched signals. *Validate:* spot-check 10 classifications by hand.

**Block 6 (≈45 min) — EVAL HARNESS.** `/evals/golden/classification/*.json` with ~30 hand-labeled real items; `run.ts` prints precision/recall and fails under threshold. *Done:* `pnpm eval` prints a table. *Validate:* your hand-labels are correct (garbage labels = garbage metric).

**Block 7 (≈90 min) — Feed UI.** `/feed` with typed signal cards, filter bar, infinite scroll, per-card **Deep research** + **Add to list**. Your brand/colors/copy. *Done:* feed renders real classified signals, filters work. *Validate:* it's *yours*, not a recolored Autumn.

**Block 8 (≈90 min) — Deep-research agent.** Tools (search/fetch/github), tool-call cap + cost ceiling, dossier schema, **citation guard**, cache; `/research` + `/people/[id]` dossier panel with clickable sources. *Done:* dossier on a real person, every fact links to a source. *Validate (critical):* pick someone with a common name → confirm it isn't attributing the wrong person's repos; uncited claims are dropped.

**Block 9 (≈45 min) — Lists + CSV + REST API.** `/lists`, add members, `GET /api/lists/:id/export.csv`; key-auth REST for signals/people/dossiers. *Done:* export opens cleanly in a sequencer/Sheets. *Validate:* CSV columns are sane.

**Block 10 (≈45 min) — MCP server.** stdio `mcp/` package + HTTP endpoint; tools `search_signals`/`get_person`/`generate_dossier`; `/integrations` shows the copy-paste Claude/Cursor config. *Done:* you query your signals from inside Claude Desktop/Cursor. *Validate:* a real MCP round-trip returns real data.

**Block 11 (≈30 min) — README, seed, polish.** README (setup, env, architecture, "open-source" notes), seed script (1 org, 1 ICP, sample sources), final `pnpm eval`. *Done:* a fresh clone runs from the README with no hardcoded secrets.

**If you run out of time, cut from the bottom up** (MCP → CSV/API → polish). Protect Blocks 4, 6, 8 — entity resolution, evals, citations. Those are the trust layer; the rest is comparatively easy to add later.

---

## 11. Where vibe-coded output will be silently wrong (validate these by hand)

1. **Entity resolution** — will auto-merge people on name and silently corrupt data. *Fix:* strong keys only; name-only matches are suggestions with a confidence score. **Test with colliding names.**
2. **Classification precision** — will pass the demo and mislabel real noise (every "we're hiring!" post ≠ an expansion signal). *Fix:* the eval set from real items; conservative strength. **Measure, don't vibe.**
3. **Dossier hallucination** — will confidently attribute the wrong person's GitHub/talks. *Fix:* mandatory per-fact citations + drop-uncited + low-confidence badge. **Test on common names.**
4. **Unit economics** — will enrich/research everything. *Fix:* ICP-gated research, daily budget ceiling, dossier caching. **Watch `llm_runs.cost_usd`.**
5. **Legality / ToS** — will happily write a LinkedIn/X scraper. *Fix:* free/public sources only; paid enrichment via user-supplied credits behind a flag. **Reject any generated LinkedIn scraper.**
6. **"Real-time" freshness** — will write polling whose dedup/cursor logic re-emits or drops items. *Fix:* `content_hash` UNIQUE + `source_cursors`. **Run each adapter twice and diff.**

---

## 12. After Day 1 (Stage 2 — what makes it actually sellable)

- Hardened entity resolution + an org-tree / account-monitoring view (`/companies/[id]`).
- Outbound: signed webhooks + **gated** HubSpot/Salesforce property push; Slack app + daily/weekly email digests; scheduled CSV→inbox/S3.
- More sources: Ashby/Workable hiring, lu.ma at scale, Product Hunt, changelog fleets; optional licensed LinkedIn/X enrichment (user credits).
- Real-time infra (shorter intervals, streaming where it matters), per-tenant isolation/RLS, billing (credit packs or per-seat $150–400/mo, matching the market).
- Grow the golden sets; add per-type precision dashboards; alert on metric regressions.

---

## 13. Appendix — `.env.example`

```bash
# --- core ---
DATABASE_URL=postgres://postgres:postgres@localhost:5432/signalscout
NEXTAUTH_SECRET=                      # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=                     # auth
GITHUB_CLIENT_SECRET=

# --- data sources (free) ---
SEC_USER_AGENT="Signal Scout you@example.com"   # required by SEC
GITHUB_TOKEN=                         # Octokit (free PAT)

# --- LLM (pluggable; pick one) ---
LLM_PROVIDER=anthropic                # or: ollama
ANTHROPIC_API_KEY=                    # if anthropic
OLLAMA_BASE_URL=http://localhost:11434 # if fully-open/local

# --- search for deep research (pluggable; closed unless searxng) ---
SEARCH_PROVIDER=tavily                # or: exa | searxng  (searxng = open/self-host)
TAVILY_API_KEY=
EXA_API_KEY=
SEARXNG_URL=http://localhost:8080

# --- email / notify (open via SMTP) ---
SMTP_URL=                             # smtp://user:pass@host:587  (Nodemailer)
SLACK_WEBHOOK_URL=                    # optional, Stage 2

# --- enrichment (OPTIONAL, off by default, user-supplied) ---
ENABLE_PAID_ENRICHMENT=false
APOLLO_API_KEY=
PDL_API_KEY=
```

**No secret ever goes in code.** Everything reads from env. That keeps the repo clean for a public, open-source release.
