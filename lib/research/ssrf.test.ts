import { describe, it, expect } from 'vitest';
import { isBlockedAddress, isBlockedHostname, assertSafeUrl, SsrfError } from './ssrf';

describe('isBlockedAddress', () => {
  it('blocks loopback / private / link-local / metadata IPs', () => {
    for (const ip of [
      '127.0.0.1',
      '127.5.5.5',
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '100.64.0.1', // CGNAT
      '0.0.0.0',
      '::1',
      'fe80::1',
      'fc00::1',
      'fd12:3456::1',
      '::ffff:127.0.0.1', // ipv4-mapped loopback
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });
  it('allows public IPs', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '140.82.112.3', '2606:4700:4700::1111']) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });
});

describe('isBlockedHostname', () => {
  it('blocks localhost-ish + internal names', () => {
    for (const h of ['localhost', 'foo.localhost', 'metadata.google.internal', 'svc.internal', 'box.local', '127.0.0.1']) {
      expect(isBlockedHostname(h), h).toBe(true);
    }
  });
  it('allows public hostnames', () => {
    for (const h of ['github.com', 'api.github.com', 'stripe.com']) {
      expect(isBlockedHostname(h), h).toBe(false);
    }
  });
});

describe('assertSafeUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeUrl('ftp://example.com')).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeUrl('gopher://x')).rejects.toBeInstanceOf(SsrfError);
  });
  it('rejects credentials in url', async () => {
    await expect(assertSafeUrl('http://user:pass@example.com')).rejects.toBeInstanceOf(SsrfError);
  });
  it('rejects localhost + metadata endpoints', async () => {
    await expect(assertSafeUrl('http://localhost:8080/admin')).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeUrl('http://169.254.169.254/latest/meta-data/')).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeUrl('http://127.0.0.1/')).rejects.toBeInstanceOf(SsrfError);
  });
  it('accepts a public https url', async () => {
    const u = await assertSafeUrl('https://github.com/torvalds');
    expect(u.hostname).toBe('github.com');
  });
});
