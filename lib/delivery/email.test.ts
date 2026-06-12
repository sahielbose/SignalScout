import { describe, it, expect } from 'vitest';
import { renderDigest } from './email';

describe('renderDigest', () => {
  const signals = [
    { type: 'funding', strength: 0.9, company: 'Bright Labs', title: 'Raised a Series B', summary: null, url: 'https://x.com/a', source: 'sec' },
    { type: 'expansion', strength: 0.7, company: 'Acme', title: 'Hiring Account Executives', summary: null, url: null, source: 'greenhouse' },
  ];

  it('renders a subject + html + text with the signals', () => {
    const d = renderDigest('Acme Workspace', signals, 'https://app.example.com');
    expect(d.subject).toContain('2 new buying signals');
    expect(d.html).toContain('Bright Labs');
    expect(d.html).toContain('Funding');
    expect(d.html).toContain('https://x.com/a');
    expect(d.text).toContain('Acme');
  });

  it('handles the empty case', () => {
    const d = renderDigest('Acme', [], 'https://app.example.com');
    expect(d.subject).toContain('No new signals');
    expect(d.html).toContain('Nothing new');
  });

  it('escapes html in titles/companies', () => {
    const d = renderDigest('Org', [{ type: 'content', strength: 0.3, company: '<script>', title: 'a & b', summary: null, url: null, source: 'web' }], 'https://app');
    expect(d.html).not.toContain('<script>');
    expect(d.html).toContain('&lt;script&gt;');
  });
});
