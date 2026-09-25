/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { z } from "zod";

expand(config({
  path: path.resolve(
    process.cwd(),
    process.env.NODE_ENV === "test" ? ".env.test" : ".env",
  ),
}));

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  DATABASE_URL: z.string().url(),
  BLASTA_USERNAME: z.string().min(1),
  BLASTA_PASSWORD: z.string().min(1),
  BLASTA_BASE_URL: z.string().url().default("https://sms.dmarkmobile.com/v3/api"),
});

export type env = z.infer<typeof EnvSchema>;

/** Mock handlers only under NODE_ENV=test; dev and prod always call the real Blasta API. */
export const isMockMode = (): boolean => process.env.NODE_ENV === "test";

// eslint-disable-next-line ts/no-redeclare
const { data: env, error } = EnvSchema.safeParse(process.env);

if (error) {
  console.error("❌ Invalid env:");
  console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export default env!;
