import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config({ path: '.env' });

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://signalscout:signalscout@localhost:5434/signalscout',
  },
  // Auth.js tables share the DB; only manage our own schema objects here.
  verbose: false,
  strict: false,
});
