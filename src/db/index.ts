import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import env from "@/env";
import { fetchWithRetry } from "@/lib/db-fetch";

import * as schema from "./schema";

neonConfig.fetchFunction = fetchWithRetry;

const connection = neon(env.DATABASE_URL);

const db = drizzle(connection, {
  schema,
  casing: "snake_case",
});

export default db;
