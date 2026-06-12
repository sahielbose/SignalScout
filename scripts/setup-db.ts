/**
 * Idempotently create required Postgres extensions BEFORE drizzle-kit push,
 * so vector/trgm column + index types resolve on any Postgres (not just the
 * bundled container, which also gets them via db/init).
 */
import 'dotenv/config';
import postgres from 'postgres';

const url =
  process.env.DATABASE_URL ??
  'postgres://signalscout:signalscout@localhost:5434/signalscout';

async function main() {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe('CREATE EXTENSION IF NOT EXISTS vector');
    await sql.unsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await sql.unsafe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    const rows = await sql`SELECT extversion AS version FROM pg_extension WHERE extname = 'vector'`;
    console.log(`[setup-db] extensions ready (pgvector ${rows[0]?.version ?? '?'})`);
  } catch (err) {
    console.error('[setup-db] failed — is Postgres running? (pnpm exec docker compose up -d db)');
    console.error(err);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
