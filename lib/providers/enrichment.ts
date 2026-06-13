import { env, hasEnrichment } from '@/lib/env';
import { httpJson } from '@/lib/adapters/http';

/**
 * Optional paid contact enrichment behind a provider interface. Off by default
 * (ENABLE_PAID_ENRICHMENT=false). With no key, getEnrichmentProvider() returns a
 * no-op that yields null, so the app never depends on a paid vendor.
 */
export interface EnrichmentInput {
  fullName: string;
  company?: string;
  linkedinUrl?: string;
  githubLogin?: string;
  email?: string;
}

export interface EnrichmentResult {
  email?: string;
  title?: string;
  location?: string;
  linkedinUrl?: string;
  seniority?: string;
  source: string;
}

export interface EnrichmentProvider {
  name: string;
  enabled: boolean;
  enrich(input: EnrichmentInput): Promise<EnrichmentResult | null>;
}

const noopProvider: EnrichmentProvider = {
  name: 'none',
  enabled: false,
  async enrich() {
    return null;
  },
};

const apollo: EnrichmentProvider = {
  name: 'apollo',
  enabled: true,
  async enrich(input) {
    try {
      const data = await httpJson<{
        person?: { email?: string; title?: string; city?: string; linkedin_url?: string; seniority?: string };
      }>('https://api.apollo.io/v1/people/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': env().APOLLO_API_KEY ?? '' },
        body: JSON.stringify({
          name: input.fullName,
          organization_name: input.company,
          linkedin_url: input.linkedinUrl,
        }),
      });
      const p = data.person;
      if (!p) return null;
      return {
        email: p.email,
        title: p.title,
        location: p.city,
        linkedinUrl: p.linkedin_url,
        seniority: p.seniority,
        source: 'apollo',
      };
    } catch {
      return null;
    }
  },
};

export function getEnrichmentProvider(): EnrichmentProvider {
  if (!hasEnrichment()) return noopProvider;
  if (env().APOLLO_API_KEY) return apollo;
  // A People Data Labs provider can be added here with the same shape.
  return noopProvider;
}
