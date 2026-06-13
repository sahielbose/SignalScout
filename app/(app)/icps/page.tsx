import { requireOrgId } from '@/lib/auth/session';
import { listIcps } from '@/lib/icp/service';
import { PageHeader } from '@/components/app/page-header';
import { IcpManager, type IcpView } from '@/components/icp/icp-manager';

export const metadata = { title: 'ICPs - Signal Scout' };
export const dynamic = 'force-dynamic';

export default async function IcpsPage() {
  const orgId = await requireOrgId();
  const rows = await listIcps(orgId);
  const icps: IcpView[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    active: r.active,
    definition: r.definition,
  }));

  return (
    <>
      <PageHeader
        title="Ideal Customer Profiles"
        description="Describe who you sell to. The feed filters public signals to these profiles, and the worker only deep-researches people who match."
      />
      <IcpManager icps={icps} />
    </>
  );
}
