import prisma from '../server/db';

async function testConn() {
  try {
    const count = await prisma.playlist.count();
    console.log(`Success! Connection working. Found ${count} playlists in masterplayer schema.`);
    process.exit(0);
  } catch (err: any) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }
}

testConn();
