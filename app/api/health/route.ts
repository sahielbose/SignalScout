import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Liveness + DB readiness probe for load balancers / deploy health checks. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ status: 'degraded', db: 'down', error: (err as Error).message }, { status: 503 });
  }
}
