export interface MeterSummary {
  id: string;
  serialNumber: string;
  make: string;
  phaseType: string;
  installationStatus: string;
  transformerCode: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedMetersResponse {
  data: MeterSummary[];
  pagination: PaginationMeta;
}

export interface MeterLocation {
  latitude: number;
  longitude: number;
}

export interface MeterDetail extends MeterSummary {
  location: MeterLocation | null;
}

export interface MeterDetailResponse {
  data: MeterDetail;
}
