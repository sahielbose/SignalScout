import { describe, it, expect } from 'vitest';
import { cn, truncate, relativeTime } from './utils';

describe('cn', () => {
  it('merges and dedupes tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm', false && 'hidden', 'font-medium')).toBe('text-sm font-medium');
  });
});

describe('truncate', () => {
  it('leaves short strings intact', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
  it('adds an ellipsis when over length', () => {
    expect(truncate('hello world', 6)).toBe('hello…');
  });
});

describe('relativeTime', () => {
  it('renders seconds/minutes ago', () => {
    expect(relativeTime(new Date(Date.now() - 5_000))).toMatch(/s ago$/);
    expect(relativeTime(new Date(Date.now() - 120_000))).toBe('2m ago');
  });
  it('handles empty input', () => {
    expect(relativeTime(null)).toBe('');
  });
});
