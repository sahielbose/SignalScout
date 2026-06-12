import { env, hasSearch } from '@/lib/env';
import { httpJson } from '@/lib/adapters/http';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, opts?: { limit?: number }): Promise<SearchResult[]>;
}

const tavily: SearchProvider = {
  name: 'tavily',
  async search(query, opts) {
    const data = await httpJson<{ results?: { title: string; url: string; content: string }[] }>(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        body: JSON.stringify({
          api_key: env().TAVILY_API_KEY,
          query,
          max_results: opts?.limit ?? 6,
          search_depth: 'basic',
        }),
      },
    );
    return (data.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content }));
  },
};

const exa: SearchProvider = {
  name: 'exa',
  async search(query, opts) {
    const data = await httpJson<{ results?: { title?: string; url: string; text?: string }[] }>(
      'https://api.exa.ai/search',
      {
        method: 'POST',
        headers: { 'x-api-key': env().EXA_API_KEY ?? '' },
        body: JSON.stringify({ query, numResults: opts?.limit ?? 6, contents: { text: true } }),
      },
    );
    return (data.results ?? []).map((r) => ({ title: r.title ?? r.url, url: r.url, snippet: r.text ?? '' }));
  },
};

const searxng: SearchProvider = {
  name: 'searxng',
  async search(query, opts) {
    const url = `${env().SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json`;
    const data = await httpJson<{ results?: { title: string; url: string; content?: string }[] }>(url);
    return (data.results ?? []).slice(0, opts?.limit ?? 6).map((r) => ({ title: r.title, url: r.url, snippet: r.content ?? '' }));
  },
};

/** No-key fallback: returns nothing rather than fabricating sources. */
const mock: SearchProvider = {
  name: 'mock',
  async search() {
    return [];
  },
};

export function getSearchProvider(): SearchProvider {
  if (!hasSearch()) return mock;
  switch (env().SEARCH_PROVIDER) {
    case 'tavily':
      return tavily;
    case 'exa':
      return exa;
    case 'searxng':
      return searxng;
    default:
      return mock;
  }
}
