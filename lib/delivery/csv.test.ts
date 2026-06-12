import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('escapes commas, quotes, and newlines per RFC 4180', () => {
    const csv = toCsv(
      ['name', 'note'],
      [
        ['Acme, Inc', 'says "hi"'],
        ['Multi\nline', 'plain'],
        ['safe', null],
      ],
    );
    expect(csv.startsWith('﻿')).toBe(true); // BOM
    const body = csv.slice(1);
    const lines = body.split('\r\n');
    expect(lines[0]).toBe('name,note');
    expect(lines[1]).toBe('"Acme, Inc","says ""hi"""');
    expect(lines[2]).toBe('"Multi\nline",plain');
    expect(lines[3]).toBe('safe,');
  });
});
