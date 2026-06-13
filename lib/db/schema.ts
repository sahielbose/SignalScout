import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  doublePrecision,
  date,
  vector,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type {
  IcpDefinition,
  SignalClassificationMeta,
  DossierStructured,
  DossierSource,
} from '@/lib/types';

export const EMBED_DIM = 1536;

// ───────────────────────────── tenancy ─────────────────────────────
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  plan: text('plan').default('free').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// users doubles as the Auth.js user table (extended with org_id + role).
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  role: text('role').default('member').notNull(),
  byoLlmKey: text('byo_llm_key'), // Phase 10: bring-your-own-key (encrypted at rest in prod)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ───────────────────── Auth.js (Drizzle adapter) ────────────────────
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_token',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ───────────────────── entities (resolution targets) ────────────────
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    domain: text('domain').unique(), // normalized registrable domain (the strong key)
    name: text('name'),
    normalizedName: text('normalized_name'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('companies_name_trgm_idx').using('gin', t.normalizedName.op('gin_trgm_ops')),
  ],
);

export const people = pgTable(
  'people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name').notNull(),
    normalizedName: text('normalized_name'),
    linkedinUrl: text('linkedin_url').unique(), // strong key (nullable)
    email: text('email'), // strong key (nullable) - uniqueness enforced via partial index below
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    title: text('title'),
    location: text('location'),
    githubLogin: text('github_login'),
    confidence: doublePrecision('confidence').default(1).notNull(), // 1 = strong-key, <1 = suggested
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('people_name_trgm_idx').using('gin', t.normalizedName.op('gin_trgm_ops')),
    // email is a strong key but nullable - enforce uniqueness only when present.
    uniqueIndex('people_email_unique')
      .on(t.email)
      .where(sql`${t.email} is not null`),
  ],
);

// ─────────────────────────────── ICPs ──────────────────────────────
export const icps = pgTable(
  'icps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    definition: jsonb('definition').$type<IcpDefinition>().notNull(),
    active: boolean('active').default(true).notNull(),
    embedding: vector('embedding', { dimensions: EMBED_DIM }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('icps_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
    index('icps_org_idx').on(t.orgId),
  ],
);

// ────────────────────────────── signals ────────────────────────────
export const signals = pgTable(
  'signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    source: text('source').notNull(), // sec | greenhouse | lever | ashby | github | web | luma
    sourceUrl: text('source_url'),
    externalId: text('external_id'),
    contentHash: text('content_hash').notNull(), // dedup key (per source)
    personId: uuid('person_id').references(() => people.id, { onDelete: 'set null' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    title: text('title'),
    rawContent: text('raw_content'),
    type: text('type'), // taxonomy value
    strength: doublePrecision('strength'), // 0..1
    matchedIcpIds: uuid('matched_icp_ids')
      .array()
      .default(sql`'{}'::uuid[]`)
      .notNull(),
    classification: jsonb('classification')
      .$type<SignalClassificationMeta>()
      .default({})
      .notNull(),
    embedding: vector('embedding', { dimensions: EMBED_DIM }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('signals_source_hash_unique').on(t.source, t.contentHash),
    index('signals_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
    index('signals_org_published_idx').on(t.orgId, t.publishedAt),
    index('signals_type_idx').on(t.type),
    index('signals_company_idx').on(t.companyId),
    index('signals_person_idx').on(t.personId),
  ],
);

// ────────────────────────── dossiers (cited) ───────────────────────
export const dossiers = pgTable(
  'dossiers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    summary: text('summary'),
    structured: jsonb('structured').$type<DossierStructured>(),
    sources: jsonb('sources').$type<DossierSource[]>().default([]).notNull(),
    tags: text('tags').array().default(sql`'{}'::text[]`).notNull(),
    whyTheyCare: text('why_they_care'),
    suggestedOpener: text('suggested_opener'),
    confidence: doublePrecision('confidence').default(0).notNull(), // cited/total
    lowConfidence: boolean('low_confidence').default(false).notNull(),
    model: text('model'),
    promptVersion: text('prompt_version'),
    toolCalls: integer('tool_calls').default(0).notNull(),
    costUsd: doublePrecision('cost_usd').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [index('dossiers_person_idx').on(t.personId)],
);

// ─────────────────────────────── lists ─────────────────────────────
export const lists = pgTable('lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// A list entry is a person OR a company (feed adds companies; research adds people).
export const listMembers = pgTable(
  'list_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    personId: uuid('person_id').references(() => people.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    note: text('note'),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('list_members_person_unique')
      .on(t.listId, t.personId)
      .where(sql`${t.personId} is not null`),
    uniqueIndex('list_members_company_unique')
      .on(t.listId, t.companyId)
      .where(sql`${t.companyId} is not null`),
  ],
);

// ───────────────── ingestion state + trust / cost ──────────────────
export const sourceCursors = pgTable(
  'source_cursors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(),
    key: text('key').notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    lastExternalId: text('last_external_id'),
    state: jsonb('state').$type<Record<string, unknown>>().default({}).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('source_cursors_unique').on(t.source, t.key)],
);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id'),
  actor: text('actor'),
  action: text('action').notNull(),
  subjectType: text('subject_type'),
  subjectId: uuid('subject_id'),
  detail: jsonb('detail').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const llmRuns = pgTable(
  'llm_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id'),
    kind: text('kind').notNull(), // classify | dossier | embed
    model: text('model'),
    promptVersion: text('prompt_version'),
    input: jsonb('input').$type<unknown>(),
    output: jsonb('output').$type<unknown>(),
    tokens: integer('tokens').default(0).notNull(),
    costUsd: doublePrecision('cost_usd').default(0).notNull(),
    latencyMs: integer('latency_ms').default(0).notNull(),
    ok: boolean('ok').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('llm_runs_org_created_idx').on(t.orgId, t.createdAt)],
);

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: text('events').array().default(sql`'{}'::text[]`).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const deliveries = pgTable('deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id'),
  kind: text('kind').notNull(), // webhook | slack | email | csv | crm
  target: text('target'),
  status: text('status').notNull(), // pending | sent | failed
  detail: jsonb('detail').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ───────────────── API keys + quotas (Phase 8/10) ──────────────────
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(), // shown in UI, e.g. "ssk_live_ab12"
    keyHash: text('key_hash').notNull().unique(), // sha-256 of full key
    scopes: text('scopes').array().default(sql`'{}'::text[]`).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('api_keys_org_idx').on(t.orgId)],
);

export const quotaUsage = pgTable(
  'quota_usage',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    kind: text('kind').notNull(), // classify | research
    count: integer('count').default(0).notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.day, t.kind] })],
);

// Postgres-backed token bucket (no external rate-limit dependency).
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(), // e.g. "ip:1.2.3.4" or "user:<uuid>"
  tokens: doublePrecision('tokens').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Per-org worklist state for a signal (the feed becomes an inbox you clear).
export const signalStatus = pgTable(
  'signal_status',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    signalId: uuid('signal_id')
      .notNull()
      .references(() => signals.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('open'), // open | snoozed | actioned | dismissed
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.signalId] })],
);

// Convenience type exports
export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Icp = typeof icps.$inferSelect;
export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;
export type Dossier = typeof dossiers.$inferSelect;
export type List = typeof lists.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
