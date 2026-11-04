import {
  MeterExportItem,
  PortalMeterEnergyResponse,
  PortalMeterGeoResponse,
  PortalMeterSearchItem,
  PortalMeterSearchResponse
} from './portal.types';
import {
  MeterDetail,
  MeterLocation,
  MeterSummary,
  PaginatedMetersResponse,
  PaginationMeta
} from '../../modules/meters/meter.types';
import {
  ConsumptionReading,
  ConsumptionResponse
} from '../../modules/consumption/consumption.types';
import {
  HierarchyNodeInfo,
  MeterHierarchy
} from '../../modules/hierarchy/hierarchy.types';
import { parsePortalTimestamp } from '../../shared/utils/date-parser';

export class PortalAdapter {
  /**
   * Normalizes and validates raw coordinate strings into valid MeterLocation or null.
   */
  public static normalizeLocation(
    rawGeo?: PortalMeterGeoResponse['data'] | null
  ): MeterLocation | null {
    if (!rawGeo || !rawGeo.latitude || !rawGeo.longitude) {
      return null;
    }

    const lat = Number.parseFloat(rawGeo.latitude.trim());
    const lng = Number.parseFloat(rawGeo.longitude.trim());

    if (Number.isNaN(lat) || Number.isNaN(lng) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }

    return {
      latitude: lat,
      longitude: lng
    };
  }

  /**
   * Normalizes a single portal meter search item to our clean domain MeterSummary
   */
  public static toMeterSummary(raw: PortalMeterSearchItem): MeterSummary {
    return {
      id: raw.meterId.trim(),
      serialNumber: raw.serialNo.trim(),
      make: raw.make.trim(),
      phaseType: raw.phaseType.trim().toLowerCase(),
      installationStatus: raw.installStatus.trim(),
      transformerCode: raw.dtCode.trim()
    };
  }

  /**
   * Normalizes a meter record combined with its geolocation into MeterDetail
   */
  public static toMeterDetail(
    rawMeter: PortalMeterSearchItem,
    rawGeo?: PortalMeterGeoResponse | null
  ): MeterDetail {
    const summary = this.toMeterSummary(rawMeter);
    const location = this.normalizeLocation(rawGeo?.data);
    return {
      ...summary,
      location
    };
  }

  /**
   * Normalizes raw energy readings into validated, sorted domain consumption history
   */
  public static toConsumptionResponse(
    meterId: string,
    raw: PortalMeterEnergyResponse
  ): ConsumptionResponse {
    const parsedReadings: (ConsumptionReading & { _sortKey: number })[] = [];

    for (const item of raw.data) {
      const kwh = Number.parseFloat(item.kwh.trim());
      const kvah = Number.parseFloat(item.kvah.trim());
      const voltageR = Number.parseInt(item.voltR.trim(), 10);

      // Validate numeric types
      if (Number.isNaN(kwh) || !Number.isFinite(kwh)) {
        continue; // Skip malformed numeric readings rather than inventing zero
      }
      if (Number.isNaN(kvah) || !Number.isFinite(kvah)) {
        continue;
      }
      if (Number.isNaN(voltageR) || !Number.isFinite(voltageR)) {
        continue;
      }

      try {
        const parsedDt = parsePortalTimestamp(item.timestamp);
        parsedReadings.push({
          sourceTimestamp: item.timestamp.trim(),
          timestampLocal: parsedDt.isoLocal,
          cumulativeActiveEnergyKwh: kwh,
          cumulativeApparentEnergyKvah: kvah,
          voltageR: voltageR,
          _sortKey: parsedDt.sortKey
        });
      } catch {
        // Skip readings with impossible/malformed calendar timestamps
        continue;
      }
    }

    // Sort chronologically ascending by timestamp
    parsedReadings.sort((a, b) => a._sortKey - b._sortKey);

    const cleanReadings: ConsumptionReading[] = parsedReadings.map(({ _sortKey, ...reading }) => reading);
    const latestTimestamp = cleanReadings.length > 0 ? cleanReadings[cleanReadings.length - 1].timestampLocal : null;

    return {
      data: {
        meterId: meterId.trim(),
        readings: cleanReadings
      },
      meta: {
        readingCount: cleanReadings.length,
        timestampSemantics: 'LOCAL_TIMEZONE_UNCONFIRMED',
        units: {
          cumulativeActiveEnergy: 'kWh',
          cumulativeApparentEnergy: 'kVAh',
          voltage: 'V'
        },
        latestReadingTimestampLocal: latestTimestamp
      }
    };
  }

  /**
   * Normalizes a paginated portal search response to our domain PaginatedMetersResponse
   */
  public static toPaginatedMeters(raw: PortalMeterSearchResponse): PaginatedMetersResponse {
    const totalPages = Math.ceil(raw.total / raw.pageSize) || 1;
    const pagination: PaginationMeta = {
      page: raw.page,
      pageSize: raw.pageSize,
      total: raw.total,
      totalPages,
      hasNext: raw.page < totalPages,
      hasPrev: raw.page > 1
    };

    return {
      data: raw.data.map(this.toMeterSummary),
      pagination
    };
  }

  /**
   * Normalizes an exported meter record into our clean domain MeterHierarchy
   */
  public static toMeterHierarchy(item: MeterExportItem): MeterHierarchy {
    const rawH = item.hierarchy;

    const toNode = (node?: { name?: string; code?: string } | null): HierarchyNodeInfo | null => {
      if (!node || !node.name || !node.code) return null;
      return {
        name: node.name.trim(),
        code: node.code.trim()
      };
    };

    return {
      meterId: item.meterId.trim(),
      zone: toNode(rawH?.zone),
      circle: toNode(rawH?.circle),
      division: toNode(rawH?.division),
      subdivision: toNode(rawH?.subdivision),
      substation: toNode(rawH?.substation),
      feeder: toNode(rawH?.feeder),
      transformer: toNode(rawH?.dt)
    };
  }
}
