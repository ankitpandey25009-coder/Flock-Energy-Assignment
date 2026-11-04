import { PortalClient } from '../../integrations/urja-portal/portal.client';
import { PortalAdapter } from '../../integrations/urja-portal/portal.adapter';
import { ConsumptionResponse } from './consumption.types';
import { ValidationError } from '../../shared/errors';

export class ConsumptionService {
  private readonly portalClient: PortalClient;

  constructor(portalClient = new PortalClient()) {
    this.portalClient = portalClient;
  }

  /**
   * Retrieves consumption telemetry for a meter and normalizes it.
   */
  public async getConsumption(meterId: string): Promise<ConsumptionResponse> {
    const trimmedId = meterId.trim();
    if (!trimmedId) {
      throw new ValidationError('Meter identifier must not be empty');
    }

    const rawEnergy = await this.portalClient.getMeterEnergy(trimmedId);
    return PortalAdapter.toConsumptionResponse(trimmedId, rawEnergy);
  }
}
