import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.appUser.findMany({ select: { username: true } });
  const credentials = await prisma.iptvCredential.findMany();
  const playlists = await prisma.playlist.findMany();

  console.log('Users:', users.map(u => u.username));
  console.log('Credentials Count:', credentials.length);
  console.log('Playlists:', playlists.map(p => p.name));
}

main().finally(() => {
  prisma.$disconnect();
  pool.end();
});
