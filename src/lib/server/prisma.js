/**
 * src/lib/server/prisma.js
 *
 * Cliente Prisma inicializado con la DATABASE_URL leída a través de
 * $env/static/private de SvelteKit (no process.env, que en el contexto
 * SSR de Vite no tiene las variables del .env disponibles).
 *
 * Al estar en src/lib/SERVER/, SvelteKit garantiza que este módulo
 * solo se importa en código de servidor — nunca en el cliente.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { DATABASE_URL } from '$env/static/private';

const globalForPrisma = globalThis;

function createPrismaClient() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: ['error'],
  });
}

export const prisma = globalForPrisma.__prisma ?? createPrismaClient();

if (!globalForPrisma.__prisma) {
  globalForPrisma.__prisma = prisma;
}
