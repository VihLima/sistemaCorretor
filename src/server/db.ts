import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");
  // Tamanho do pool por instância. Em serverless (Vercel) cada instância abre o seu; mantenha baixo
  // e use o pooler do Supabase (Supavisor, modo transação) na DATABASE_URL.
  const max = Number(process.env.DATABASE_POOL_MAX ?? 5);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: Number.isFinite(max) && max > 0 ? max : 5 }) });
}

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Prisma.TransactionClient;
