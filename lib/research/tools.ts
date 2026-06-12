import { getSearchProvider, type SearchResult } from '@/lib/providers/search';
import { getOctokit, hasGithub } from '@/lib/providers/github-client';
import { assertSafeUrl, SsrfError } from './ssrf';
import { stripHtml, extractMeta } from '@/lib/adapters/html';
import { normalizeName, normalizeDomain } from '@/lib/entity/normalize';

// ───────────────────────────── web_search ─────────────────────────────
export async function searchWeb(query: string, limit = 6): Promise<SearchResult[]> {
  try {
    return await getSearchProvider().search(query, { limit });
  } catch {
    return [];
  }
}

// ───────────────────────── fetch_page (SSRF-guarded) ─────────────────────────
export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  ok: boolean;
  error?: string;
}

const pageCache = new Map<string, { at: number; page: FetchedPage }>();
const PAGE_TTL_MS = 30 * 60 * 1000;

export async function fetchPage(rawUrl: string, maxChars = 6000): Promise<FetchedPage> {
  const cached = pageCache.get(rawUrl);
  if (cached && Date.now() - cached.at < PAGE_TTL_MS) return cached.page;

  let page: FetchedPage;
  try {
    const safe = await assertSafeUrl(rawUrl);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 12_000);
    try {
      const res = await fetch(safe.toString(), {
        signal: ac.signal,
        redirect: 'manual', // do not auto-follow into a private redirect target
        headers: { 'User-Agent': 'SignalScout/0.1 (+https://github.com/sahielbose/Signal-Scout)' },
      });
      if (res.status >= 300 && res.status < 400) {
        page = { url: rawUrl, title: '', text: '', ok: false, error: `redirect ${res.status} not followed (SSRF safety)` };
      } else if (!res.ok) {
        page = { url: rawUrl, title: '', text: '', ok: false, error: `http ${res.status}` };
      } else {
        const html = await res.text();
        const meta = extractMeta(html);
        page = {
          url: rawUrl,
          title: meta['og:title'] || meta.title || rawUrl,
          text: stripHtml(html).slice(0, maxChars),
          ok: true,
        };
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const msg = err instanceof SsrfError ? `blocked: ${err.message}` : (err as Error).message;
    page = { url: rawUrl, title: '', text: '', ok: false, error: msg };
  }

  pageCache.set(rawUrl, { at: Date.now(), page });
  return page;
}

// ───────────────────────── github_lookup (identity-verified) ─────────────────────────
export interface GithubRepoRef {
  name: string;
  url: string;
  description: string | null;
  stars: number;
  language: string | null;
}
export interface GithubProfile {
  login: string;
  name: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  blog: string | null;
  profileUrl: string;
  publicRepos: number;
  followers: number;
  topRepos: GithubRepoRef[];
  starredRepos: { name: string; url: string }[];
  matchConfidence: number;
}

function companyOverlap(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const na = normalizeName(a.replace(/^@/, ''));
  const nb = normalizeName(b.replace(/^@/, ''));
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Find a GitHub user matching name (+ optional company/domain) and return a
 * verified profile with a matchConfidence. The CALLER must drop GitHub-derived
 * facts when confidence is low — this is what prevents attributing the wrong
 * "John Doe"'s repos.
 */
export async function githubLookup(input: {
  name: string;
  company?: string | null;
  domain?: string | null;
  githubLogin?: string | null;
}): Promise<GithubProfile | null> {
  if (!hasGithub()) return null;
  const octokit = await getOctokit();

  async function buildProfile(login: string, baseConfidence: number): Promise<GithubProfile | null> {
    try {
      const { data: u } = await octokit.rest.users.getByUsername({ username: login });
      const [reposRes, starredRes] = await Promise.all([
        octokit.rest.repos.listForUser({ username: login, sort: 'pushed', per_page: 6 }).catch(() => ({ data: [] as unknown[] })),
        octokit.rest.activity.listReposStarredByUser({ username: login, per_page: 8 }).catch(() => ({ data: [] as unknown[] })),
      ]);
      const repos = (reposRes.data as Array<{ name: string; html_url: string; description: string | null; stargazers_count?: number; language?: string | null; fork?: boolean }>);
      const topRepos: GithubRepoRef[] = repos
        .filter((r) => !r.fork)
        .slice(0, 5)
        .map((r) => ({ name: r.name, url: r.html_url, description: r.description, stars: r.stargazers_count ?? 0, language: r.language ?? null }));
      const starred = (starredRes.data as Array<{ name: string; html_url: string } | { repo: { name: string; html_url: string } }>);
      const starredRepos = starred.slice(0, 8).map((s) => {
        const repo = 'repo' in s ? s.repo : s;
        return { name: repo.name, url: repo.html_url };
      });

      // refine confidence with the fetched profile
      let conf = baseConfidence;
      if (companyOverlap(u.company, input.company) || companyOverlap(u.company, input.domain)) conf += 0.3;
      if (input.name && u.name && normalizeName(u.name) === normalizeName(input.name)) conf += 0.2;
      const blogDomain = normalizeDomain(u.blog ?? '');
      if (input.domain && blogDomain && blogDomain === normalizeDomain(input.domain)) conf += 0.2;

      return {
        login: u.login,
        name: u.name,
        company: u.company,
        location: u.location,
        bio: u.bio,
        blog: u.blog || null,
        profileUrl: u.html_url,
        publicRepos: u.public_repos ?? 0,
        followers: u.followers ?? 0,
        topRepos,
        starredRepos,
        matchConfidence: Math.min(1, conf),
      };
    } catch {
      return null;
    }
  }

  // explicit login → high base confidence
  if (input.githubLogin) {
    return buildProfile(input.githubLogin, 0.85);
  }

  // search by name (+ company hint)
  const q = [input.name, input.company ? `${input.company}` : ''].filter(Boolean).join(' ');
  let candidates: { login: string }[] = [];
  try {
    const res = await octokit.rest.search.users({ q: `${q} type:user`, per_page: 5 });
    candidates = res.data.items.map((i) => ({ login: i.login }));
  } catch {
    return null;
  }
  if (candidates.length === 0) return null;

  // score each candidate's full profile, keep the best
  let best: GithubProfile | null = null;
  for (const c of candidates.slice(0, 4)) {
    // base confidence: name match against the candidate login/name handled in buildProfile
    const p = await buildProfile(c.login, 0.25);
    if (p && (!best || p.matchConfidence > best.matchConfidence)) best = p;
  }
  return best;
}
