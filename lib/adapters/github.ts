import type { RawItem } from '@/lib/types';
import type { Adapter, AdapterInput, AdapterResult, AdapterCursor } from './types';
import { isNewer } from './types';
import { getOctokit } from '@/lib/providers/github-client';

export interface GithubRelease {
  id: number;
  tag_name: string;
  name?: string | null;
  body?: string | null;
  html_url: string;
  published_at?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  author?: { login?: string } | null;
}

export function parseRepoKey(key: string): { owner: string; repo: string } {
  const [owner, repo] = key.split('/');
  if (!owner || !repo) throw new Error(`github key must be "owner/repo", got "${key}"`);
  return { owner, repo };
}

/** Pure mapping — unit-tested with fixtures. */
export function mapGithubRelease(owner: string, repo: string, r: GithubRelease): RawItem {
  const title = r.name?.trim() || r.tag_name;
  const body = (r.body ?? '').slice(0, 1500);
  return {
    source: 'github',
    externalId: `${owner}/${repo}:${r.id}`,
    url: r.html_url,
    publishedAt: r.published_at ?? undefined,
    actor: {
      kind: 'company',
      name: owner,
      githubLogin: owner,
    },
    title: `${repo} ${r.tag_name}`,
    text:
      `${owner}/${repo} released ${r.tag_name}${title && title !== r.tag_name ? ` — ${title}` : ''}.` +
      (r.prerelease ? ' (prerelease)' : '') +
      (body ? `\n${body}` : ''),
    hintType: 'github_release',
    meta: { owner, repo, tag: r.tag_name, prerelease: !!r.prerelease, releaseId: r.id },
  };
}

export const githubAdapter: Adapter = {
  source: 'github',
  label: 'GitHub',
  intervalSec: 3600,
  async fetch({ key, cursor, limit }: AdapterInput): Promise<AdapterResult> {
    const { owner, repo } = parseRepoKey(key);
    const octokit = await getOctokit();
    const res = await octokit.rest.repos.listReleases({ owner, repo, per_page: limit ?? 30 });
    const releases = res.data as GithubRelease[];
    const fresh = releases
      .filter((r) => !r.draft)
      .filter((r) => isNewer(r.published_at ?? undefined, cursor));
    const items = fresh.map((r) => mapGithubRelease(owner, repo, r));
    const newest = releases.reduce<string | undefined>((max, r) => {
      const t = r.published_at ?? undefined;
      return t && (!max || t > max) ? t : max;
    }, cursor?.lastSeenAt ?? undefined);
    const newCursor: AdapterCursor = { lastSeenAt: newest, state: { count: releases.length } };
    return { items, cursor: newCursor };
  },
};
