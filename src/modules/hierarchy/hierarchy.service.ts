import { PortalClient } from '../../integrations/urja-portal/portal.client';
import { PortalAdapter } from '../../integrations/urja-portal/portal.adapter';
import { MeterHierarchy, MeterHierarchyResponse } from './hierarchy.types';
import { NotFoundError, ValidationError } from '../../shared/errors';

export class HierarchyService {
  private readonly portalClient: PortalClient;
  private readonly ttlMs: number;
  private cache: Map<string, MeterHierarchy> | null = null;
  private cacheExpiresAt = 0;
  private inFlightFetch: Promise<Map<string, MeterHierarchy>> | null = null;

  constructor(portalClient = new PortalClient(), ttlMs = 5 * 60 * 1000) {
    this.portalClient = portalClient;
    this.ttlMs = ttlMs;
  }

  /**
   * Retrieves network hierarchy for an individual meter.
   */
  public async getMeterHierarchy(meterId: string): Promise<MeterHierarchyResponse> {
    const trimmedId = meterId.trim();
    if (!trimmedId) {
      throw new ValidationError('Meter identifier must not be empty');
    }

    const index = await this.ensureHierarchyIndex();
    const hierarchy = index.get(trimmedId.toLowerCase());

    if (!hierarchy) {
      throw new NotFoundError(`Network hierarchy not found for meter ID "${meterId}"`);
    }

    // Compute effective hierarchy depth (count non-null chain levels)
    const levels = [
      hierarchy.zone,
      hierarchy.circle,
      hierarchy.division,
      hierarchy.subdivision,
      hierarchy.substation,
      hierarchy.feeder,
      hierarchy.transformer
    ];
    const depth = levels.filter((lvl) => lvl !== null).length + 1; // +1 for the meter itself

    return {
      data: hierarchy,
      meta: {
        hierarchyDepth: depth,
        source: 'portal-network-export'
      }
    };
  }

  /**
   * Invalidates in-memory hierarchy cache.
   */
  public invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  /**
   * Loads or returns cached hierarchy index.
   * Single-flight concurrency coalescing ensures multiple concurrent requests
   * never trigger redundant bulk export downloads.
   */
  private async ensureHierarchyIndex(): Promise<Map<string, MeterHierarchy>> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiresAt) {
      return this.cache;
    }

    if (!this.inFlightFetch) {
      this.inFlightFetch = this.fetchAndIndexHierarchy().finally(() => {
        this.inFlightFetch = null;
      });
    }

    return this.inFlightFetch;
  }

  private async fetchAndIndexHierarchy(): Promise<Map<string, MeterHierarchy>> {
    const exportResponse = await this.portalClient.getExportData(1);
    const index = new Map<string, MeterHierarchy>();

    for (const item of exportResponse.data) {
      const normalized = PortalAdapter.toMeterHierarchy(item);
      index.set(normalized.meterId.toLowerCase(), normalized);
    }

    this.cache = index;
    this.cacheExpiresAt = Date.now() + this.ttlMs;
    return index;
  }
}
