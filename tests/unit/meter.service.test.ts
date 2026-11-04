import { describe, it, expect, vi } from 'vitest';
import { MeterService } from '../../src/modules/meters/meter.service';
import { PortalClient } from '../../src/integrations/urja-portal/portal.client';
import { PortalMeterSearchResponse } from '../../src/integrations/urja-portal/portal.types';

describe('MeterService', () => {
  it('calls portalClient.searchMeters and returns normalized paginated domain structure', async () => {
    const rawSearchResponse: PortalMeterSearchResponse = {
      data: [
        {
          meterId: 'MTR-EXAMPLE-001',
          serialNo: 'SN-EXAMPLE-001',
          make: 'HPL',
          phaseType: 'single',
          installStatus: 'Decommissioned',
          dtCode: 'DT-EXAMPLE-01'
        },
        {
          meterId: 'MTR-EXAMPLE-002',
          serialNo: 'SN-EXAMPLE-002',
          make: 'L&T',
          phaseType: 'single',
          installStatus: 'Installed',
          dtCode: 'DT-EXAMPLE-02'
        }
      ],
      total: 403,
      page: 1,
      pageSize: 20
    };

    const mockClient = {
      searchMeters: vi.fn().mockResolvedValue(rawSearchResponse)
    } as unknown as PortalClient;

    const service = new MeterService(mockClient);
    const result = await service.getMeters('MTR', 1);

    expect(mockClient.searchMeters).toHaveBeenCalledWith('MTR', 1);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      id: 'MTR-EXAMPLE-001',
      serialNumber: 'SN-EXAMPLE-001',
      make: 'HPL',
      phaseType: 'single',
      installationStatus: 'Decommissioned',
      transformerCode: 'DT-EXAMPLE-01'
    });
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 403,
      totalPages: 21,
      hasNext: true,
      hasPrev: false
    });
  });

  it('propagates upstream errors thrown by portal client', async () => {
    const mockClient = {
      searchMeters: vi.fn().mockRejectedValue(new Error('Network failure'))
    } as unknown as PortalClient;

    const service = new MeterService(mockClient);
    await expect(service.getMeters('', 1)).rejects.toThrow('Network failure');
  });
});
