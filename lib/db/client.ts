import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '@/lib/env';

/**
 * Single shared Postgres connection + Drizzle client.
 * Cached on globalThis so Next.js dev hot-reloads don't open a new pool each time.
 */
const globalForDb = globalThis as unknown as {
  __ssClient?: ReturnType<typeof postgres>;
  __ssDb?: ReturnType<typeof drizzle<typeof schema>>;
};

const client =
  globalForDb.__ssClient ??
  postgres(env().DATABASE_URL, {
    max: env().NODE_ENV === 'production' ? 10 : 5,
    idle_timeout: 20,
    onnotice: () => {},
  });

export const db = globalForDb.__ssDb ?? drizzle(client, { schema });

if (env().NODE_ENV !== 'production') {
  globalForDb.__ssClient = client;
  globalForDb.__ssDb = db;
}

export { schema };
export { client as pgClient };
