import { PrismaClient } from '@prisma/client';

// =============================================================================
// Prisma Client Singleton
//
// In development, using a module-level singleton prevents Next.js hot-reloading
// from creating a new connection pool on every reload.
// In production, we just create one instance.
// =============================================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

// Re-export Prisma types for convenience
export type { Prisma } from '@prisma/client';
