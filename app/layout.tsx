import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SignalScout, real-time prospect signal intelligence',
  description:
    'Watch free public sources for buying signals about your ideal customers, filter them by ICP, and generate cited research dossiers on people.',
  applicationName: 'SignalScout',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-warm" suppressHydrationWarning>
      <body className={cn(inter.variable, mono.variable, 'font-sans min-h-screen bg-background text-foreground')}>
        {children}
      </body>
    </html>
  );
}
