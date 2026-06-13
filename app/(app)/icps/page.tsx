import { requireOrgId } from '@/lib/auth/session';
import { listIcps } from '@/lib/icp/service';
import { PageHeader } from '@/components/app/page-header';
import { IcpManager, type IcpView } from '@/components/icp/icp-manager';
import { Reveal } from '@/components/ui/reveal';

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
        title="Who you sell to"
        description="Tell Signal Scout the kind of customer you sell to. We then filter the live feed down to public buying moments that fit, and only build research profiles for people who match."
      />
      <Reveal>
        <IcpManager icps={icps} />
      </Reveal>
    </>
  );
}
