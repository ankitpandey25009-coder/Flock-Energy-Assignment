import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HierarchyService } from '../../src/modules/hierarchy/hierarchy.service';
import { PortalClient } from '../../src/integrations/urja-portal/portal.client';
import { PortalExportResponse } from '../../src/integrations/urja-portal/portal.types';
import { NotFoundError } from '../../src/shared/errors';

describe('HierarchyService', () => {
  const mockExportResponse: PortalExportResponse = {
    data: [
      {
        meterId: 'MTR-EXAMPLE-001',
        serialNo: 'SN-EXAMPLE-001',
        make: 'HPL',
        phaseType: 'single',
        installStatus: 'Decommissioned',
        dtCode: 'DT-EXAMPLE-01',
        hierarchy: {
          zone: { name: 'Zone A', code: 'Z-01' },
          circle: { name: 'Circle 1', code: 'C-01' },
          division: { name: 'Division 1', code: 'D-01' },
          subdivision: { name: 'Subdivision 1', code: 'SD-01' },
          substation: { name: 'Substation 1', code: 'SS-01' },
          feeder: { name: 'Feeder 1', code: 'F-001' },
          dt: { name: 'Distribution Transformer 1', code: 'DT-EXAMPLE-01' }
        }
      },
      {
        meterId: 'MTR-EXAMPLE-002',
        serialNo: 'SN-EXAMPLE-002',
        make: 'L&T',
        phaseType: 'single',
        installStatus: 'Installed',
        dtCode: 'DT-EXAMPLE-02',
        hierarchy: {
          zone: { name: 'Zone B', code: 'Z-02' },
          circle: null, // Test partial hierarchy handling
          division: null,
          subdivision: null,
          substation: null,
          feeder: { name: 'Feeder 2', code: 'F-002' },
          dt: { name: 'Distribution Transformer 2', code: 'DT-EXAMPLE-02' }
        }
      }
    ],
    total: 2,
    page: 1,
    pageSize: 20
  };

  it('retrieves full 7-level hierarchy and caches in memory', async () => {
    const mockClient = {
      getExportData: vi.fn().mockResolvedValue(mockExportResponse)
    } as unknown as PortalClient;

    const service = new HierarchyService(mockClient);
    const result = await service.getMeterHierarchy('MTR-EXAMPLE-001');

    expect(mockClient.getExportData).toHaveBeenCalledTimes(1);
    expect(result.data.meterId).toBe('MTR-EXAMPLE-001');
    expect(result.data.zone).toEqual({ name: 'Zone A', code: 'Z-01' });
    expect(result.data.circle).toEqual({ name: 'Circle 1', code: 'C-01' });
    expect(result.data.division).toEqual({ name: 'Division 1', code: 'D-01' });
    expect(result.data.subdivision).toEqual({ name: 'Subdivision 1', code: 'SD-01' });
    expect(result.data.substation).toEqual({ name: 'Substation 1', code: 'SS-01' });
    expect(result.data.feeder).toEqual({ name: 'Feeder 1', code: 'F-001' });
    expect(result.data.transformer).toEqual({ name: 'Distribution Transformer 1', code: 'DT-EXAMPLE-01' });
    expect(result.meta.hierarchyDepth).toBe(8); // 7 parents + 1 meter

    // Second call should hit in-memory cache without calling getExportData again
    const cachedResult = await service.getMeterHierarchy('MTR-EXAMPLE-002');
    expect(mockClient.getExportData).toHaveBeenCalledTimes(1);
    expect(cachedResult.data.meterId).toBe('MTR-EXAMPLE-002');
    expect(cachedResult.data.circle).toBeNull(); // Missing parent represented honestly
    expect(cachedResult.meta.hierarchyDepth).toBe(4); // 3 non-null parents + 1 meter
  });

  it('re-fetches from upstream after cache TTL expires', async () => {
    const mockClient = {
      getExportData: vi.fn().mockResolvedValue(mockExportResponse)
    } as unknown as PortalClient;

    const shortTtlMs = 15;
    const service = new HierarchyService(mockClient, shortTtlMs);

    await service.getMeterHierarchy('MTR-EXAMPLE-001');
    expect(mockClient.getExportData).toHaveBeenCalledTimes(1);

    // Wait past TTL
    await new Promise((r) => setTimeout(r, 25));

    await service.getMeterHierarchy('MTR-EXAMPLE-001');
    expect(mockClient.getExportData).toHaveBeenCalledTimes(2);
  });

  it('throws NotFoundError when meter is not in hierarchy index', async () => {
    const mockClient = {
      getExportData: vi.fn().mockResolvedValue(mockExportResponse)
    } as unknown as PortalClient;

    const service = new HierarchyService(mockClient);
    await expect(service.getMeterHierarchy('MTR-NONEXISTENT')).rejects.toThrow(NotFoundError);
  });
});
