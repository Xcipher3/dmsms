import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import env from "@/env";

import * as schema from "./schema";

const connection = neon(env.DATABASE_URL);

const db = drizzle(connection, {
  schema,
  casing: "snake_case",
});

export default db;
