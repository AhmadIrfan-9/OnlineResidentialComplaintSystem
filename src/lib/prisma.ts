import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;
const isDbDisabled = process.env.SKIP_DB === "true" || !connectionString;

const buildPoolConfig = (rawConnectionString: string) => {
  const parsed = new URL(rawConnectionString);
  const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();

  // Avoid pg's sslmode alias warning by managing TLS explicitly in code.
  parsed.searchParams.delete("sslmode");

  const allowSelfSigned =
    process.env.DATABASE_TLS_ALLOW_SELF_SIGNED === "true" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.DATABASE_TLS_ALLOW_SELF_SIGNED !== "false");

  const sslDisabled =
    sslMode === "disable" || process.env.DATABASE_SSL_MODE?.toLowerCase() === "disable";

  return {
    connectionString: parsed.toString(),
    ssl: sslDisabled ? false : { rejectUnauthorized: !allowSelfSigned },
  };
};

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
