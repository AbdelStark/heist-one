import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
try {
  loadEnvFile(resolve(repositoryRoot, ".env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const integerFromString = (fallback: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined ? fallback : Number.parseInt(value, 10)))
    .pipe(z.number().int().min(min).max(max));

const schema = z.object({
  TYPESAFE_API_KEY: z.string().min(1).optional(),
  TYPESAFE_BASE_URL: z.url().optional(),
  HEIST_DECISION_MODE: z.enum(["scripted", "jev"]).default("scripted"),
  HEIST_DECISION_TIMEOUT_MS: integerFromString(1200, 250, 10_000),
  HEIST_LIVE_CALL_LIMIT: integerFromString(120, 1, 10_000),
  HEIST_TRACE_DIR: z.string().default("traces"),
  PORT: integerFromString(8787, 1024, 65_535),
  HOST: z.string().default("127.0.0.1"),
});

const parsed = schema.parse(process.env);

export const config = {
  apiKey: parsed.TYPESAFE_API_KEY,
  baseUrl: parsed.TYPESAFE_BASE_URL,
  defaultMode: parsed.HEIST_DECISION_MODE,
  decisionTimeoutMs: parsed.HEIST_DECISION_TIMEOUT_MS,
  liveCallLimit: parsed.HEIST_LIVE_CALL_LIMIT,
  traceDir: resolve(repositoryRoot, parsed.HEIST_TRACE_DIR),
  port: parsed.PORT,
  host: parsed.HOST,
  liveAvailable: Boolean(parsed.TYPESAFE_API_KEY),
};
