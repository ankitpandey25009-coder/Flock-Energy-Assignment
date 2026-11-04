import { z } from 'zod';

export const GetMetersQuerySchema = z.object({
  q: z.string().trim().default(''),
  page: z.coerce.number().int().positive().default(1)
});

export const MeterIdParamSchema = z.object({
  meterId: z.string().trim().min(1, 'Meter identifier is required')
});

export type GetMetersQuery = z.infer<typeof GetMetersQuerySchema>;
export type MeterIdParam = z.infer<typeof MeterIdParamSchema>;
