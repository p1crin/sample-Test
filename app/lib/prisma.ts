import { PrismaClient } from '@/generated/prisma/client';

// グローバル変数での Prisma クライアント保持（開発環境での Hot Reload 対応）
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({} as any);

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
