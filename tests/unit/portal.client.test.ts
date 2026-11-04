import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortalClient } from '../../src/integrations/urja-portal/portal.client';
import { PortalAuthManager } from '../../src/integrations/urja-portal/portal.auth';
import { UpstreamServiceError, UpstreamTimeoutError } from '../../src/shared/errors';

describe('PortalClient', () => {
  const baseUrl = 'https://portal.example.com';
  let mockAuthManager: PortalAuthManager;
  let client: PortalClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuthManager = {
      ensureAuthenticated: vi.fn().mockResolvedValue('session=test_cookie'),
      invalidateSession: vi.fn()
    } as unknown as PortalAuthManager;
    client = new PortalClient(baseUrl, mockAuthManager, 5000);
  });

  it('searches meters with query parameters and returns parsed response', async () => {
    const rawData = {
      data: [
        {
          meterId: 'MTR-EXAMPLE-001',
          serialNo: 'SN-EXAMPLE-001',
          make: 'HPL',
          phaseType: 'single',
          installStatus: 'Decommissioned',
          dtCode: 'DT-EXAMPLE-01'
        }
      ],
      total: 1,
      page: 1,
      pageSize: 20
    };

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(rawData), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    const result = await client.searchMeters('MTR-EXAMPLE-001', 1);

    expect(mockAuthManager.ensureAuthenticated).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/portal/meters/search?q=MTR-EXAMPLE-001&page=1`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Cookie: 'session=test_cookie',
          Accept: 'application/json'
        })
      })
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].meterId).toBe('MTR-EXAMPLE-001');
  });

  it('handles session expiry: invalidates session and retries once on 401', async () => {
    let callCount = 0;
    const rawData = {
      data: [],
      total: 0,
      page: 1,
      pageSize: 20
    };

    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response('Unauthorized', { status: 401 });
      }
      return new Response(JSON.stringify(rawData), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const result = await client.searchMeters('', 1);

    expect(callCount).toBe(2);
    expect(mockAuthManager.invalidateSession).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(0);
  });

  it('handles session expiry: invalidates session and retries once on 303 redirect to /login', async () => {
    let callCount = 0;
    const rawData = {
      data: [],
      total: 0,
      page: 1,
      pageSize: 20
    };

    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(null, {
          status: 303,
          headers: { location: '/login' }
        });
      }
      return new Response(JSON.stringify(rawData), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const result = await client.searchMeters('', 1);

    expect(callCount).toBe(2);
    expect(mockAuthManager.invalidateSession).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(0);
  });

  it('throws UpstreamServiceError on schema mismatch', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ unexpected: 'format' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    await expect(client.searchMeters('', 1)).rejects.toThrow(UpstreamServiceError);
  });
});
