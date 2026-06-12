import { env } from '@/lib/env';

let octokitPromise: Promise<import('octokit').Octokit> | null = null;

/** Shared Octokit instance. Fail-fast on rate limits so nothing hangs. */
export function getOctokit() {
  if (!octokitPromise) {
    octokitPromise = import('octokit').then(
      ({ Octokit }) =>
        new Octokit({
          auth: env().GITHUB_TOKEN || undefined,
          throttle: { onRateLimit: () => false, onSecondaryRateLimit: () => false },
          request: { retries: 0 },
        }),
    );
  }
  return octokitPromise;
}

export function hasGithub(): boolean {
  return !!env().GITHUB_TOKEN;
}
