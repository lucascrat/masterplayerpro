import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const creds = await prisma.iptvCredential.findMany({
    include: { 
      leases: true,
      playlist: true
    }
  });
  console.log(JSON.stringify(creds, null, 2));
}

main().finally(() => {
  prisma.$disconnect();
  pool.end();
});
