import { describe, it, expect, vi } from 'vitest';
import { ConsumptionService } from '../../src/modules/consumption/consumption.service';
import { PortalClient } from '../../src/integrations/urja-portal/portal.client';
import { PortalMeterEnergyResponse } from '../../src/integrations/urja-portal/portal.types';

describe('ConsumptionService', () => {
  it('normalizes telemetry readings, sorts chronologically, and preserves cumulative energy semantics', async () => {
    const rawEnergyResponse: PortalMeterEnergyResponse = {
      data: [
        {
          timestamp: '24/06/2026 01:00',
          kwh: '48440.00',
          kvah: '52315.00',
          voltR: '235'
        },
        {
          timestamp: '23/06/2026 23:30',
          kwh: '48438.74',
          kvah: '52313.84',
          voltR: '226'
        }
      ]
    };

    const mockClient = {
      getMeterEnergy: vi.fn().mockResolvedValue(rawEnergyResponse)
    } as unknown as PortalClient;

    const service = new ConsumptionService(mockClient);
    const result = await service.getConsumption('MTR-EXAMPLE-001');

    expect(mockClient.getMeterEnergy).toHaveBeenCalledWith('MTR-EXAMPLE-001');
    expect(result.data.meterId).toBe('MTR-EXAMPLE-001');
    expect(result.data.readings).toHaveLength(2);

    // Verify chronological order: 23/06 23:30 should be before 24/06 01:00
    expect(result.data.readings[0].sourceTimestamp).toBe('23/06/2026 23:30');
    expect(result.data.readings[0].timestampLocal).toBe('2026-06-23T23:30:00');
    expect(result.data.readings[0].cumulativeActiveEnergyKwh).toBe(48438.74);
    expect(result.data.readings[0].cumulativeApparentEnergyKvah).toBe(52313.84);
    expect(result.data.readings[0].voltageR).toBe(226);

    expect(result.data.readings[1].sourceTimestamp).toBe('24/06/2026 01:00');
    expect(result.data.readings[1].timestampLocal).toBe('2026-06-24T01:00:00');

    // Verify metadata semantics
    expect(result.meta.readingCount).toBe(2);
    expect(result.meta.timestampSemantics).toBe('LOCAL_TIMEZONE_UNCONFIRMED');
    expect(result.meta.units.cumulativeActiveEnergy).toBe('kWh');
    expect(result.meta.units.cumulativeApparentEnergy).toBe('kVAh');
    expect(result.meta.units.voltage).toBe('V');
    expect(result.meta.latestReadingTimestampLocal).toBe('2026-06-24T01:00:00');
  });

  it('filters out malformed numeric values or invalid calendar dates', async () => {
    const rawEnergyResponse: PortalMeterEnergyResponse = {
      data: [
        {
          timestamp: '31/02/2026 12:00', // Impossible date
          kwh: '100.0',
          kvah: '100.0',
          voltR: '230'
        },
        {
          timestamp: '24/06/2026 12:00',
          kwh: 'invalid_number',
          kvah: '100.0',
          voltR: '230'
        },
        {
          timestamp: '24/06/2026 13:00',
          kwh: '200.5',
          kvah: '210.5',
          voltR: '232'
        }
      ]
    };

    const mockClient = {
      getMeterEnergy: vi.fn().mockResolvedValue(rawEnergyResponse)
    } as unknown as PortalClient;

    const service = new ConsumptionService(mockClient);
    const result = await service.getConsumption('MTR-EXAMPLE-001');

    expect(result.data.readings).toHaveLength(1);
    expect(result.data.readings[0].sourceTimestamp).toBe('24/06/2026 13:00');
    expect(result.data.readings[0].cumulativeActiveEnergyKwh).toBe(200.5);
  });

  it('throws ValidationError when meterId is empty', async () => {
    const service = new ConsumptionService();
    await expect(service.getConsumption('   ')).rejects.toThrow('Meter identifier must not be empty');
  });
});
