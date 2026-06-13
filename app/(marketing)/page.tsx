import { Hero } from '@/components/marketing/hero';
import { TrustStrip } from '@/components/marketing/trust-strip';
import { ResearchSection } from '@/components/marketing/research-section';
import { IntegrationsSection } from '@/components/marketing/integrations-section';
import { Reveal } from '@/components/ui/reveal';

export default function Home() {
  return (
    <>
      <Hero />
      <Reveal>
        <TrustStrip />
      </Reveal>
      <Reveal>
        <ResearchSection />
      </Reveal>
      <Reveal>
        <IntegrationsSection />
      </Reveal>
    </>
  );
}
