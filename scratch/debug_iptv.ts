import axios from 'axios';

async function main() {
  const url = 'http://girassoldh.top/get.php?username=810902622&password=y536E4731b&type=m3u_plus&output=hls';
  console.log(`Testing URL: ${url}`);
  
  try {
    const res = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    });
    
    console.log(`Status: ${res.status}`);
    console.log(`Content-Type: ${res.headers['content-type']}`);
    console.log('--- PREVIEW (First 500 chars) ---');
    console.log(String(res.data).substring(0, 500));
  } catch (err: any) {
    console.error('Error fetching URL:');
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error(`Data: ${JSON.stringify(err.response.data)}`);
    } else {
      console.error(err.message);
    }
  }
}

main();
