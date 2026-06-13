'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Scroll-reveal wrapper. Renders visible on the server (no SSR-hidden content),
 * then on the client fades-and-rises into view the first time it intersects.
 * Reduced-motion and no-JS both fall back to fully visible.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setArmed(true);
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hidden = armed && !shown;

  return (
    <div
      ref={ref}
      style={{ transitionDelay: hidden ? '0ms' : `${delay}ms` }}
      className={cn(
        'transition-all duration-700 ease-out',
        hidden ? 'translate-y-3 opacity-0' : 'translate-y-0 opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}
