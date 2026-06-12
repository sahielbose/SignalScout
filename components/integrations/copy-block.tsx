'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

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
        onClick={copy}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[0.7rem] text-muted-foreground hover:text-foreground"
        style={{ top: label ? '1.6rem' : '0.5rem' }}
      >
        {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">{code}</pre>
    </div>
  );
}
