import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const playlists = await prisma.playlist.findMany();
  console.log('--- PLAYLISTS ---');
  console.log(JSON.stringify(playlists, null, 2));
}

main().catch(console.error).finally(() => {
  prisma.$disconnect();
  pool.end();
});
