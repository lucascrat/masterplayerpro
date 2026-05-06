import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.appUser.findMany({
    select: { id: true, username: true, password: true, isActive: true }
  });
  const playlists = await prisma.playlist.findMany();
  const credentials = await prisma.iptvCredential.findMany({
    include: { playlist: { select: { name: true } } }
  });
  
  console.log('--- USERS ---');
  console.table(users);
  console.log('\n--- PLAYLISTS ---');
  console.table(playlists.map(p => ({ id: p.id, name: p.name, url: p.url.substring(0, 50) + '...' })));
  console.log('\n--- CREDENTIALS ---');
  console.table(credentials.map(c => ({ id: c.id, user: c.username, pass: c.password, playlistId: c.playlistId, active: c.isActive })));
}

main().catch(console.error).finally(() => {
  prisma.$disconnect();
  pool.end();
});
