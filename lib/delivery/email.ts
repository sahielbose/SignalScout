import { env } from '@/lib/env';
import { SIGNAL_TYPE_LABELS, SOURCE_LABELS, type SignalType, type SourceName } from '@/lib/types';

export interface DigestSignal {
  type: string | null;
  strength: number | null;
  company: string | null;
  title: string | null;
  summary: string | null;
  url: string | null;
  source: string;
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Send via SMTP if configured; otherwise log (dev) so flows still work key-free. */
export async function sendEmail(args: SendEmailArgs): Promise<{ ok: boolean; via: 'smtp' | 'log' }> {
  const e = env();
  if (!e.SMTP_URL) {
    console.log(`[email:log] to=${args.to} subject="${args.subject}" (set SMTP_URL to actually send)`);
    return { ok: true, via: 'log' };
  }
  const nodemailer = await import('nodemailer');
  const transport = nodemailer.createTransport(e.SMTP_URL);
  await transport.sendMail({ from: e.EMAIL_FROM, to: args.to, subject: args.subject, html: args.html, text: args.text });
  return { ok: true, via: 'smtp' };
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);
}

/** Render a digest email. Pure — used by the worker job and tested directly. */
export function renderDigest(orgName: string, signals: DigestSignal[], appUrl: string): { subject: string; html: string; text: string } {
  const count = signals.length;
  const subject = count ? `${count} new buying signal${count === 1 ? '' : 's'} for ${orgName}` : `No new signals for ${orgName}`;

  const rows = signals
    .slice(0, 25)
    .map((s) => {
      const type = s.type ? (SIGNAL_TYPE_LABELS[s.type as SignalType] ?? s.type) : 'Signal';
      const src = SOURCE_LABELS[s.source as SourceName] ?? s.source;
      const pct = Math.round((s.strength ?? 0) * 100);
      const title = esc(s.title ?? '');
      const company = esc(s.company ?? 'Unknown');
      const link = s.url ?? appUrl + '/feed';
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top">
          <span style="display:inline-block;font-size:11px;font-weight:600;color:#0f766e;background:#ccfbf1;border-radius:999px;padding:2px 8px">${type}</span>
          <span style="color:#6b7280;font-size:11px"> ${pct}% · ${src}</span>
          <div style="font-weight:600;margin-top:4px"><a href="${link}" style="color:#111827;text-decoration:none">${company}</a></div>
          <div style="color:#374151;font-size:13px">${title}</div>
        </td>
      </tr>`;
    })
    .join('');

  const html = `<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <div style="font-size:18px;font-weight:700;color:#0f766e">Signal Scout</div>
      <h1 style="font-size:20px;color:#111827;margin:12px 0">${count ? `${count} new buying signal${count === 1 ? '' : 's'}` : 'No new signals today'}</h1>
      <p style="color:#6b7280;font-size:13px;margin:0 0 16px">Matched to ${esc(orgName)}'s ICPs.</p>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">${rows || '<tr><td style="padding:16px;color:#6b7280">Nothing new — check back tomorrow.</td></tr>'}</table>
      <a href="${appUrl}/feed" style="display:inline-block;margin-top:16px;background:#0f766e;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 16px;border-radius:6px">Open the feed</a>
      <p style="color:#9ca3af;font-size:11px;margin-top:24px">You're receiving this because email digests are on for an ICP. Manage in settings.</p>
    </div>
  </body></html>`;

  const text = `Signal Scout — ${subject}\n\n` + signals.slice(0, 25).map((s) => `- [${s.type}] ${s.company ?? '?'} (${Math.round((s.strength ?? 0) * 100)}%) ${s.title ?? ''} ${s.url ?? ''}`).join('\n');

  return { subject, html, text };
}
