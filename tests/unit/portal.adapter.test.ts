import { describe, it, expect } from 'vitest';
import { PortalAdapter } from '../../src/integrations/urja-portal/portal.adapter';
import { PortalMeterSearchItem, PortalMeterSearchResponse } from '../../src/integrations/urja-portal/portal.types';

describe('PortalAdapter', () => {
  it('correctly normalizes a raw portal meter item', () => {
    const raw: PortalMeterSearchItem = {
      meterId: '  J100002  ',
      serialNo: 'AL28136',
      make: 'L&T',
      phaseType: 'SINGLE',
      installStatus: 'Installed',
      dtCode: 'DT-003'
    };

    const normalized = PortalAdapter.toMeterSummary(raw);

    expect(normalized).toEqual({
      id: 'J100002',
      serialNumber: 'AL28136',
      make: 'L&T',
      phaseType: 'single',
      installationStatus: 'Installed',
      transformerCode: 'DT-003'
    });
  });

  it('correctly calculates pagination metadata for multiple pages', () => {
    const rawResponse: PortalMeterSearchResponse = {
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
      total: 403,
      page: 1,
      pageSize: 20
    };

    const result = PortalAdapter.toPaginatedMeters(rawResponse);

    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 403,
      totalPages: 21,
      hasNext: true,
      hasPrev: false
    });
  });

  it('handles last page pagination metadata correctly', () => {
    const rawResponse: PortalMeterSearchResponse = {
      data: [],
      total: 403,
      page: 21,
      pageSize: 20
    };

    const result = PortalAdapter.toPaginatedMeters(rawResponse);

    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it('handles empty results gracefully', () => {
    const rawResponse: PortalMeterSearchResponse = {
      data: [],
      total: 0,
      page: 1,
      pageSize: 20
    };

    const result = PortalAdapter.toPaginatedMeters(rawResponse);

    expect(result.data).toEqual([]);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    });
  });
});
