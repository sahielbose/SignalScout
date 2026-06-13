import type { RawItem } from '@/lib/types';
import type { Adapter, AdapterInput, AdapterResult, AdapterCursor } from './types';
import { isNewer } from './types';
import { httpJson } from './http';
import { stripHtml } from './html';

export interface AshbyJob {
  id?: string;
  title: string;
  jobUrl?: string;
  applyUrl?: string;
  location?: string;
  department?: string;
  team?: string;
  publishedAt?: string;
  updatedAt?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
}
interface AshbyResponse {
  jobs?: AshbyJob[];
  apiVersion?: string;
}

const GTM_HINTS =
  /\b(sales|account executive|gtm|go-to-market|revenue|marketing|growth|business development|bdr|sdr|partnerships?|customer success)\b/i;

export function mapAshbyJob(board: string, j: AshbyJob): RawItem {
  const published = j.publishedAt ?? j.updatedAt;
  const team = j.team ?? j.department;
  const body =
    (j.descriptionPlain ?? (j.descriptionHtml ? stripHtml(j.descriptionHtml) : '')).slice(0, 1200);
  const gtm = GTM_HINTS.test(j.title) || (team ? GTM_HINTS.test(team) : false);
  const id = j.id ?? `${j.title}:${j.location ?? ''}`;
  return {
    source: 'ashby',
    externalId: `${board}:${id}`,
    url: j.jobUrl ?? j.applyUrl ?? `https://jobs.ashbyhq.com/${board}`,
    publishedAt: published,
    actor: { kind: 'company', name: prettyToken(board) },
    title: j.title,
    text:
      `${prettyToken(board)} is hiring: ${j.title}` +
      (j.location ? ` (${j.location})` : '') +
      (team ? ` - ${team}` : '') +
      (body ? `\n${body}` : ''),
    hintType: gtm ? 'expansion' : 'hiring',
    meta: { board, jobId: id, team, location: j.location, gtm },
  };
}

function prettyToken(token: string): string {
  return token.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

export const ashbyAdapter: Adapter = {
  source: 'ashby',
  label: 'Ashby',
  intervalSec: 3600,
  async fetch({ key, cursor, limit }: AdapterInput): Promise<AdapterResult> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(key)}?includeCompensation=true`;
    const data = await httpJson<AshbyResponse>(url);
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    const fresh = jobs
      .filter((j) => isNewer(j.publishedAt ?? j.updatedAt, cursor))
      .slice(0, limit ?? 100);
    const items = fresh.map((j) => mapAshbyJob(key, j));
    const newest = jobs.reduce<string | undefined>((max, j) => {
      const t = j.publishedAt ?? j.updatedAt;
      return t && (!max || t > max) ? t : max;
    }, cursor?.lastSeenAt ?? undefined);
    const newCursor: AdapterCursor = { lastSeenAt: newest, state: { count: jobs.length } };
    return { items, cursor: newCursor };
  },
};
