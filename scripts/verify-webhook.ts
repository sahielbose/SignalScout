/**
 * Phase 12 checkpoint: a webhook fires and its HMAC signature verifies at the receiver.
 * Spins up a local receiver, sends a signed event, and verifies it. Self-cleaning.
 */
import 'dotenv/config';
import { createServer } from 'node:http';
import { desc, eq } from 'drizzle-orm';
import { db, pgClient } from '@/lib/db/client';
import { organizations, webhooks, deliveries } from '@/lib/db/schema';
import { createWebhook, sendWebhook } from '@/lib/webhooks/service';
import { verifyWebhook } from '@/lib/delivery/webhook';

async function main() {
  console.log('\n▶ webhook fire + verify\n');
  const received: { verified: boolean; event: string | null } = { verified: false, event: null };
  let secret = '';

  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const sig = req.headers['x-signalscout-signature'] as string | undefined;
      received.event = (req.headers['x-signalscout-event'] as string) ?? null;
      received.verified = verifyWebhook(secret, body, sig);
      res.writeHead(200).end('ok');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}/hook`;

  const [org] = await db.select().from(organizations).orderBy(desc(organizations.createdAt)).limit(1);
  const hook = await createWebhook(org!.id, url, ['signal.created']);
  secret = hook!.secret;

  const ok = await sendWebhook(
    { id: hook!.id, orgId: org!.id, url, secret, events: ['signal.created'], filters: {}, active: true },
    'signal.created',
    { signals: [{ company: 'TestCo', type: 'funding', strength: 0.9 }] },
  );

  await new Promise((r) => setTimeout(r, 200));
  console.log(`  ${ok ? '✓' : '✗'} POST delivered (HTTP 2xx): ${ok}`);
  console.log(`  ${received.event === 'signal.created' ? '✓' : '✗'} event header = ${received.event}`);
  console.log(`  ${received.verified ? '✓' : '✗'} receiver verified the HMAC signature: ${received.verified}`);

  // cleanup
  await db.delete(deliveries).where(eq(deliveries.target, url));
  await db.delete(webhooks).where(eq(webhooks.id, hook!.id));
  server.close();

  const pass = ok && received.verified && received.event === 'signal.created';
  console.log(`\n${pass ? '✓ webhook fires + verifies' : '✗ FAILED'}\n`);
  await pgClient.end({ timeout: 5 });
  process.exit(pass ? 0 : 1);
}

main().catch(async (err) => {
  console.error('verify failed:', err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
