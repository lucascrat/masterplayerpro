import type { M3UItem } from './types';

export function groupByCategory(items: M3UItem[]): Record<string, M3UItem[]> {
  const groups: Record<string, M3UItem[]> = {};
  items.forEach(item => {
    const g = item.group || 'Uncategorized';
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
  });
  return groups;
}

// Extracts show name by stripping S01 E01 (and everything after) from title
// "The Chosen S01 E01" → "The Chosen"
// "Breaking Bad S01E01 - Pilot" → "Breaking Bad"
export function extractShowName(name: string): string {
  return name
    .replace(/\s*[-–—]?\s*S\d{1,2}\s*[xXeE]\d{1,2}.*/i, '')
    .replace(/\s*\d{1,2}[xX]\d{1,2}.*/i, '') // 1x01 format
    .trim();
}

// Returns {season, episode, label} from "S01 E03 - Title" or null if not an episode
export function parseEpisodeInfo(name: string): { season: number; episode: number; label: string } | null {
  const m = name.match(/S(\d{1,2})\s*[xXeE](\d{1,2})(.*)/i)
    || name.match(/(\d{1,2})[xX](\d{1,2})(.*)/i);
  if (!m) return null;
  const label = (m[3] || '').trim().replace(/^[-–—:·]\s*/, '');
  return { season: parseInt(m[1]), episode: parseInt(m[2]), label };
}

// Groups a list of series M3UItems by show name, sorted by S/E
export function groupSeriesByShow(items: M3UItem[]): Record<string, M3UItem[]> {
  const groups: Record<string, M3UItem[]> = {};
  for (const item of items) {
    const show = extractShowName(item.name) || item.name;
    if (!groups[show]) groups[show] = [];
    groups[show].push(item);
  }
  // Sort each show's episodes by season then episode number
  for (const eps of Object.values(groups)) {
    eps.sort((a, b) => {
      const ea = parseEpisodeInfo(a.name);
      const eb = parseEpisodeInfo(b.name);
      if (!ea || !eb) return 0;
      if (ea.season !== eb.season) return ea.season - eb.season;
      return ea.episode - eb.episode;
    });
  }
  return groups;
}

export function generateMAC(): string {
  const stored = localStorage.getItem('masterplayer_mac');
  if (stored) return stored;

  const hex = '0123456789ABCDEF';
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    parts.push(hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]);
  }
  const mac = parts.join(':');
  localStorage.setItem('masterplayer_mac', mac);
  return mac;
}
