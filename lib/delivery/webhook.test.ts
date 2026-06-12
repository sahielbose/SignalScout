import { describe, it, expect } from 'vitest';
import { signWebhook, verifyWebhook } from './webhook';

describe('webhook HMAC signing', () => {
  const secret = 'whsec_test_123';
  const body = JSON.stringify({ event: 'signal.created', id: 'abc' });

  it('signs and verifies a round-trip', () => {
    const { signature } = signWebhook(secret, body);
    expect(verifyWebhook(secret, body, signature)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const { signature } = signWebhook(secret, body);
    expect(verifyWebhook(secret, body + 'x', signature)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const { signature } = signWebhook(secret, body);
    expect(verifyWebhook('whsec_other', body, signature)).toBe(false);
  });

  it('rejects a stale (replayed) timestamp', () => {
    const old = Date.now() - 10 * 60 * 1000;
    const { signature } = signWebhook(secret, body, old);
    expect(verifyWebhook(secret, body, signature)).toBe(false);
  });

  it('rejects a malformed header', () => {
    expect(verifyWebhook(secret, body, 'garbage')).toBe(false);
    expect(verifyWebhook(secret, body, null)).toBe(false);
  });
});
