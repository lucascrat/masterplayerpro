import pg from 'pg';
// @ts-expect-error - PrismaClient is generated at build time by `prisma generate`
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });

pool.query('SELECT 1')
  .then(() => console.log('DB connected!'))
  .catch((e: Error) => console.error('DB connection failed:', e.message));

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
