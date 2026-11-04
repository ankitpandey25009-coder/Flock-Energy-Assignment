import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { PortalSigner } from '../../src/integrations/urja-portal/portal.signer';

describe('PortalSigner', () => {
  const method = 'GET';
  const path = '/portal/export';
  const query = 'page=1';
  const secret = 'test-signing-secret-key-xyz';
  const fixedTimestamp = 1793798718;

  it('generates canonical HMAC-SHA256 signature matching expected hex digest', () => {
    const result = PortalSigner.sign(method, path, query, secret, fixedTimestamp);

    expect(result.timestamp).toBe('1793798718');
    expect(result.signature).toMatch(/^[0-9a-f]{64}$/);

    // Verify independently with direct crypto
    const expectedCanonical = `GET\n/portal/export\npage=1\n1793798718`;
    const expectedSig = crypto.createHmac('sha256', secret).update(expectedCanonical).digest('hex');
    expect(result.signature).toBe(expectedSig);
  });

  it('produces different signatures for different timestamps', () => {
    const sig1 = PortalSigner.sign(method, path, query, secret, 1000000000);
    const sig2 = PortalSigner.sign(method, path, query, secret, 1000000001);

    expect(sig1.signature).not.toBe(sig2.signature);
  });

  it('produces different signatures for different query parameters', () => {
    const sig1 = PortalSigner.sign(method, path, 'page=1', secret, fixedTimestamp);
    const sig2 = PortalSigner.sign(method, path, 'page=2', secret, fixedTimestamp);

    expect(sig1.signature).not.toBe(sig2.signature);
  });

  it('produces different signatures for different paths', () => {
    const sig1 = PortalSigner.sign(method, '/portal/export', query, secret, fixedTimestamp);
    const sig2 = PortalSigner.sign(method, '/portal/dts', query, secret, fixedTimestamp);

    expect(sig1.signature).not.toBe(sig2.signature);
  });

  it('normalizes HTTP method to uppercase', () => {
    const lowerResult = PortalSigner.sign('get', path, query, secret, fixedTimestamp);
    const upperResult = PortalSigner.sign('GET', path, query, secret, fixedTimestamp);

    expect(lowerResult.signature).toBe(upperResult.signature);
  });
});
