import { LegalShell } from '@/components/legal/legal-shell';

export const metadata = { title: 'Terms — Signal Scout' };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="June 2026">
      <p>By using Signal Scout you agree to these terms. The software is provided under the MIT license, as-is, without warranty.</p>

      <h2>Acceptable use</h2>
      <p>
        Use Signal Scout for legitimate B2B sales and research. Do not use it to harass individuals, to make automated
        decisions with legal or similarly significant effects about people, or in violation of any source&apos;s terms or
        applicable law. Respect rate limits and the public/free-source-only posture of the project.
      </p>

      <h2>Data accuracy</h2>
      <p>
        Dossiers are generated from public sources and may be incomplete or wrong; low-confidence results are flagged and
        uncited claims are dropped. You are responsible for verifying information before acting on it. Do not treat a
        dossier as a background check or a consumer report (it is not FCRA-compliant).
      </p>

      <h2>Quotas &amp; cost</h2>
      <p>
        The hosted free tier is rate-limited and quota-capped. Bring your own LLM/search keys to exceed the shared tier;
        you are responsible for spend incurred on your own keys.
      </p>

      <h2>Liability</h2>
      <p>
        To the maximum extent permitted by law, the authors and operators are not liable for any damages arising from use
        of the software or data produced by it.
      </p>
    </LegalShell>
  );
}
