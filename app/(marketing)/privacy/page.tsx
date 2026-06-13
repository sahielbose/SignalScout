import Link from 'next/link';
import { LegalShell } from '@/components/legal/legal-shell';

export const metadata = { title: 'Privacy Policy - SignalScout' };

const categoryRows: [string, string, string][] = [
  [
    'Identifiers (email, account id, OAuth id)',
    'Authentication and account management',
    'Not sold. Shared only with hosting and auth subprocessors.',
  ],
  [
    'Usage information (model-run logs, request logs)',
    'Cost accounting and abuse prevention',
    'Not sold or shared for advertising.',
  ],
  [
    'Public professional information about third parties (names, roles, employer, public profiles, public events)',
    'Signal detection and dossier generation',
    'Not sold. Removable on request.',
  ],
  [
    'Inference data (dossier summaries and ICP match scores)',
    'Prospecting',
    'Not sold.',
  ],
];

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 2026">
      <p>
        This Privacy Policy explains how SignalScout (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) handles
        information when you use the SignalScout software and any hosted instance of it (the &quot;Services&quot;).
        SignalScout is an open-source platform that surfaces B2B buying signals from free, public sources and produces
        cited research dossiers. Operators who self-host SignalScout are responsible for their own privacy practices and
        should adapt this template.
      </p>
      <p>
        <strong>In short:</strong> we use free, public sources only. We do not scrape LinkedIn or X. We do not buy or use
        breached data. Paid enrichment is off by default and runs only with credentials you supply.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> your email (required to sign in), optional name and organization, OAuth
          identifiers from social login, and API keys you create (stored only as a hash).
        </li>
        <li>
          <strong>Usage data:</strong> model-run logs for cost accounting, rate-limit counters, and basic request logs
          used to operate and secure the Services.
        </li>
        <li>
          <strong>Subject data:</strong> public professional information about third-party companies and people,
          gathered only from free public sources such as SEC EDGAR, public job boards, GitHub, public web pages, and
          public events.
        </li>
      </ul>
      <p>We do not collect special-category data, payment card data, or government identifiers.</p>

      <h2>2. How we process and use information</h2>
      <ul>
        <li>Authenticate accounts and keep them in working order.</li>
        <li>Run the ICP signal feed and generate cited dossiers.</li>
        <li>Enforce quotas, budget ceilings, and rate limits.</li>
        <li>Secure the Services and prevent abuse.</li>
        <li>Meet legal obligations.</li>
      </ul>
      <p>
        Where GDPR applies, our lawful bases are contract for account data, legitimate interest for B2B prospecting on
        public data, and consent where required.
      </p>

      <h2>3. Sharing and disclosure</h2>
      <p>
        We do not sell personal information. We share information only with the infrastructure providers needed to run a
        given instance, by category: cloud hosting, managed database, the configured language-model provider, the
        configured web-search provider, and transactional email. We may also disclose information where required by law
        or to protect rights and safety. A business transfer, such as a merger, acquisition, or asset sale, may include
        information subject to this policy.
      </p>

      <h2>4. AI products and automated processing</h2>
      <p>
        Dossiers are produced by language models from public sources. Every factual field carries a source link and a
        snippet. Uncited facts are dropped, and low-confidence results are flagged. Output can be incomplete or wrong and
        must be verified before use. We do not make automated decisions that produce legal or similarly significant
        effects about a person. Dossiers are not consumer reports and are not FCRA compliant.
      </p>

      <h2>5. Social logins</h2>
      <p>
        If you sign in with a third-party provider, such as GitHub OAuth or an email magic link, we receive only the
        identifiers that provider returns, such as your email address and account id. We never receive your provider
        password. Your use of that provider is governed by the provider&apos;s own policy.
      </p>

      <h2>6. Data retention</h2>
      <p>
        Account data is kept while your account is active. Dossiers are cached with an expiry and regenerated from
        source. Model-run logs and rate-limit counters are kept for a limited period for cost accounting and abuse
        control. When data is no longer needed, we delete or anonymize it. We honor verified removal requests within the
        statutory window.
      </p>

      <h2>7. Security</h2>
      <p>
        API keys are hashed at rest. Outbound webhooks are HMAC signed. The research fetch tool is SSRF guarded and
        refuses private, loopback, and link-local addresses and non-http schemes. Queries are org-scoped and fail closed
        across tenants. Data in transit is encrypted. No method of transmission or storage is perfectly secure.
      </p>

      <h2>8. Children and minors</h2>
      <p>
        The Services are for business use and are not directed to anyone under 16. We do not knowingly collect data from
        minors. If we learn that we have, we will delete it.
      </p>

      <h2>9. Your rights and choices</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, port, restrict, or object to the
        processing of your personal information, and to withdraw consent. Account holders can exercise these by email.
        People who appear as subjects can use the{' '}
        <Link href="/data-removal">data-removal request form</Link>. You may also lodge a complaint with your local
        supervisory authority.
      </p>

      <h2>10. Do Not Track</h2>
      <p>
        There is no common standard for Do Not Track signals, so we do not respond to them. We keep site tracking
        minimal and use it only to operate and secure the Services.
      </p>

      <h2>11. United States state privacy rights</h2>
      <p>
        If you live in a US state with a comprehensive privacy law (for example California, Colorado, Connecticut, Texas,
        Virginia, and others), you may have rights to know, access, correct, delete, and opt out of the sale or sharing
        of personal information, and a right not to be discriminated against for exercising them. We do not sell personal
        information and do not share it for cross-context behavioral advertising. The categories we handle:
      </p>
      <div className="not-prose my-5 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-left text-[hsl(var(--foreground))]">
              <th className="py-2 pr-3 font-semibold">Category</th>
              <th className="py-2 pr-3 font-semibold">Purpose</th>
              <th className="py-2 font-semibold">Sold or shared</th>
            </tr>
          </thead>
          <tbody className="align-top text-[hsl(var(--muted-foreground))]">
            {categoryRows.map(([cat, purpose, shared]) => (
              <tr key={cat} className="border-b border-border/60">
                <td className="py-2 pr-3">{cat}</td>
                <td className="py-2 pr-3">{purpose}</td>
                <td className="py-2">{shared}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>12. International transfers</h2>
      <p>
        Data may be processed in the country where the operator and its subprocessors run. Where required, transfers rely
        on appropriate safeguards such as standard contractual clauses.
      </p>

      <h2>13. Changes to this policy</h2>
      <p>
        We may update this policy and will revise the &quot;Last updated&quot; date above. Material changes will be noted
        on this page.
      </p>

      <h2>14. Contact, and how to review, update, or delete your information</h2>
      <p>
        Email us at <a href="mailto:privacy@signalscout.dev">privacy@signalscout.dev</a>. By post: SignalScout, Attn:
        Privacy, [street address], [city], [state] [postal code]. Account holders can email to access, correct, or delete
        account data. People who appear as subjects can use the{' '}
        <Link href="/data-removal">data-removal request form</Link> to request removal.
      </p>
    </LegalShell>
  );
}
