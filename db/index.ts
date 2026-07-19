import { drizzle } from "drizzle-orm/node-postgres";
import { getDatabase } from "@netlify/database";
import * as schema from "./schema";

type DbType = ReturnType<typeof drizzle<typeof schema>>;

let cached: DbType | null = null;

function getDb(): DbType {
  if (!cached) {
    const { pool } = getDatabase();
    cached = drizzle(pool, { schema });
  }
  return cached;
}

// Lazy proxy: the real Postgres connection is only opened on first actual
// query, so simply importing this module during Next.js build-time page-data
// collection (when no DATABASE_URL is available) does not throw.
export const db: DbType = new Proxy({} as DbType, {
  get(_target, prop, receiver) {
    const real = getDb();
    return Reflect.get(real as object, prop, receiver);
  },
});
