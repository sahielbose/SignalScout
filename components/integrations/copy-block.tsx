'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative">
      {label && <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
        className={cn(
          'absolute right-2 z-10 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[0.7rem] font-medium shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          copied ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-background text-muted-foreground hover:text-foreground',
        )}
        style={{ top: label ? '1.7rem' : '0.5rem' }}
      >
        {copied ? <Check className="size-3 animate-pop" /> : <Copy className="size-3" />}
        <span key={copied ? 'copied' : 'copy'} className="animate-fade-in">{copied ? 'Copied' : 'Copy'}</span>
      </button>
      <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 pr-16 font-mono text-xs leading-relaxed">{code}</pre>
    </div>
  );
}
