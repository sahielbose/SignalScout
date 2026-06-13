import type { RawItem } from '@/lib/types';
import type { Adapter, AdapterInput, AdapterResult, AdapterCursor } from './types';
import { isNewer } from './types';
import { httpJson } from './http';
import { stripHtml } from './html';

export interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  departments?: { name?: string }[];
  metadata?: unknown;
}
interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

const GTM_HINTS =
  /\b(sales|account executive|gtm|go-to-market|revenue|marketing|growth|business development|bdr|sdr|partnerships?|customer success)\b/i;

/** Pure mapping - unit-tested with fixtures. */
export function mapGreenhouseJob(token: string, job: GreenhouseJob): RawItem {
  const dept = job.departments?.map((d) => d.name).filter(Boolean).join(', ');
  const loc = job.location?.name;
  const body = job.content ? stripHtml(job.content).slice(0, 1200) : '';
  const gtm = GTM_HINTS.test(job.title) || (dept ? GTM_HINTS.test(dept) : false);
  return {
    source: 'greenhouse',
    externalId: `${token}:${job.id}`,
    url: job.absolute_url,
    publishedAt: job.updated_at,
    actor: {
      kind: 'company',
      name: prettyToken(token),
      // greenhouse board token is a slug, not a domain - left for entity resolution to suggest.
    },
    title: job.title,
    text:
      `${prettyToken(token)} is hiring: ${job.title}` +
      (loc ? ` (${loc})` : '') +
      (dept ? ` - ${dept}` : '') +
      (body ? `\n${body}` : ''),
    hintType: gtm ? 'expansion' : 'hiring',
    meta: { token, jobId: job.id, location: loc, departments: dept, gtm },
  };
}

function prettyToken(token: string): string {
  return token
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export const greenhouseAdapter: Adapter = {
  source: 'greenhouse',
  label: 'Greenhouse',
  intervalSec: 3600,
  async fetch({ key, cursor, limit }: AdapterInput): Promise<AdapterResult> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(key)}/jobs?content=true`;
    const data = await httpJson<GreenhouseResponse>(url);
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    const fresh = jobs
      .filter((j) => isNewer(j.updated_at, cursor))
      .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
      .slice(0, limit ?? 100);
    const items = fresh.map((j) => mapGreenhouseJob(key, j));
    const newest = jobs.reduce<string | undefined>(
      (max, j) => (!max || j.updated_at > max ? j.updated_at : max),
      cursor?.lastSeenAt ?? undefined,
    );
    const newCursor: AdapterCursor = { lastSeenAt: newest, state: { count: jobs.length } };
    return { items, cursor: newCursor };
  },
};
