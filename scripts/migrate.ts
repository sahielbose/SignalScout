/**
 * Production migration runner (run on deploy): create required extensions, then
 * apply generated Drizzle migrations from ./drizzle. Generate new migrations with
 * `pnpm db:generate` after editing the schema.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url =
  process.env.DATABASE_URL ?? 'postgres://signalscout:signalscout@localhost:5434/signalscout';

async function main() {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe('CREATE EXTENSION IF NOT EXISTS vector');
    await sql.unsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await sql.unsafe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('[migrate] migrations applied');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
