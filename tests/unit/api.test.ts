import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { MeterService } from '../../src/modules/meters/meter.service';
import { PaginatedMetersResponse } from '../../src/modules/meters/meter.types';
import { createMeterRouter } from '../../src/modules/meters/meter.routes';
import { MeterController } from '../../src/modules/meters/meter.controller';
import express from 'express';
import { errorHandler } from '../../src/middleware/error.middleware';

describe('Public API Endpoints', () => {
  it('GET /health returns healthy status', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/v1/meters returns normalized paginated list', async () => {
    const mockMetersResponse: PaginatedMetersResponse = {
      data: [
        {
          id: 'MTR-EXAMPLE-001',
          serialNumber: 'SN-EXAMPLE-001',
          make: 'HPL',
          phaseType: 'single',
          installationStatus: 'Decommissioned',
          transformerCode: 'DT-EXAMPLE-01'
        }
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 403,
        totalPages: 21,
        hasNext: true,
        hasPrev: false
      }
    };

    const mockService = {
      getMeters: vi.fn().mockResolvedValue(mockMetersResponse)
    } as unknown as MeterService;

    const controller = new MeterController(mockService);
    const router = createMeterRouter(controller);

    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/v1/meters', router);
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/meters?q=MTR&page=1');

    expect(res.status).toBe(200);
    expect(mockService.getMeters).toHaveBeenCalledWith('MTR', 1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('MTR-EXAMPLE-001');
    expect(res.body.pagination.total).toBe(403);
  });

  it('GET /api/v1/meters/:meterId returns individual meter details with location', async () => {
    const mockDetail = {
      id: 'MTR-EXAMPLE-001',
      serialNumber: 'SN-EXAMPLE-001',
      make: 'HPL',
      phaseType: 'single',
      installationStatus: 'Decommissioned',
      transformerCode: 'DT-EXAMPLE-01',
      location: {
        latitude: 0.000000,
        longitude: 0.000000
      }
    };

    const mockService = {
      getMeterById: vi.fn().mockResolvedValue(mockDetail)
    } as unknown as MeterService;

    const controller = new MeterController(mockService);
    const router = createMeterRouter(controller);

    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/v1/meters', router);
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/meters/MTR-EXAMPLE-001');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('MTR-EXAMPLE-001');
    expect(res.body.data.location.latitude).toBe(0.000000);
  });

  it('GET /api/v1/meters/:meterId/consumption returns telemetry history', async () => {
    const mockConsumption = {
      data: {
        meterId: 'MTR-EXAMPLE-001',
        readings: [
          {
            sourceTimestamp: '25/10/2024 00:00',
            timestampLocal: '2024-10-25T00:00:00',
            cumulativeActiveEnergyKwh: 1000.00,
            cumulativeApparentEnergyKvah: 1100.00,
            voltageR: 230
          }
        ]
      },
      meta: {
        readingCount: 1,
        timestampSemantics: 'LOCAL_TIMEZONE_UNCONFIRMED',
        units: {
          cumulativeActiveEnergy: 'kWh',
          cumulativeApparentEnergy: 'kVAh',
          voltage: 'V'
        },
        latestReadingTimestampLocal: '2024-10-25T00:00:00'
      }
    };

    const mockConsumptionService = {
      getConsumption: vi.fn().mockResolvedValue(mockConsumption)
    };

    const controller = new MeterController(
      undefined,
      mockConsumptionService as any
    );
    const router = createMeterRouter(controller);

    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/v1/meters', router);
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/meters/MTR-EXAMPLE-001/consumption');

    expect(res.status).toBe(200);
    expect(res.body.data.readings).toHaveLength(1);
    expect(res.body.meta.units.cumulativeActiveEnergy).toBe('kWh');
  });

  it('GET /api/v1/meters/:meterId/hierarchy returns 7-level network placement', async () => {
    const mockHierarchy = {
      data: {
        meterId: 'MTR-EXAMPLE-001',
        zone: { name: 'Zone A', code: 'Z-01' },
        circle: { name: 'Circle 1', code: 'C-01' },
        division: { name: 'Division 1', code: 'D-01' },
        subdivision: { name: 'Subdivision 1', code: 'SD-01' },
        substation: { name: 'Substation 1', code: 'SS-01' },
        feeder: { name: 'Feeder 1', code: 'F-001' },
        transformer: { name: 'Distribution Transformer 1', code: 'DT-EXAMPLE-01' }
      },
      meta: {
        hierarchyDepth: 8,
        source: 'portal-network-export'
      }
    };

    const mockHierarchyService = {
      getMeterHierarchy: vi.fn().mockResolvedValue(mockHierarchy)
    };

    const controller = new MeterController(
      undefined,
      undefined,
      mockHierarchyService as any
    );
    const router = createMeterRouter(controller);

    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/v1/meters', router);
    testApp.use(errorHandler);

    const res = await request(testApp).get('/api/v1/meters/MTR-EXAMPLE-001/hierarchy');

    expect(res.status).toBe(200);
    expect(res.body.data.zone.name).toBe('Zone A');
    expect(res.body.data.transformer.code).toBe('DT-EXAMPLE-01');
    expect(res.body.meta.hierarchyDepth).toBe(8);
  });

  it('GET /api/v1/meters returns 400 on invalid page parameter with RFC 7807 problem details', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/meters?page=-5');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.type).toBe('urn:urja:error:validation_error');
    expect(res.body.status).toBe(400);
    expect(res.body.instance).toBe('/api/v1/meters?page=-5');
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for non-existent route', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/non-existent-route');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
