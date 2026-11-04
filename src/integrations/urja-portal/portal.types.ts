import { z } from 'zod';

export const PortalMeterSearchItemSchema = z.object({
  meterId: z.string().min(1),
  serialNo: z.string().min(1),
  make: z.string(),
  phaseType: z.string(),
  installStatus: z.string(),
  dtCode: z.string()
});

export const PortalMeterSearchResponseSchema = z.object({
  data: z.array(PortalMeterSearchItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive()
});

export const PortalMeterGeoResponseSchema = z.object({
  data: z.object({
    latitude: z.string(),
    longitude: z.string()
  })
});

export const PortalEnergyReadingSchema = z.object({
  timestamp: z.string(),
  kwh: z.string(),
  kvah: z.string(),
  voltR: z.string()
});

export const PortalMeterEnergyResponseSchema = z.object({
  data: z.array(PortalEnergyReadingSchema)
});

export const HierarchyNodeSchema = z.object({
  name: z.string(),
  code: z.string()
});

export const MeterExportItemSchema = z.object({
  meterId: z.string(),
  serialNo: z.string(),
  make: z.string(),
  phaseType: z.string(),
  installStatus: z.string(),
  installType: z.string().optional(),
  build: z.string().optional(),
  dtCode: z.string(),
  hierarchy: z.object({
    zone: HierarchyNodeSchema.nullish(),
    circle: HierarchyNodeSchema.nullish(),
    division: HierarchyNodeSchema.nullish(),
    subdivision: HierarchyNodeSchema.nullish(),
    substation: HierarchyNodeSchema.nullish(),
    feeder: HierarchyNodeSchema.nullish(),
    dt: HierarchyNodeSchema.nullish()
  }).optional(),
  geo: z.object({
    lat: z.number().nullish(),
    lng: z.number().nullish()
  }).optional()
});

export const PortalExportResponseSchema = z.object({
  data: z.array(MeterExportItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional()
});

export type PortalMeterSearchItem = z.infer<typeof PortalMeterSearchItemSchema>;
export type PortalMeterSearchResponse = z.infer<typeof PortalMeterSearchResponseSchema>;
export type PortalMeterGeoResponse = z.infer<typeof PortalMeterGeoResponseSchema>;
export type PortalEnergyReading = z.infer<typeof PortalEnergyReadingSchema>;
export type PortalMeterEnergyResponse = z.infer<typeof PortalMeterEnergyResponseSchema>;
export type HierarchyNode = z.infer<typeof HierarchyNodeSchema>;
export type MeterExportItem = z.infer<typeof MeterExportItemSchema>;
export type PortalExportResponse = z.infer<typeof PortalExportResponseSchema>;
