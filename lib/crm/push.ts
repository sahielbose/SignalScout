import { db } from '@/lib/db/client';
import { auditLogs, deliveries } from '@/lib/db/schema';
import { getList, getListMembers } from '@/lib/lists/service';
import { getCrmProvider, type CrmContact } from '@/lib/providers/crm';
import { hasCrm } from '@/lib/env';

/**
 * Stage-2 guardrail: pushing a saved list into a CRM is NEVER automatic.
 * It is always a confirmed, audited action triggered by the user. With no CRM
 * configured the provider is a safe no-op, so every contact comes back "skipped"
 * with a clear message and nothing throws.
 */
export interface CrmPushSummary {
  pushed: number;
  skipped: number;
  failed: number;
  provider: string;
  configured: boolean;
  /** Non-person members (companies) are not pushed; surfaced for transparency. */
  nonPersonSkipped: number;
  message: string;
}

export async function pushListToCrm(orgId: string, listId: string): Promise<CrmPushSummary> {
  const provider = getCrmProvider();
  const configured = hasCrm();

  // Org-scoped load. getList / getListMembers fail closed (return null / []).
  const list = await getList(orgId, listId);
  if (!list) {
    return {
      pushed: 0,
      skipped: 0,
      failed: 0,
      provider: provider.name,
      configured,
      nonPersonSkipped: 0,
      message: 'List not found.',
    };
  }

  const members = await getListMembers(orgId, listId);
  const people = members.filter((m) => m.kind === 'person');
  const nonPersonSkipped = members.length - people.length;

  let pushed = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of people) {
    const contact: CrmContact = {
      fullName: m.name,
      title: m.title ?? undefined,
      company: m.companyName ?? undefined,
      linkedinUrl: m.linkedinUrl ?? undefined,
      githubLogin: m.githubLogin ?? undefined,
      source: 'signal-scout-list',
    };

    let result;
    try {
      result = await provider.pushContact(contact);
    } catch (err) {
      result = { ok: false, provider: provider.name, error: (err as Error).message };
    }

    let status: 'sent' | 'failed' | 'skipped';
    if (result.skipped) {
      status = 'skipped';
      skipped += 1;
    } else if (result.ok) {
      status = 'sent';
      pushed += 1;
    } else {
      status = 'failed';
      failed += 1;
    }

    await db.insert(deliveries).values({
      orgId,
      kind: 'crm',
      target: list.id,
      status,
      detail: {
        listName: list.name,
        personId: m.entityId,
        contactName: m.name,
        provider: result.provider,
        externalId: result.externalId,
        error: result.error,
      },
    });
  }

  const message = !configured
    ? 'No CRM configured. Connect a CRM in your environment to enable push; contacts were skipped.'
    : `Pushed ${pushed} contact${pushed === 1 ? '' : 's'} to ${provider.name}.` +
      (failed ? ` ${failed} failed.` : '') +
      (skipped ? ` ${skipped} skipped.` : '');

  await db.insert(auditLogs).values({
    orgId,
    action: 'crm.push',
    subjectType: 'list',
    subjectId: list.id,
    detail: {
      listName: list.name,
      provider: provider.name,
      configured,
      pushed,
      skipped,
      failed,
      nonPersonSkipped,
      people: people.length,
    },
  });

  return {
    pushed,
    skipped,
    failed,
    provider: provider.name,
    configured,
    nonPersonSkipped,
    message,
  };
}
