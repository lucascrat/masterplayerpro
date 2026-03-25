import axios from 'axios';

interface M3UItem {
  name: string;
  logo: string;
  group: string;
  url: string;
  type: 'live' | 'movie' | 'series';
}

interface PlaylistData {
  live: M3UItem[];
  movies: M3UItem[];
  series: M3UItem[];
}

export async function parseM3U(url: string): Promise<PlaylistData> {
  console.log(`[Parser] Fetching M3U from: ${url}`);
  const response = await axios.get(url, { timeout: 15000 });
  const content = response.data;
  const lines = content.split('\n');

  const live: M3UItem[] = [];
  const movies: M3UItem[] = [];
  const series: M3UItem[] = [];

  let currentItem: Partial<M3UItem> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      // Extract name
      const nameMatch = line.match(/,(.*)$/);
      currentItem.name = nameMatch ? nameMatch[1].trim() : 'Unknown';

      // Extract logo
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      currentItem.logo = logoMatch ? logoMatch[1] : '';

      // Extract group
      const groupMatch = line.match(/group-title="([^"]*)"/);
      currentItem.group = groupMatch ? groupMatch[1] : 'Default';
    } else if (line.startsWith('http')) {
      currentItem.url = line;

      // Classify
      const name = currentItem.name?.toLowerCase() || '';
      const group = currentItem.group?.toLowerCase() || '';

      if (group.includes('serie') || group.includes('season') || group.includes('episod')) {
        currentItem.type = 'series';
        series.push(currentItem as M3UItem);
      } else if (group.includes('filme') || group.includes('movie') || group.includes('cinema') || group.includes('vod')) {
        currentItem.type = 'movie';
        movies.push(currentItem as M3UItem);
      } else {
        currentItem.type = 'live';
        live.push(currentItem as M3UItem);
      }

      currentItem = {};
    }
  }

  return { live, movies, series };
}
