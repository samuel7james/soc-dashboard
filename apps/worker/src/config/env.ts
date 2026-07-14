import { z } from "zod";

try {
  process.loadEnvFile();
} catch {
  // no .env file found — fall through to process.env as-is
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  SYSLOG_UDP_PORT: z.coerce.number().int().positive().default(5514),
  SYSLOG_UDP_HOST: z.string().default("0.0.0.0"),
  DEMO_MODE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  HEALTH_PORT: z.coerce.number().int().positive().default(8080),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }

  return parsed.data;
}

export const env = loadEnv();
