-- Runs once on first DB init (docker-entrypoint-initdb.d).
-- Mirrored idempotently by scripts/setup-db.ts so `pnpm db:push` works
-- against any Postgres, not just the bundled container.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
