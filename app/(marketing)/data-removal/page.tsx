import { LegalShell } from '@/components/legal/legal-shell';
import { RemovalForm } from '@/components/legal/removal-form';

export const metadata = { title: 'Data removal - SignalScout' };

export default function DataRemovalPage() {
  return (
    <LegalShell title="Data removal request" updated="June 2026">
      <p>
        SignalScout stores public professional information to surface B2B buying signals. If you would like your
        information removed, submit a request below. We will verify your identity, delete matching records, and propagate
        the removal to caches.
      </p>
      <div className="not-prose mt-6">
        <RemovalForm />
      </div>
    </LegalShell>
  );
}
