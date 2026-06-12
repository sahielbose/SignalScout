import { describe, it, expect } from 'vitest';
import { signalMatchesIcp, icpRelevanceScore } from './match';
import type { IcpDefinition } from '@/lib/types';

const icp: IcpDefinition = {
  industries: ['fintech'],
  titles: ['account executive'],
  keywords: ['payments', 'api'],
  geos: [],
  signalTypes: ['funding', 'expansion', 'github_release'],
  notify: { email: false, slack: false },
  notifyThreshold: 0.7,
};

describe('signalMatchesIcp (backfill + mock share this)', () => {
  it('matches when keywords + allowed type', () => {
    expect(signalMatchesIcp('new payments api', 'github_release', icp)).toBe(true);
  });
  it('hard-excludes a disallowed type even with keyword overlap', () => {
    expect(icpRelevanceScore('new payments api', 'hiring', icp)).toBe(0);
    expect(signalMatchesIcp('new payments api', 'hiring', icp)).toBe(false);
  });
  it('does not match unrelated content', () => {
    expect(signalMatchesIcp('tomato gardening tips', 'funding', icp)).toBe(false);
  });
});
