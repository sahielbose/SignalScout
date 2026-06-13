import { Hero } from '@/components/marketing/hero';
import { TrustStrip } from '@/components/marketing/trust-strip';
import { ResearchSection } from '@/components/marketing/research-section';
import { IntegrationsSection } from '@/components/marketing/integrations-section';

export default function Home() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <ResearchSection />
      <IntegrationsSection />
    </>
  );
}
