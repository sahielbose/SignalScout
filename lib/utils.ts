import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Relative time like "3h ago", "2d ago". */
export function relativeTime(input: Date | string | number | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'object' ? input : new Date(input);
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (Number.isNaN(secs)) return '';
  const abs = Math.abs(secs);
  const units: [number, string][] = [
    [60, 's'],
    [3600, 'm'],
    [86400, 'h'],
    [604800, 'd'],
    [2629800, 'w'],
    [31557600, 'mo'],
    [Infinity, 'y'],
  ];
  const divisors = [1, 60, 3600, 86400, 604800, 2629800, 31557600];
  for (let i = 0; i < units.length; i++) {
    if (abs < units[i]![0]) {
      const v = Math.max(1, Math.floor(abs / divisors[i]!));
      return secs >= 0 ? `${v}${units[i]![1]} ago` : `in ${v}${units[i]![1]}`;
    }
  }
  return '';
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

/** House style: no em or en dashes in displayed prose. Replace with a hyphen. */
export function stripDashes(s: string): string {
  // U+2014 em dash and U+2013 en dash become a plain hyphen.
  return s.replace(/[\u2014\u2013]/g, '-');
}
