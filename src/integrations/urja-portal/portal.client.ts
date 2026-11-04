import { env } from '../../config/env';
import { PortalAuthManager } from './portal.auth';
import { PortalSigner } from './portal.signer';
import {
  PortalExportResponse,
  PortalExportResponseSchema,
  PortalMeterEnergyResponse,
  PortalMeterEnergyResponseSchema,
  PortalMeterGeoResponse,
  PortalMeterGeoResponseSchema,
  PortalMeterSearchResponse,
  PortalMeterSearchResponseSchema
} from './portal.types';
import {
  NotFoundError,
  UpstreamAuthenticationError,
  UpstreamServiceError,
  UpstreamTimeoutError
} from '../../shared/errors';

export class PortalClient {
  private readonly baseUrl: string;
  private readonly authManager: PortalAuthManager;
  private readonly timeoutMs: number;

  constructor(
    baseUrl = env.PORTAL_BASE_URL,
    authManager = new PortalAuthManager(),
    timeoutMs = env.REQUEST_TIMEOUT_MS
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.authManager = authManager;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Search and paginated meter listing from upstream portal
   */
  public async searchMeters(query = '', page = 1): Promise<PortalMeterSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      page: String(page)
    });

    const path = `/portal/meters/search?${params.toString()}`;
    const rawData = await this.getAuthenticatedJson<unknown>(path);

    const parsed = PortalMeterSearchResponseSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new UpstreamServiceError(
        'Upstream meter search response schema mismatch',
        502,
        parsed.error.format()
      );
    }

    return parsed.data;
  }

  /**
   * Geographic coordinates for a specific meter ID
   */
  public async getMeterGeo(meterId: string): Promise<PortalMeterGeoResponse> {
    const encodedId = encodeURIComponent(meterId.trim());
    const path = `/portal/meters/${encodedId}/geo`;

    try {
      const rawData = await this.getAuthenticatedJson<unknown>(path);
      const parsed = PortalMeterGeoResponseSchema.safeParse(rawData);
      if (!parsed.success) {
        throw new UpstreamServiceError(
          `Upstream meter geo response schema mismatch for meter ${meterId}`,
          502,
          parsed.error.format()
        );
      }
      return parsed.data;
    } catch (err) {
      if (err instanceof UpstreamServiceError && err.statusCode === 404) {
        throw new NotFoundError(`Meter location not found for meter ID ${meterId}`);
      }
      throw err;
    }
  }

  /**
   * Consumption and voltage telemetry for a specific meter ID
   */
  public async getMeterEnergy(meterId: string): Promise<PortalMeterEnergyResponse> {
    const encodedId = encodeURIComponent(meterId.trim());
    const path = `/portal/meters/${encodedId}/energy`;

    try {
      const rawData = await this.getAuthenticatedJson<unknown>(path);
      const parsed = PortalMeterEnergyResponseSchema.safeParse(rawData);
      if (!parsed.success) {
        throw new UpstreamServiceError(
          `Upstream energy response schema mismatch for meter ${meterId}`,
          502,
          parsed.error.format()
        );
      }
      return parsed.data;
    } catch (err) {
      if (err instanceof UpstreamServiceError && err.statusCode === 404) {
        throw new NotFoundError(`Consumption data not found for meter ID ${meterId}`);
      }
      throw err;
    }
  }

  /**
   * Retrieves HMAC signing secret from portal
   */
  public async getSigningKey(): Promise<string> {
    const rawData = await this.getAuthenticatedJson<{ data?: { signingSecret?: string } }>('/portal/keys');
    const secret = rawData?.data?.signingSecret;
    if (!secret || typeof secret !== 'string') {
      throw new UpstreamServiceError('Upstream portal did not return a valid signing key', 502);
    }
    return secret;
  }

  /**
   * Retrieves full export dataset using HMAC-SHA256 signed request
   */
  public async getExportData(page = 1): Promise<PortalExportResponse> {
    const secret = await this.getSigningKey();
    const query = `page=${page}`;
    const { timestamp, signature } = PortalSigner.sign('GET', '/portal/export', query, secret);

    const path = `/portal/export?${query}`;
    const rawData = await this.getAuthenticatedJson<unknown>(path, false, {
      'x-timestamp': timestamp,
      'x-signature': signature
    });

    const parsed = PortalExportResponseSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new UpstreamServiceError('Upstream export response schema mismatch', 502, parsed.error.format());
    }

    return parsed.data;
  }

  /**
   * Generic authenticated GET request with automatic single-retry on session expiration.
   */
  private async getAuthenticatedJson<T>(
    path: string,
    isRetry = false,
    extraHeaders: Record<string, string> = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const cookieHeader = await this.authManager.ensureAuthenticated();

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          'Cookie': cookieHeader,
          'Accept': 'application/json',
          'User-Agent': 'UrjaMeterOps-IntegrationService/1.0',
          ...extraHeaders
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new UpstreamTimeoutError(`Request to ${path} timed out after ${this.timeoutMs}ms`);
      }
      throw new UpstreamServiceError(`Network error while contacting upstream ${path}`, 502, err);
    }

    // Check for session expiry: 401 Unauthorized or any 3xx redirect to /login
    const location = res.headers.get('location') || '';
    const isRedirectToLogin = res.status >= 300 && res.status < 400 && location.includes('/login');
    const isSessionExpired = res.status === 401 || isRedirectToLogin;

    if (isSessionExpired && !isRetry) {
      // Invalidate session and retry once
      this.authManager.invalidateSession();
      return this.getAuthenticatedJson<T>(path, true, extraHeaders);
    }

    if (res.status === 404) {
      throw new UpstreamServiceError(`Resource not found on upstream portal: ${path}`, 404);
    }

    if (!res.ok) {
      throw new UpstreamServiceError(
        `Upstream portal returned HTTP ${res.status} for ${path}`,
        res.status >= 500 ? 502 : res.status
      );
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new UpstreamServiceError(
        `Upstream portal returned non-JSON response (${contentType}) for ${path}`,
        502
      );
    }

    try {
      return (await res.json()) as T;
    } catch (err) {
      throw new UpstreamServiceError(`Failed to parse upstream JSON response from ${path}`, 502, err);
    }
  }
}
