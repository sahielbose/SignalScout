import type { SourceName } from '@/lib/types';
import type { Adapter } from './types';
import { secAdapter } from './sec';
import { greenhouseAdapter } from './greenhouse';
import { leverAdapter } from './lever';
import { ashbyAdapter } from './ashby';
import { githubAdapter } from './github';
import { webDiffAdapter } from './web-diff';
import { lumaAdapter } from './luma';

export const adapters: Record<SourceName, Adapter> = {
  sec: secAdapter,
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  ashby: ashbyAdapter,
  github: githubAdapter,
  web: webDiffAdapter,
  luma: lumaAdapter,
};

export function getAdapter(source: string): Adapter {
  const a = adapters[source as SourceName];
  if (!a) throw new Error(`unknown source "${source}"`);
  return a;
}

export const ALL_SOURCES = Object.keys(adapters) as SourceName[];

export * from './types';
