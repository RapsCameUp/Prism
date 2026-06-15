import { z } from 'zod';
import { config } from 'dotenv';

config();

const booleanString = z.string().transform(val => val === 'true' || val === '1').default('false');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  REDIS_ENABLED: booleanString,
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  GEMINI_API_KEY: z.string().default(''),
  GITHUB_TOKEN: z.string().default(''),
  SPLUNK_MCP_ENDPOINT: z.string().default(''),
  SPLUNK_MCP_TOKEN: z.string().default(''),
  SPLUNK_BASE_URL: z.string().default(''),
  SPLUNK_USERNAME: z.string().default(''),
  SPLUNK_PASSWORD: z.string().default(''),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  // Cisco Deep Time Series Model (CDTSM)
  CDTSM_BASE_URL: z.string().default('http://localhost:8080'),
  CDTSM_AUTH_TOKEN: z.string().default(''),
  // Prediction Scheduler
  PREDICTION_INTERVAL_MINUTES: z.string().default('2'),
  PREDICTION_ENABLED: booleanString,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
