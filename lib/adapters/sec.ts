import type { RawItem, SignalType } from '@/lib/types';
import type { Adapter, AdapterInput, AdapterResult, AdapterCursor } from './types';
import { isNewer } from './types';
import { httpJson } from './http';

// ───────────────────────── submissions JSON (per CIK) ─────────────────────────
interface SubmissionsRecent {
  accessionNumber: string[];
  filingDate: string[];
  form: string[];
  primaryDocument: string[];
  primaryDocDescription?: string[];
}
interface Submissions {
  cik: string;
  name: string;
  filings: { recent: SubmissionsRecent };
  website?: string;
}

function formToType(form: string): { type: SignalType; label: string } {
  const f = form.toUpperCase();
  if (f === 'D' || f.startsWith('D/')) return { type: 'funding', label: 'Form D (Reg D offering)' };
  if (f.startsWith('S-1') || f.startsWith('424')) return { type: 'funding', label: form };
  if (f.startsWith('8-K')) return { type: 'sec_filing', label: '8-K material event' };
  return { type: 'sec_filing', label: form };
}

export function mapSubmissionFiling(
  companyName: string,
  cikInt: number,
  row: { accessionNumber: string; filingDate: string; form: string; primaryDocument: string },
): RawItem {
  const accNoDashes = row.accessionNumber.replace(/-/g, '');
  const url = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNoDashes}/${row.primaryDocument || ''}`;
  const { type, label } = formToType(row.form);
  return {
    source: 'sec',
    externalId: row.accessionNumber,
    url,
    publishedAt: row.filingDate ? new Date(row.filingDate + 'T00:00:00Z').toISOString() : undefined,
    actor: { kind: 'company', name: companyName },
    title: `${companyName} filed ${row.form}`,
    text: `${companyName} filed a ${label} with the SEC on ${row.filingDate}.`,
    hintType: type,
    meta: { form: row.form, accession: row.accessionNumber, cik: cikInt },
  };
}

async function fetchSubmissions(cik: string, cursor?: AdapterCursor | null, limit = 50): Promise<AdapterResult> {
  const padded = cik.replace(/\D/g, '').padStart(10, '0');
  const data = await httpJson<Submissions>(`https://data.sec.gov/submissions/CIK${padded}.json`);
  const cikInt = Number(padded);
  const r = data.filings?.recent;
  const items: RawItem[] = [];
  if (r) {
    const n = Math.min(r.accessionNumber.length, limit * 4);
    for (let i = 0; i < n; i++) {
      const filingDate = r.filingDate[i] ?? '';
      const iso = filingDate ? new Date(filingDate + 'T00:00:00Z').toISOString() : undefined;
      if (!isNewer(iso, cursor)) continue;
      items.push(
        mapSubmissionFiling(data.name, cikInt, {
          accessionNumber: r.accessionNumber[i] ?? '',
          filingDate,
          form: r.form[i] ?? '',
          primaryDocument: r.primaryDocument[i] ?? '',
        }),
      );
      if (items.length >= limit) break;
    }
  }
  const newest = items[0]?.publishedAt ?? cursor?.lastSeenAt ?? undefined;
  return { items, cursor: { lastSeenAt: newest, state: { company: data.name } } };
}

// ───────────────────────── EFTS full-text search (discovery) ─────────────────────────
interface EftsHit {
  _id: string; // "accession:doc"
  _source: { display_names?: string[]; file_date?: string; form?: string; ciks?: string[] };
}
interface EftsResponse {
  hits: { total?: { value: number }; hits: EftsHit[] };
}

export function mapEftsHit(hit: EftsHit): RawItem | null {
  const [accession, doc] = hit._id.split(':');
  if (!accession) return null;
  const display = hit._source.display_names?.[0] ?? 'Unknown filer';
  const name = display.replace(/\s*\(CIK\s*\d+\)\s*$/i, '').trim();
  const cik = hit._source.ciks?.[0] ? Number(hit._source.ciks[0]) : null;
  const accNoDashes = accession.replace(/-/g, '');
  const url = cik
    ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoDashes}/${doc ?? ''}`
    : `https://efts.sec.gov/LATEST/search-index?q=${accession}`;
  const fileDate = hit._source.file_date;
  return {
    source: 'sec',
    externalId: accession,
    url,
    publishedAt: fileDate ? new Date(fileDate + 'T00:00:00Z').toISOString() : undefined,
    actor: { kind: 'company', name },
    title: `${name} filed Form ${hit._source.form ?? 'D'}`,
    text: `${name} filed a Form ${hit._source.form ?? 'D'} (Reg D exempt offering) with the SEC on ${fileDate ?? 'a recent date'}.`,
    hintType: 'funding',
    meta: { form: hit._source.form, accession, cik },
  };
}

async function fetchRecentFormD(cursor?: AdapterCursor | null, limit = 50): Promise<AdapterResult> {
  // last 4 days of Form D filings
  const end = new Date();
  const start = new Date(end.getTime() - 4 * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22&forms=D&startdt=${fmt(start)}&enddt=${fmt(end)}`;
  const data = await httpJson<EftsResponse>(url);
  const hits = data.hits?.hits ?? [];
  const items = hits
    .map(mapEftsHit)
    .filter((x): x is RawItem => !!x)
    .filter((x) => isNewer(x.publishedAt, cursor))
    .slice(0, limit);
  const newest = items[0]?.publishedAt ?? cursor?.lastSeenAt ?? undefined;
  return { items, cursor: { lastSeenAt: newest, state: { total: data.hits?.total?.value } } };
}

export const secAdapter: Adapter = {
  source: 'sec',
  label: 'SEC EDGAR',
  intervalSec: 300,
  async fetch({ key, cursor, limit }: AdapterInput): Promise<AdapterResult> {
    // key = "form-d" | "recent"  → discovery; key = CIK digits → per-company submissions
    if (key === 'form-d' || key === 'recent') return fetchRecentFormD(cursor, limit ?? 50);
    return fetchSubmissions(key, cursor, limit ?? 50);
  },
};
