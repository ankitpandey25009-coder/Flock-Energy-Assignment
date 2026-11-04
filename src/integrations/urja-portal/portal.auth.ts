import { CookieJar } from 'tough-cookie';
import { env } from '../../config/env';
import { UpstreamAuthenticationError } from '../../shared/errors';

export class PortalAuthManager {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly cookieJar: CookieJar;
  private inFlightLogin: Promise<void> | null = null;
  private isAuthenticated = false;

  constructor(
    baseUrl = env.PORTAL_BASE_URL,
    username = env.PORTAL_USERNAME,
    password = env.PORTAL_PASSWORD,
    cookieJar = new CookieJar()
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.username = username;
    this.password = password;
    this.cookieJar = cookieJar;
  }

  /**
   * Ensures an authenticated session exists.
   * If not authenticated, triggers login.
   * Concurrent callers share the single in-flight login promise.
   */
  public async ensureAuthenticated(): Promise<string> {
    if (this.isAuthenticated) {
      const cookieString = await this.getCookieHeader();
      if (cookieString) {
        return cookieString;
      }
      this.isAuthenticated = false;
    }

    if (!this.inFlightLogin) {
      this.inFlightLogin = this.performLogin().finally(() => {
        this.inFlightLogin = null;
      });
    }

    await this.inFlightLogin;
    const cookieString = await this.getCookieHeader();
    if (!cookieString) {
      throw new UpstreamAuthenticationError('Authentication succeeded but session cookie was missing');
    }

    return cookieString;
  }

  /**
   * Invalidates current session state, forcing re-authentication on next request.
   */
  public invalidateSession(): void {
    this.isAuthenticated = false;
    this.cookieJar.removeAllCookiesSync();
  }

  /**
   * Returns current Cookie header string for the portal domain.
   */
  public async getCookieHeader(): Promise<string> {
    return this.cookieJar.getCookieString(this.baseUrl);
  }

  /**
   * Executes the 2-step portal login sequence observed during reverse engineering.
   */
  private async performLogin(): Promise<void> {
    const loginUrl = `${this.baseUrl}/login`;

    try {
      // Step 1: Initial GET to establish initial session/CSRF state
      const initialRes = await fetch(loginUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'UrjaMeterOps-IntegrationService/1.0'
        },
        signal: AbortSignal.timeout(env.REQUEST_TIMEOUT_MS)
      });

      await this.saveCookiesFromResponse(initialRes);

      // Step 2: Submit credentials with verified Origin and Referer headers
      const body = new URLSearchParams({
        email: this.username,
        password: this.password
      });

      const existingCookies = await this.cookieJar.getCookieString(loginUrl);

      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': this.baseUrl,
          'Referer': loginUrl,
          'User-Agent': 'UrjaMeterOps-IntegrationService/1.0',
          ...(existingCookies ? { Cookie: existingCookies } : {})
        },
        body: body.toString(),
        redirect: 'manual',
        signal: AbortSignal.timeout(env.REQUEST_TIMEOUT_MS)
      });

      await this.saveCookiesFromResponse(loginRes);

      if (loginRes.status !== 200) {
        throw new UpstreamAuthenticationError(
          `Upstream portal rejected credentials with status ${loginRes.status}`
        );
      }

      // Check response JSON structure: SvelteKit form action returns { type: "redirect", status: 303, location: "/meters" }
      const data = (await loginRes.json().catch(() => null)) as { type?: string; status?: number; location?: string } | null;
      const isSuccess = data && (data.type === 'redirect' || data.type === 'success' || (typeof data.status === 'number' && data.status < 400));
      if (!isSuccess) {
        throw new UpstreamAuthenticationError('Upstream portal login response did not indicate success');
      }

      const cookies = await this.cookieJar.getCookies(this.baseUrl);
      const sessionCookie = cookies.find((c) => c.key.includes('session_token'));

      if (!sessionCookie) {
        throw new UpstreamAuthenticationError('Upstream login succeeded but session cookie was not set');
      }

      this.isAuthenticated = true;
    } catch (err: unknown) {
      this.isAuthenticated = false;
      if (err instanceof UpstreamAuthenticationError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Unknown network error';
      throw new UpstreamAuthenticationError(`Authentication handshake failed: ${message}`, err);
    }
  }

  private async saveCookiesFromResponse(res: Response): Promise<void> {
    // Collect all set-cookie headers
    // In Node fetch, getSetCookie() returns all individual Set-Cookie strings
    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []);

    for (const cookieStr of setCookies) {
      await this.cookieJar.setCookie(cookieStr, this.baseUrl);
    }
  }
}
