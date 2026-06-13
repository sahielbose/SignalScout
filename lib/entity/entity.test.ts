import { describe, it, expect } from 'vitest';
import {
  normalizeDomain,
  normalizeName,
  normalizeCompanyName,
  normalizeLinkedinUrl,
  normalizeEmail,
} from './normalize';
import {
  decideCompanyResolution,
  decidePersonResolution,
  type CompanyCandidate,
  type PersonCandidate,
} from './resolution';

describe('normalizeDomain', () => {
  it('extracts the registrable domain from urls, subdomains, emails', () => {
    expect(normalizeDomain('https://www.Stripe.com/blog')).toBe('stripe.com');
    expect(normalizeDomain('careers.sub.stripe.com')).toBe('stripe.com');
    expect(normalizeDomain('jane@acme.co.uk')).toBe('acme.co.uk');
    expect(normalizeDomain('not a domain')).toBeNull();
    expect(normalizeDomain('')).toBeNull();
  });
});

describe('name normalization', () => {
  it('normalizeName lowercases and strips punctuation/accents', () => {
    expect(normalizeName('Renée O’Brien-Smith')).toBe('renee o brien smith');
  });
  it('normalizeCompanyName strips legal suffixes', () => {
    expect(normalizeCompanyName('Apple Inc.')).toBe('apple');
    expect(normalizeCompanyName('Acme Technologies, LLC')).toBe('acme');
  });
});

describe('linkedin + email normalization', () => {
  it('canonicalizes linkedin profile urls', () => {
    expect(normalizeLinkedinUrl('linkedin.com/in/JaneDoe/')).toBe('https://www.linkedin.com/in/janedoe');
    expect(normalizeLinkedinUrl('https://example.com/in/x')).toBeNull();
  });
  it('validates emails', () => {
    expect(normalizeEmail('Jane@Acme.COM')).toBe('jane@acme.com');
    expect(normalizeEmail('nope')).toBeNull();
  });
});

describe('decideCompanyResolution', () => {
  const cands: CompanyCandidate[] = [
    { id: 'c1', domain: 'stripe.com', normalizedName: 'stripe' },
    { id: 'c2', domain: null, normalizedName: 'acme' },
  ];
  it('matches by domain (strong key)', () => {
    expect(decideCompanyResolution({ domain: 'stripe.com', normalizedName: 'stripe' }, cands)).toEqual({
      action: 'match',
      id: 'c1',
      via: 'domain',
    });
  });
  it('creates when domain is new even if a same-name domain-less row exists', () => {
    const d = decideCompanyResolution({ domain: 'newco.com', normalizedName: 'acme' }, cands);
    expect(d.action).toBe('create');
  });
  it('matches a domain-less company by EXACT normalized name (dedupe)', () => {
    expect(decideCompanyResolution({ domain: null, normalizedName: 'acme' }, cands)).toEqual({
      action: 'match',
      id: 'c2',
      via: 'exact_name',
    });
  });
});

describe('decidePersonResolution - the no-merge invariant', () => {
  it('matches on linkedin url (strong key)', () => {
    const cands: PersonCandidate[] = [
      { id: 'p1', linkedinUrl: 'https://www.linkedin.com/in/janedoe', email: null, normalizedName: 'jane doe', companyId: null },
    ];
    const d = decidePersonResolution(
      { fullName: 'Jane Doe', normalizedName: 'jane doe', linkedinUrl: 'https://www.linkedin.com/in/janedoe', email: null, companyId: null },
      cands,
    );
    expect(d).toEqual({ action: 'match', id: 'p1', via: 'linkedin' });
  });

  it('NEVER merges two different people who share a name and have no strong key', () => {
    // existing "John Doe" with no strong key
    const cands: PersonCandidate[] = [
      { id: 'p_existing', linkedinUrl: null, email: null, normalizedName: 'john doe', companyId: 'cA' },
    ];
    // a DIFFERENT John Doe arrives, also no strong key, different company
    const d = decidePersonResolution(
      { fullName: 'John Doe', normalizedName: 'john doe', linkedinUrl: null, email: null, companyId: 'cB' },
      cands,
    );
    expect(d.action).toBe('create'); // <-- creates separate, does NOT match
    if (d.action === 'create') {
      expect(d.confidence).toBe(0.4);
      expect(d.suggestion?.id).toBe('p_existing'); // surfaced as a suggestion, not a merge
    }
  });

  it('same name + same company is a low-confidence suggestion, still separate', () => {
    const cands: PersonCandidate[] = [
      { id: 'p_existing', linkedinUrl: null, email: null, normalizedName: 'john doe', companyId: 'cA' },
    ];
    const d = decidePersonResolution(
      { fullName: 'John Doe', normalizedName: 'john doe', linkedinUrl: null, email: null, companyId: 'cA' },
      cands,
    );
    expect(d.action).toBe('create');
    if (d.action === 'create') {
      expect(d.confidence).toBe(0.5);
      expect(d.suggestion?.reason).toBe('same name + same company');
    }
  });

  it('matches on email even when names differ slightly', () => {
    const cands: PersonCandidate[] = [
      { id: 'p2', linkedinUrl: null, email: 'jane@acme.com', normalizedName: 'jane doe', companyId: null },
    ];
    const d = decidePersonResolution(
      { fullName: 'Jane A. Doe', normalizedName: 'jane a doe', linkedinUrl: null, email: 'jane@acme.com', companyId: null },
      cands,
    );
    expect(d).toEqual({ action: 'match', id: 'p2', via: 'email' });
  });
});
