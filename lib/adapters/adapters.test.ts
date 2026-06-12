import { describe, it, expect } from 'vitest';
import { RawItemSchema } from '@/lib/types';
import { mapGreenhouseJob, type GreenhouseJob } from './greenhouse';
import { mapLeverPosting, type LeverPosting } from './lever';
import { mapAshbyJob, type AshbyJob } from './ashby';
import { mapGithubRelease, parseRepoKey, type GithubRelease } from './github';
import { mapSubmissionFiling, mapEftsHit } from './sec';
import { snapshotPage } from './web-diff';
import { mapLumaEvent } from './luma';
import { extractMeta, stripHtml } from './html';

const valid = (x: unknown) => RawItemSchema.safeParse(x).success;

describe('greenhouse mapping', () => {
  const job: GreenhouseJob = {
    id: 12345,
    title: 'Senior Account Executive',
    updated_at: '2026-06-10T12:00:00Z',
    absolute_url: 'https://boards.greenhouse.io/acme/jobs/12345',
    location: { name: 'Remote - US' },
    content: '<p>Sell <b>things</b></p>',
    departments: [{ name: 'Sales' }],
  };
  it('maps fields and flags GTM as expansion', () => {
    const r = mapGreenhouseJob('acme-corp', job);
    expect(valid(r)).toBe(true);
    expect(r.source).toBe('greenhouse');
    expect(r.externalId).toBe('acme-corp:12345');
    expect(r.url).toBe(job.absolute_url);
    expect(r.actor.name).toBe('Acme Corp');
    expect(r.hintType).toBe('expansion'); // sales role → expansion
    expect(r.text).toContain('Senior Account Executive');
    expect(r.text).not.toContain('<b>'); // html stripped
  });
  it('flags a non-GTM role as hiring', () => {
    expect(mapGreenhouseJob('acme', { ...job, title: 'Backend Engineer', departments: [{ name: 'Eng' }] }).hintType).toBe(
      'hiring',
    );
  });
});

describe('lever mapping', () => {
  const p: LeverPosting = {
    id: 'abc-123',
    text: 'Growth Marketing Lead',
    hostedUrl: 'https://jobs.lever.co/netflix/abc-123',
    createdAt: Date.UTC(2026, 5, 1),
    categories: { team: 'Marketing', location: 'LA' },
    descriptionPlain: 'Own growth.',
  };
  it('maps fields and converts epoch createdAt to ISO', () => {
    const r = mapLeverPosting('netflix', p);
    expect(valid(r)).toBe(true);
    expect(r.externalId).toBe('netflix:abc-123');
    expect(r.publishedAt).toBe(new Date(p.createdAt!).toISOString());
    expect(r.hintType).toBe('expansion');
  });
});

describe('ashby mapping', () => {
  const j: AshbyJob = {
    id: 'job_1',
    title: 'Platform Engineer',
    jobUrl: 'https://jobs.ashbyhq.com/ramp/job_1',
    location: 'NYC',
    team: 'Infrastructure',
    publishedAt: '2026-06-09T00:00:00Z',
    descriptionHtml: '<div>Build infra</div>',
  };
  it('maps and strips html', () => {
    const r = mapAshbyJob('ramp', j);
    expect(valid(r)).toBe(true);
    expect(r.externalId).toBe('ramp:job_1');
    expect(r.hintType).toBe('hiring');
    expect(r.text).toContain('Build infra');
  });
});

describe('github mapping', () => {
  it('parses owner/repo', () => {
    expect(parseRepoKey('facebook/react')).toEqual({ owner: 'facebook', repo: 'react' });
    expect(() => parseRepoKey('bad')).toThrow();
  });
  it('maps a release', () => {
    const rel: GithubRelease = {
      id: 999,
      tag_name: 'v2.1.0',
      name: 'Sparkle',
      body: 'Notes here',
      html_url: 'https://github.com/acme/widget/releases/tag/v2.1.0',
      published_at: '2026-06-08T00:00:00Z',
    };
    const r = mapGithubRelease('acme', 'widget', rel);
    expect(valid(r)).toBe(true);
    expect(r.source).toBe('github');
    expect(r.externalId).toBe('acme/widget:999');
    expect(r.hintType).toBe('github_release');
    expect(r.actor.githubLogin).toBe('acme');
    expect(r.text).toContain('v2.1.0');
  });
});

describe('sec mapping', () => {
  it('maps a Form D submission to funding', () => {
    const r = mapSubmissionFiling('Acme Inc.', 320193, {
      accessionNumber: '0000320193-26-000010',
      filingDate: '2026-06-01',
      form: 'D',
      primaryDocument: 'primary_doc.xml',
    });
    expect(valid(r)).toBe(true);
    expect(r.source).toBe('sec');
    expect(r.hintType).toBe('funding');
    expect(r.url).toContain('/Archives/edgar/data/320193/000032019326000010/primary_doc.xml');
    expect(r.externalId).toBe('0000320193-26-000010');
  });
  it('maps an EFTS hit and strips the CIK suffix from the name', () => {
    const r = mapEftsHit({
      _id: '0001234567-26-000123:primary_doc.html',
      _source: { display_names: ['Bright Labs Inc (CIK 0001234567)'], file_date: '2026-06-11', form: 'D', ciks: ['1234567'] },
    });
    expect(r).not.toBeNull();
    expect(valid(r)).toBe(true);
    expect(r!.actor.name).toBe('Bright Labs Inc');
    expect(r!.hintType).toBe('funding');
  });
});

describe('html helpers + web-diff', () => {
  it('extracts og meta and title', () => {
    const html = `<title>Old</title><meta property="og:title" content="New Launch"><meta name="description" content="Desc">`;
    const meta = extractMeta(html);
    expect(meta['og:title']).toBe('New Launch');
    expect(meta.description).toBe('Desc');
  });
  it('stripHtml removes scripts and tags', () => {
    expect(stripHtml('<script>bad()</script><p>Hello&amp;bye</p>')).toBe('Hello&bye');
  });
  it('snapshot hashes body text deterministically and ignores markup churn', () => {
    const a = snapshotPage('https://x.com', '<div><p>Same body</p></div>');
    const b = snapshotPage('https://x.com', '<section>  <p>Same body</p>  </section>');
    expect(a.hash).toBe(b.hash);
  });
});

describe('luma mapping', () => {
  it('maps og tags to an event item', () => {
    const r = mapLumaEvent('https://lu.ma/abc', { 'og:title': 'AI Builders Meetup', 'og:description': 'Tonight' });
    expect(r).not.toBeNull();
    expect(valid(r)).toBe(true);
    expect(r!.hintType).toBe('event');
    expect(r!.title).toBe('AI Builders Meetup');
  });
  it('returns null without a title', () => {
    expect(mapLumaEvent('https://lu.ma/abc', {})).toBeNull();
  });
});
