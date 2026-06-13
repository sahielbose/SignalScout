import { env, hasCrm } from '@/lib/env';
import { httpJson } from '@/lib/adapters/http';

/**
 * CRM push behind a provider interface. Off by default. With no key configured,
 * getCrmProvider() returns a safe no-op that reports "skipped" so nothing breaks.
 * CRM push is always a gated, audited action (never automatic).
 */
export interface CrmContact {
  fullName: string;
  email?: string;
  title?: string;
  company?: string;
  linkedinUrl?: string;
  githubLogin?: string;
  source?: string;
}

export interface CrmPushResult {
  ok: boolean;
  provider: string;
  externalId?: string;
  skipped?: boolean;
  error?: string;
}

export interface CrmProvider {
  name: string;
  enabled: boolean;
  pushContact(contact: CrmContact): Promise<CrmPushResult>;
}

const noopProvider: CrmProvider = {
  name: 'none',
  enabled: false,
  async pushContact() {
    return {
      ok: false,
      provider: 'none',
      skipped: true,
      error: 'No CRM configured. Set ENABLE_CRM and a provider key to enable push.',
    };
  },
};

const hubspot: CrmProvider = {
  name: 'hubspot',
  enabled: true,
  async pushContact(contact) {
    try {
      const [firstname, ...rest] = contact.fullName.split(' ');
      const data = await httpJson<{ id?: string }>('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env().HUBSPOT_API_KEY ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: {
            firstname,
            lastname: rest.join(' '),
            email: contact.email,
            jobtitle: contact.title,
            company: contact.company,
            website: contact.linkedinUrl,
          },
        }),
      });
      return { ok: true, provider: 'hubspot', externalId: data.id };
    } catch (err) {
      return { ok: false, provider: 'hubspot', error: (err as Error).message };
    }
  },
};

const salesforce: CrmProvider = {
  name: 'salesforce',
  enabled: true,
  async pushContact(contact) {
    try {
      const [firstName, ...rest] = contact.fullName.split(' ');
      const data = await httpJson<{ id?: string }>(
        `${env().SALESFORCE_INSTANCE_URL}/services/data/v59.0/sobjects/Lead`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env().SALESFORCE_ACCESS_TOKEN ?? ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            FirstName: firstName,
            LastName: rest.join(' ') || firstName,
            Title: contact.title,
            Company: contact.company ?? 'Unknown',
            Email: contact.email,
          }),
        },
      );
      return { ok: true, provider: 'salesforce', externalId: data.id };
    } catch (err) {
      return { ok: false, provider: 'salesforce', error: (err as Error).message };
    }
  },
};

export function getCrmProvider(): CrmProvider {
  if (!hasCrm()) return noopProvider;
  const p = env().CRM_PROVIDER;
  if (p === 'hubspot') return hubspot;
  if (p === 'salesforce') return salesforce;
  return noopProvider;
}
