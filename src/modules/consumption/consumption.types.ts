export interface ConsumptionReading {
  sourceTimestamp: string;
  timestampLocal: string;
  cumulativeActiveEnergyKwh: number;
  cumulativeApparentEnergyKvah: number;
  voltageR: number;
}

export interface ConsumptionResponse {
  data: {
    meterId: string;
    readings: ConsumptionReading[];
  };
  meta: {
    readingCount: number;
    timestampSemantics: 'LOCAL_TIMEZONE_UNCONFIRMED';
    units: {
      cumulativeActiveEnergy: 'kWh';
      cumulativeApparentEnergy: 'kVAh';
      voltage: 'V';
    };
    latestReadingTimestampLocal: string | null;
  };
}
