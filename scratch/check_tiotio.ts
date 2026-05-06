import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.appUser.findMany();
  console.log('Users:', users.map(u => u.username));
  
  const credentials = await prisma.iptvCredential.findMany({ include: { playlist: true } });
  console.log('Credentials:', credentials.map(c => ({ user: c.username, playlist: c.playlist.url })));
}

main().finally(() => {
  prisma.$disconnect();
  pool.end();
});
