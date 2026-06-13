import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { deliveries, icps, users } from '@/lib/db/schema';
import { getFeed, getOrgIcpIds } from '@/lib/feed/queries';
import { toCsv } from '@/lib/delivery/csv';
import { sendEmail } from '@/lib/delivery/email';
import { uploadCsvToS3 } from '@/lib/delivery/s3';
import { env, hasS3 } from '@/lib/env';
import { SIGNAL_TYPE_LABELS, SOURCE_LABELS, type SignalType, type SourceName } from '@/lib/types';

/**
 * Scheduled flat-file (CSV) delivery.
 *
 * For each org that has at least one ICP, build a CSV of its recent high-strength
 * matched signals, email it to the org owner (log-fallback when no SMTP), upload
 * to S3 when configured (clean skip otherwise), and record a `deliveries` row.
 *
 * Gated on SCHEDULED_CSV_DELIVERY. Every query is org-scoped via the org's ICP ids
 * (getFeed fails closed - empty feed - when an org has no ICPs).
 */

const CSV_HEADERS = [
  'signal_id',
  'type',
  'strength',
  'company',
  'company_domain',
  'person',
  'title',
  'summary',
  'source',
  'source_url',
  'published_at',
];

export interface OrgDeliveryResult {
  orgId: string;
  rows: number;
  emailedTo: string | null;
  emailVia: 'smtp' | 'log' | null;
  s3: { ok: boolean; skipped: boolean; location?: string };
}

export interface ScheduledCsvResult {
  enabled: boolean;
  orgs: number;
  delivered: OrgDeliveryResult[];
}

/** Org-scoped CSV of recent, high-strength matched signals. Empty feed -> header-only CSV. */
export async function buildOrgSignalCsv(
  orgId: string,
  opts: { sinceDays?: number; minStrength?: number } = {},
): Promise<{ csv: string; rows: number }> {
  const orgIcpIds = await getOrgIcpIds(orgId);
  // Fail closed: an org with no ICPs gets no signals.
  if (orgIcpIds.length === 0) return { csv: toCsv(CSV_HEADERS, []), rows: 0 };

  const { items } = await getFeed(orgId, {
    sinceDays: opts.sinceDays ?? 7,
    minStrength: opts.minStrength ?? 0.6,
  });

  const rows = items.map((s) => [
    s.id,
    s.type ? (SIGNAL_TYPE_LABELS[s.type as SignalType] ?? s.type) : '',
    s.strength != null ? Math.round(s.strength * 100) + '%' : '',
    s.companyName ?? '',
    s.companyDomain ?? '',
    s.personName ?? '',
    s.title ?? '',
    s.summary ?? '',
    SOURCE_LABELS[s.source as SourceName] ?? s.source,
    s.sourceUrl ?? '',
    (s.publishedAt ?? s.ingestedAt)?.toISOString() ?? '',
  ]);

  return { csv: toCsv(CSV_HEADERS, rows), rows: rows.length };
}

async function orgOwnerEmail(orgId: string): Promise<string | null> {
  const [owner] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.role, 'owner')))
    .orderBy(desc(users.createdAt))
    .limit(1);
  return owner?.email ?? null;
}

async function orgsWithIcps(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ orgId: icps.orgId })
    .from(icps)
    .where(eq(icps.active, true));
  return rows.map((r) => r.orgId).filter((x): x is string => !!x);
}

export async function runScheduledCsvDelivery(): Promise<ScheduledCsvResult> {
  if (!env().SCHEDULED_CSV_DELIVERY) {
    console.log('[scheduled-csv] disabled (set SCHEDULED_CSV_DELIVERY=true to enable)');
    return { enabled: false, orgs: 0, delivered: [] };
  }

  const appUrl = env().NEXT_PUBLIC_APP_URL;
  const orgIds = await orgsWithIcps();
  const delivered: OrgDeliveryResult[] = [];

  for (const orgId of orgIds) {
    const { csv, rows } = await buildOrgSignalCsv(orgId);

    const day = new Date().toISOString().slice(0, 10);
    const key = `signals/${orgId}/${day}.csv`;

    // S3 (no-op clean skip when not configured)
    const s3 = await uploadCsvToS3(key, csv);

    // Email to the org owner (log-fallback when no SMTP)
    const to = await orgOwnerEmail(orgId);
    let emailVia: 'smtp' | 'log' | null = null;
    if (to) {
      const subject = rows
        ? `Signal Scout - ${rows} signal${rows === 1 ? '' : 's'} (CSV export)`
        : 'Signal Scout - daily CSV export (no new signals)';
      const html = `<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
        <div style="max-width:560px;margin:0 auto;padding:24px">
          <div style="font-size:18px;font-weight:700;color:#0f766e">Signal Scout</div>
          <h1 style="font-size:20px;color:#111827;margin:12px 0">Your scheduled CSV export</h1>
          <p style="color:#374151;font-size:13px;margin:0 0 12px">${rows} high-strength matched signal${rows === 1 ? '' : 's'} from the last 7 days are attached as a flat file (CSV).</p>
          <p style="color:#6b7280;font-size:12px;margin:0 0 16px">${s3.location ? `Also written to ${s3.location}.` : 'Configure S3 to also archive these exports.'}</p>
          <a href="${appUrl}/feed" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 16px;border-radius:6px">Open the feed</a>
        </div>
      </body></html>`;
      const text = `Signal Scout - scheduled CSV export\n\n${rows} matched signal(s) from the last 7 days.\n\n${csv}`;
      const r = await sendEmail({ to, subject, html, text });
      emailVia = r.via;
    }

    // Record the delivery (org-scoped)
    const status = to || hasS3() ? 'sent' : 'pending';
    await db.insert(deliveries).values({
      orgId,
      kind: 'csv',
      target: to ?? key,
      status,
      detail: {
        rows,
        bytes: csv.length,
        emailedTo: to ?? null,
        emailVia,
        s3Skipped: s3.skipped,
        s3Location: s3.location ?? null,
        s3Note: s3.note ?? null,
      },
    });

    delivered.push({
      orgId,
      rows,
      emailedTo: to,
      emailVia,
      s3: { ok: s3.ok, skipped: s3.skipped, location: s3.location },
    });
    console.log(`[scheduled-csv] org ${orgId.slice(0, 8)}: ${rows} rows, email=${emailVia ?? 'no-owner'}, s3=${s3.skipped ? 'skipped' : 'uploaded'}`);
  }

  return { enabled: true, orgs: orgIds.length, delivered };
}
