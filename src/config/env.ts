import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  PORTAL_BASE_URL: z.string().url().default('https://urja-ops.flockenergy.tech'),
  PORTAL_USERNAME: isTest
    ? z.string().default('test_user')
    : z.string().min(1, 'PORTAL_USERNAME is required'),
  PORTAL_PASSWORD: isTest
    ? z.string().default('test_password')
    : z.string().min(1, 'PORTAL_PASSWORD is required'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
  throw new Error(`Environment configuration validation failed: ${issues}`);
}

export const env = parsed.data;
