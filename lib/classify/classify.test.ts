import { describe, it, expect } from 'vitest';
import { inferType, mockClassify } from './mock';
import { prefilter } from './prefilter';
import { localEmbed, cosine } from '@/lib/providers/embed';
import type { IcpDefinition } from '@/lib/types';

const fintechIcp: IcpDefinition = {
  industries: ['fintech'],
  titles: ['account executive'],
  keywords: ['payments', 'api'],
  geos: [],
  signalTypes: ['funding', 'expansion', 'github_release'],
  notify: { email: false, slack: false },
  notifyThreshold: 0.7,
};

describe('inferType is source-aware', () => {
  it('ATS posting respects the GTM hint, not description boilerplate', () => {
    expect(
      inferType({ source: 'greenhouse', title: 'Mobile Engineer', text: "we're growing our sales team", hint: 'hiring', icps: [] }),
    ).toBe('hiring');
    expect(
      inferType({ source: 'greenhouse', title: 'Account Executive', text: 'sell payments', hint: 'expansion', icps: [] }),
    ).toBe('expansion');
  });
  it('github → github_release; sec Form D → funding; luma → event', () => {
    expect(inferType({ source: 'github', text: 'released v2', icps: [] })).toBe('github_release');
    expect(inferType({ source: 'sec', text: 'filed a Form D exempt offering', hint: 'funding', icps: [] })).toBe('funding');
    expect(inferType({ source: 'luma', text: 'meetup tonight', icps: [] })).toBe('event');
  });
  it('web content infers product_launch from cues', () => {
    expect(inferType({ source: 'web', title: 'Introducing our new API', text: 'now available', icps: [] })).toBe('product_launch');
  });
});

describe('mockClassify ICP matching is precise', () => {
  const icps = [{ id: 'icp1', name: 'Fintech', definition: fintechIcp }];

  it('matches a GTM expansion role at a fintech', () => {
    const r = mockClassify({ source: 'greenhouse', title: 'Account Executive', text: 'sell payments via our api', hint: 'expansion', icps });
    expect(r.type).toBe('expansion');
    expect(r.matchedIcpIndexes).toEqual([1]);
    expect(r.strength).toBeGreaterThan(0.6);
  });

  it('does NOT match a hiring signal when the ICP excludes hiring (hard filter)', () => {
    const r = mockClassify({ source: 'greenhouse', title: 'Backend Engineer', text: 'build payments api', hint: 'hiring', icps });
    expect(r.type).toBe('hiring');
    expect(r.matchedIcpIndexes).toEqual([]); // hiring not in signalTypes → excluded
    expect(r.strength).toBeLessThan(0.5);
  });

  it('keeps strength within [0,1]', () => {
    const r = mockClassify({ source: 'github', text: 'released payments api sdk v2', icps });
    expect(r.strength).toBeGreaterThanOrEqual(0);
    expect(r.strength).toBeLessThanOrEqual(1);
  });
});

describe('embedding prefilter', () => {
  it('localEmbed is deterministic and self-cosine is 1', () => {
    const a = localEmbed('payments api fintech');
    const b = localEmbed('payments api fintech');
    expect(cosine(a, b)).toBeCloseTo(1, 5);
  });
  it('related text scores higher than unrelated', () => {
    const icpEmb = localEmbed('fintech payments api developer platform');
    const related = cosine(localEmbed('new payments api for developers'), icpEmb);
    const unrelated = cosine(localEmbed('gardening tips for tomatoes'), icpEmb);
    expect(related).toBeGreaterThan(unrelated);
  });
  it('prefilter selects ICPs above threshold', () => {
    const icpEmb = localEmbed('fintech payments api');
    const result = prefilter(localEmbed('payments api launch'), [
      { id: 'a', name: 'A', definition: fintechIcp, embedding: icpEmb },
      { id: 'b', name: 'B', definition: fintechIcp, embedding: localEmbed('agriculture tractors soil') },
    ]);
    expect(result.candidates.map((c) => c.id)).toContain('a');
    expect(result.bestScore).toBeGreaterThan(0);
  });
});
