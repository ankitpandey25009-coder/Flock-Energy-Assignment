import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CookieJar } from 'tough-cookie';
import { PortalAuthManager } from '../../src/integrations/urja-portal/portal.auth';
import { UpstreamAuthenticationError } from '../../src/shared/errors';

describe('PortalAuthManager', () => {
  const baseUrl = 'https://portal.example.com';
  const username = 'test@example.com';
  const password = 'test-password';
  let cookieJar: CookieJar;
  let authManager: PortalAuthManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    cookieJar = new CookieJar();
    authManager = new PortalAuthManager(baseUrl, username, password, cookieJar);
  });

  it('performs successful 2-step login and stores session cookie', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      callCount++;
      if (callCount === 1) {
        // Step 1: GET /login
        expect(init?.method).toBe('GET');
        return new Response('<html></html>', {
          status: 200,
          headers: {
            'set-cookie': 'initial_token=abc; Path=/'
          }
        });
      }
      if (callCount === 2) {
        // Step 2: POST /login
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          'Origin': baseUrl,
          'Referer': `${baseUrl}/login`
        });
        return new Response(JSON.stringify({ type: 'success', status: 200 }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': '__Secure-better-auth.session_token=test_session_123; Path=/; HttpOnly; Secure'
          }
        });
      }
      throw new Error(`Unexpected call to ${url}`);
    });

    const cookieString = await authManager.ensureAuthenticated();

    expect(cookieString).toContain('__Secure-better-auth.session_token=test_session_123');
    expect(callCount).toBe(2);

    // Second call should reuse cached session without extra fetch
    const cachedCookie = await authManager.ensureAuthenticated();
    expect(cachedCookie).toBe(cookieString);
    expect(callCount).toBe(2);
  });

  it('coalesces concurrent login requests into a single in-flight promise', async () => {
    let postLoginCount = 0;
    global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'GET') {
        return new Response('<html></html>', { status: 200 });
      }
      if (init?.method === 'POST') {
        postLoginCount++;
        // Simulate slight network delay
        await new Promise((r) => setTimeout(r, 20));
        return new Response(JSON.stringify({ type: 'success' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': '__Secure-better-auth.session_token=token_xyz; Path=/; Secure; HttpOnly'
          }
        });
      }
      return new Response('', { status: 400 });
    });

    // 5 concurrent requests arriving simultaneously
    const results = await Promise.all([
      authManager.ensureAuthenticated(),
      authManager.ensureAuthenticated(),
      authManager.ensureAuthenticated(),
      authManager.ensureAuthenticated(),
      authManager.ensureAuthenticated()
    ]);

    expect(results).toHaveLength(5);
    for (const res of results) {
      expect(res).toContain('__Secure-better-auth.session_token=token_xyz');
    }
    // Only 1 POST /login should have been triggered
    expect(postLoginCount).toBe(1);
  });

  it('throws UpstreamAuthenticationError when credentials are rejected', async () => {
    global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'GET') {
        return new Response('<html></html>', { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'invalid credentials' }), {
        status: 401
      });
    });

    await expect(authManager.ensureAuthenticated()).rejects.toThrow(UpstreamAuthenticationError);
  });

  it('clears session when invalidateSession is invoked', async () => {
    await cookieJar.setCookie('__Secure-better-auth.session_token=old_token; Secure', baseUrl);
    expect(await authManager.getCookieHeader()).toContain('session_token');

    authManager.invalidateSession();
    expect(await authManager.getCookieHeader()).toBe('');
  });
});
