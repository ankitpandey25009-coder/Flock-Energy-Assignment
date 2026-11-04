import { PortalClient } from '../../integrations/urja-portal/portal.client';
import { PortalAdapter } from '../../integrations/urja-portal/portal.adapter';
import { MeterDetail, PaginatedMetersResponse } from './meter.types';
import { NotFoundError, ValidationError } from '../../shared/errors';

export class MeterService {
  private readonly portalClient: PortalClient;

  constructor(portalClient = new PortalClient()) {
    this.portalClient = portalClient;
  }

  /**
   * Retrieves a paginated list of meters matching query substring, normalized to domain model.
   */
  public async getMeters(query = '', page = 1): Promise<PaginatedMetersResponse> {
    const rawResponse = await this.portalClient.searchMeters(query, page);
    return PortalAdapter.toPaginatedMeters(rawResponse);
  }

  /**
   * Retrieves an individual meter by exact identifier, enriched with geolocation.
   */
  public async getMeterById(meterId: string): Promise<MeterDetail> {
    const trimmedId = meterId.trim();
    if (!trimmedId) {
      throw new ValidationError('Meter identifier must not be empty');
    }

    // Retrieve search record and geo coordinates concurrently
    const [searchResult, geoResult] = await Promise.all([
      this.portalClient.searchMeters(trimmedId, 1),
      this.portalClient.getMeterGeo(trimmedId).catch(() => {
        // If geo is missing or upstream geo service is temporarily unavailable,
        // treat gracefully as null so core meter nameplate data can still be served.
        return null;
      })
    ]);

    // Verify exact match
    const exactMatch = searchResult.data.find(
      (m) => m.meterId.toLowerCase() === trimmedId.toLowerCase()
    );

    if (!exactMatch) {
      throw new NotFoundError(`Meter with ID "${meterId}" not found`);
    }

    return PortalAdapter.toMeterDetail(exactMatch, geoResult);
  }
}
