import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;
const isDbDisabled = process.env.SKIP_DB === "true" || !connectionString;

const createDisabledDbClient = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(
          "Database is disabled (set SKIP_DB=false and configure DATABASE_URL)"
        );
      },
    }
  ) as PrismaClient;

export const db =
  globalForPrisma.prisma ??
  (isDbDisabled
    ? createDisabledDbClient()
    : new PrismaClient({
        log: ["query", "info", "warn", "error"],
      }));

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export const prisma = db;
export default db;
