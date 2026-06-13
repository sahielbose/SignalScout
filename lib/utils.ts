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

/**
 * Flatten source text (often markdown changelogs or GitHub release notes) into a
 * clean one-line plain-text snippet for cards. Strips headings, list bullets,
 * emphasis, code fences/backticks, link/image syntax, and stray HTML, then
 * collapses whitespace. Display-only; never mutate stored data with this.
 */
export function plainText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> label
    .replace(/<!--[\s\S]*?-->/g, ' ') // html comments
    .replace(/<[^>]+>/g, ' ') // stray html tags
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s*[-*+]\s+/gm, '') // bullet markers
    .replace(/^\s*\d+\.\s+/gm, '') // numbered list markers
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italic
    .replace(/~~(.*?)~~/g, '$1') // strikethrough
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}
