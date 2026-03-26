import pg from 'pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });

pool.query('SELECT 1')
  .then(() => console.log('DB connected!'))
  .catch((e: Error) => console.error('DB connection failed:', e.message));

const adapter = new PrismaPg(pool);
// @ts-ignore - Prisma v7 requires adapter
const prisma = new PrismaClient({ adapter });

export default prisma;
