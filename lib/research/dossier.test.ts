import { describe, it, expect } from 'vitest';
import { enforceCitations, isValidHttpUrl } from './dossier';
import type { Dossier } from '@/lib/types';

const base: Dossier = {
  identity: { full_name: 'Jane Doe', company: 'Acme' },
  tags: ['devtools'],
  structured: {
    role: { value: 'PM', source_url: 'https://github.com/janedoe', snippet: 'Product Manager' },
    company: { value: 'Acme', source_url: 'not-a-url', snippet: 'works at acme' },
    github_contributions: { value: '40 repos', source_url: 'https://github.com/janedoe', snippet: '40 public repos' },
    focus: { value: 'docs', source_url: 'https://github.com/janedoe/docs', snippet: '' },
    starred_repos: [
      { value: 'mintlify', source_url: 'https://github.com/mintlify/mintlify', snippet: 'starred' },
      { value: 'ghost', source_url: 'javascript:alert(1)', snippet: 'starred' },
    ],
  },
  why_they_care: 'cares about docs',
  suggested_opener: 'hi',
  confidence: 0,
};

describe('isValidHttpUrl', () => {
  it('accepts http(s), rejects others', () => {
    expect(isValidHttpUrl('https://x.com')).toBe(true);
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isValidHttpUrl('not-a-url')).toBe(false);
  });
});

describe('enforceCitations', () => {
  const g = enforceCitations(base);

  it('confidence = cited/total over ALL facts before dropping', () => {
    // facts: role(ok), company(bad url), gh(ok), focus(empty snippet), star1(ok), star2(bad url) = 6 total, 3 cited
    expect(g.confidence).toBeCloseTo(0.5, 2);
  });
  it('marks low confidence below 0.6', () => {
    expect(g.lowConfidence).toBe(true);
  });
  it('drops uncited facts (bad url / empty snippet)', () => {
    expect(g.structured.company).toBeUndefined();
    expect(g.structured.focus).toBeUndefined();
    expect(g.structured.role).toBeDefined();
    expect(g.structured.starred_repos).toHaveLength(1);
    expect(g.structured.starred_repos![0]!.value).toBe('mintlify');
  });
  it('builds a sources list only from surviving cited facts', () => {
    expect(g.sources.every((s) => isValidHttpUrl(s.url) && s.snippet.length > 0)).toBe(true);
    expect(g.sources.map((s) => s.url)).not.toContain('javascript:alert(1)');
  });
});
