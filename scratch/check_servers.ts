import 'dotenv/config';
import axios from 'axios';

async function main() {
  try {
    const res = await axios.get('http://localhost:3001/api/debug/servers');
    console.log('--- SERVERS STATUS ---');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error('Failed to get servers status:', err.message);
  }
}

main();
