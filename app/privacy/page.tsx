import Link from 'next/link';
import { LegalShell } from '@/components/legal/legal-shell';

export const metadata = { title: 'Privacy — Signal Scout' };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 2026">
      <p>
        Signal Scout aggregates <strong>public information</strong> about companies and people from free, openly
        accessible sources (SEC EDGAR, public job boards, GitHub, public web pages, public events) to surface buying
        signals and produce cited research dossiers for B2B sales teams.
      </p>

      <h2>What we process</h2>
      <p>
        <strong>Account data:</strong> your email, name, and organization. <strong>Subject data:</strong> public
        professional information about companies and individuals — names, roles, employer, public profiles (e.g. GitHub),
        and public events tied to them. Every factual claim in a dossier links back to its public source.
      </p>

      <h2>What we do NOT do</h2>
      <p>
        We do not scrape LinkedIn or X/Twitter, do not buy or use breached data, and do not collect special-category
        personal data. Paid person-enrichment is off by default and only ever runs with credentials you supply.
      </p>

      <h2>Legal basis &amp; your rights (GDPR / CCPA)</h2>
      <p>
        Where GDPR applies, processing of subject data relies on legitimate interest in B2B prospecting, balanced against
        the individual&apos;s rights. Data subjects (and California residents under CCPA/CPRA) may request access,
        correction, deletion, or opt-out. We honor verified removal requests and propagate them to caches.
      </p>

      <h2>Data removal</h2>
      <p>
        Anyone can request removal of their information via the{' '}
        <Link href="/data-removal">data-removal request form</Link>. Operators must wire this to their support process
        and respond within the statutory window (30 days GDPR / 45 days CCPA).
      </p>

      <h2>Retention &amp; security</h2>
      <p>
        Dossiers are cached with an expiry and regenerated from source. API keys are hashed at rest; webhooks are
        HMAC-signed. Outbound fetches are SSRF-guarded. We log model usage for cost accounting only.
      </p>
    </LegalShell>
  );
}
