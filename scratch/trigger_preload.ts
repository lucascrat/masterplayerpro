import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // We can't easily trigger the running server's memory map from here 
  // UNLESS we use a signal or an IPC, but the server has a debug endpoint!
  // Oh wait, the server is NOT running.
  
  console.log('Server is not running. Preload will happen on next start.');
}

main().finally(() => {
  prisma.$disconnect();
  pool.end();
});
