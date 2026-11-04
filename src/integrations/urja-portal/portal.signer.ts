import crypto from 'node:crypto';

export interface SignatureResult {
  timestamp: string;
  signature: string;
}

export class PortalSigner {
  /**
   * Generates canonical HMAC-SHA256 signature for the Urja portal export endpoint.
   * Canonical string format: `${method}\n${path}\n${query}\n${timestamp}`
   */
  public static sign(
    method: string,
    path: string,
    query: string,
    signingSecret: string,
    nowEpochSeconds = Math.floor(Date.now() / 1000)
  ): SignatureResult {
    const timestamp = String(nowEpochSeconds);
    const canonicalMessage = [method.toUpperCase(), path, query, timestamp].join('\n');

    const hmac = crypto.createHmac('sha256', signingSecret);
    hmac.update(canonicalMessage);
    const signature = hmac.digest('hex');

    return {
      timestamp,
      signature
    };
  }
}
