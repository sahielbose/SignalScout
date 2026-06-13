import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';

export const metadata: Metadata = {
  title: 'SignalScout, real-time prospect signal intelligence',
  description:
    'SignalScout watches free public sources for buying signals about your ideal customers, filters them by ICP, and writes cited research dossiers on the people behind them.',
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-warm min-h-screen w-full font-sans">
      <MarketingNav />
      {children}
      <Footer />
    </div>
  );
}
