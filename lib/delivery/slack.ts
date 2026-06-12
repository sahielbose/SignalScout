import { SIGNAL_TYPE_LABELS, SOURCE_LABELS, type SignalType, type SourceName } from '@/lib/types';

export interface SlackSignal {
  type: string | null;
  strength: number | null;
  company: string | null;
  title: string | null;
  url: string | null;
  source: string;
}

export function formatSlackMessage(signals: SlackSignal[], heading = 'New buying signals'): string {
  const lines = signals.slice(0, 10).map((s) => {
    const type = s.type ? (SIGNAL_TYPE_LABELS[s.type as SignalType] ?? s.type) : 'Signal';
    const src = SOURCE_LABELS[s.source as SourceName] ?? s.source;
    const pct = Math.round((s.strength ?? 0) * 100);
    const title = s.title ? ` — ${s.title}` : '';
    const link = s.url ? `<${s.url}|${s.company ?? 'view'}>` : (s.company ?? 'Unknown');
    return `• *${type}* (${pct}%) · ${link}${title} _[${src}]_`;
  });
  return `*${heading}*\n${lines.join('\n')}`;
}

export async function postSlack(webhookUrl: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
