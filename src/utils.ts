import type { M3UItem } from './types';

// ── Group normalization ───────────────────────────────────────────────────────
// Mirrors the server-side normalizeGroupName so client-parsed playlists also
// display clean category names.
const GROUP_NAME_MAP: Record<string, string> = {
  '(vod br) filmes':                    'Filmes BR',
  '(vod mult leg) filmes':              'Legendados',
  '(vod br) cinema cam':                'Cinema CAM',
  '(vod es) peliculas y series es':     'Espanhol',
  '(vod) novelas br':                   'Novelas',
  '(vod) lgbt':                         'LGBT',
  '(vod) xxx +18':                      'Adulto',
  '(vod br) séries':                    'Séries BR',
  '(vod br) series':                    'Séries BR',
  'canais | brasil':                    'Brasil',
  'canais br 4k':                       'Brasil 4K',
  'canais | brasil 24h':                'Brasil 24h',
  'canais | nba league pass':           'NBA',
  'canais | portugal (pt)':             'Portugal',
  'canais | xxx +18':                   'Adulto',
  'canales | deportes':                 'Esportes',
  'canales | deportes ppv':             'Esportes PPV',
  'canales | nba':                      'NBA ES',
  'canales | documentales':             'Documentários',
  'canales | infantiles':               'Infantil',
  'canales | variedades':               'Variedades',
  'canales | notícias':                 'Notícias',
  'canales | noticias':                 'Notícias',
  'canales | peliculas y series':       'Filmes ES',
  'canales | 24h':                      '24h ES',
  'canales | entretenimento y novelas': 'Entretenimento',
  'canal | france':                     'França',
  'channels | usa':                     'USA',
  'tv local (ar)':                      'Argentina',
  'tv local (bo)':                      'Bolívia',
  'tv local (cl)':                      'Chile',
  'tv local (co)':                      'Colômbia',
  'tv local (cu)':                      'Cuba',
  'tv local (es)':                      'Espanha',
  'tv local (mex)':                     'México',
  'tv local (pe)':                      'Peru',
  'tv local (py)':                      'Paraguai',
  'tv local (rd)':                      'R. Dominicana',
  'tv local (uy)':                      'Uruguai',
  'tv local (ve)':                      'Venezuela',
  'rádio br':                           'Rádio',
  'radio br':                           'Rádio',
  'câmeras | play store':               'Câmeras',
  'cameras | play store':               'Câmeras',
  'variados':                           'Variados',
};

export function normalizeGroupName(raw: string): string {
  if (!raw) return raw;
  const mapped = GROUP_NAME_MAP[raw.toLowerCase().trim()];
  if (mapped) return mapped;
  return raw
    .replace(/^\(VOD\s+[^)]+\)\s*/i, '')
    .replace(/^Canai[s]?\s*[|]\s*/i, '')
    .replace(/^Canale[s]?\s*[|]\s*/i, '')
    .replace(/^Channel[s]?\s*[|]\s*/i, '')
    .replace(/^Canal\s*[|]\s*/i, '')
    .trim() || raw;
}

// ── Category sort orders ──────────────────────────────────────────────────────
export const LIVE_CATEGORY_ORDER = [
  'Brasil', 'Brasil 4K', 'Brasil 24h',
  'Portugal', 'USA', 'França',
  'NBA', 'Esportes', 'Esportes PPV',
  'Documentários', 'Infantil', 'Notícias', 'Variedades', 'Entretenimento',
  'Filmes ES', '24h ES', 'NBA ES',
  'Argentina', 'Chile', 'Colômbia', 'Venezuela', 'México', 'Peru',
  'Paraguai', 'Uruguai', 'R. Dominicana', 'Bolívia', 'Cuba', 'Espanha',
  'Rádio', 'Câmeras', 'Variados',
  'Adulto',   // always last
];

export const MOVIE_CATEGORY_ORDER = [
  'Filmes BR', 'Legendados', 'Espanhol', 'Novelas', 'Cinema CAM', 'LGBT',
  'Adulto',   // always last
];

export const SERIES_CATEGORY_ORDER = [
  'Séries BR', 'Espanhol',
  'Adulto',
];

/**
 * Sort category names according to a priority list.
 * Categories not in the list sort alphabetically after the listed ones.
 */
export function sortCategories(cats: string[], order: string[]): string[] {
  return [...cats].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b, 'pt-BR');
  });
}

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

// ============================================================
// M3U Parser — fetches and parses a remote M3U/M3U+ playlist
// ============================================================
function classifyType(group: string, name: string): 'live' | 'movie' | 'series' {
  const g = group.toLowerCase();
  const n = name.toLowerCase();

  // Series detection: has SxxExx or "temporada" or "season"
  if (/s\d{1,2}\s*[xe]\d{1,2}/i.test(n) || /temporada|season/i.test(g)) return 'series';

  // Movie indicators
  if (/filme|movie|filmes|movies|cinema|vod/i.test(g)) return 'movie';

  // Series indicators
  if (/série|series|seri[e]|novela|soap/i.test(g)) return 'series';

  // Default to live for everything else
  return 'live';
}

// fetch() that aborts after `ms` so one dead proxy can't stall the whole chain.
async function fetchWithTimeout(input: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeError(body: string): boolean {
  const head = body.slice(0, 400).toLowerCase();
  return head.includes('<!doctype html') || head.includes('<html') ||
    head.includes('oops... really?') || head.includes('access denied');
}

export async function parseM3UFromUrl(url: string): Promise<M3UItem[]> {
  let text = '';
  let errorDetail = '';

  const PER_TRY_TIMEOUT = 20000;

  const fetchMethods: { label: string; run: () => Promise<string> }[] = [
    {
      // Método 1: proxy do próprio servidor (quando o app é servido pelo Express).
      // Sem CORS, sem proxy de terceiros — é o caminho mais confiável.
      label: 'API do servidor (/api/m3u)',
      run: async () => {
        const res = await fetchWithTimeout(`/api/m3u?url=${encodeURIComponent(url)}`, 60000);
        if (!res.ok) throw new Error(`API respondeu ${res.status}`);
        const body = await res.text();
        if (looksLikeError(body)) throw new Error('API retornou uma página de erro');
        return body;
      },
    },
    {
      label: 'Fetch direto',
      run: async () => {
        const res = await fetchWithTimeout(url, PER_TRY_TIMEOUT);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      },
    },
    {
      label: 'AllOrigins (raw)',
      run: async () => {
        const res = await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, PER_TRY_TIMEOUT);
        if (!res.ok) throw new Error(`proxy respondeu ${res.status}`);
        const body = await res.text();
        if (looksLikeError(body)) throw new Error('proxy retornou HTML de erro');
        return body;
      },
    },
    {
      label: 'CodeTabs',
      run: async () => {
        const res = await fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, PER_TRY_TIMEOUT);
        if (!res.ok) throw new Error(`proxy respondeu ${res.status}`);
        const body = await res.text();
        if (looksLikeError(body)) throw new Error('proxy retornou HTML de erro');
        return body;
      },
    },
    {
      label: 'corsproxy.io',
      run: async () => {
        const res = await fetchWithTimeout(`https://corsproxy.io/?url=${encodeURIComponent(url)}`, PER_TRY_TIMEOUT);
        if (!res.ok) throw new Error(`proxy respondeu ${res.status}`);
        const body = await res.text();
        if (looksLikeError(body)) throw new Error('proxy retornou HTML de erro');
        return body;
      },
    },
    {
      label: 'AllOrigins (get/json)',
      run: async () => {
        const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, PER_TRY_TIMEOUT);
        const raw = await res.text();
        if (!raw || looksLikeError(raw)) throw new Error('proxy retornou corpo vazio ou de erro');
        let data: { contents?: string };
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error('proxy retornou resposta não-JSON');
        }
        if (!data.contents || looksLikeError(data.contents)) throw new Error('conteúdo do proxy é HTML de erro');
        return data.contents;
      },
    },
  ];

  for (const { label, run } of fetchMethods) {
    try {
      console.log(`[M3U] Tentando: ${label}`);
      const body = await run();
      if (body && body.trim().length > 0) {
        text = body;
        console.log(`[M3U] OK via ${label} (${(body.length / 1024).toFixed(0)} KB)`);
        break;
      }
    } catch (e: any) {
      const reason = e?.name === 'AbortError' ? 'tempo esgotado' : (e?.message || 'erro desconhecido');
      console.warn(`[M3U] Falhou (${label}): ${reason}`);
      errorDetail = `${label}: ${reason}`;
    }
  }

  if (!text || text.trim().length === 0) {
    throw new Error(`Não foi possível carregar a lista. Último erro — ${errorDetail || 'todos os métodos falharam'}.`);
  }

  // Remove BOM e espaços iniciais que quebram a detecção das tags
  text = text.replace(/^\uFEFF/, '').replace(/^\s+/, '');

  if (!text.includes('#EXTINF')) {
    throw new Error('O arquivo retornado não parece ser uma lista M3U válida (nenhuma entrada #EXTINF).');
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: M3UItem[] = [];

  console.log(`[M3U] Processando ${lines.length} linhas...`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('#EXTINF')) continue;

    const info = line;
    // O URL do stream deve estar na linha seguinte ou subsequente (ignora outras tags)
    let streamUrl = '';
    let nextIdx = i + 1;
    while (nextIdx < lines.length) {
      const nextLine = lines[nextIdx];
      // Aceita qualquer linha que não seja um comentário/tag
      if (nextLine && !nextLine.startsWith('#')) {
        streamUrl = nextLine;
        break;
      }
      // Se encontrar outra tag EXTINF antes do URL, esta entrada está órfã
      if (nextLine.startsWith('#EXTINF')) break;
      nextIdx++;
    }

    if (!streamUrl) continue;

    // Regex mais flexíveis para atributos (com ou sem aspas)
    // tvg-logo="url" ou tvg-logo=url
    const logoMatch = info.match(/tvg-logo=["']?([^"' ]*)["']?/i);
    const logo = logoMatch ? logoMatch[1] : '';

    // group-title="name" ou group-title=name
    const groupMatch = info.match(/group-title=["']?([^"']*)["']?(?: |$)/i) 
                   || info.match(/group-title=["']?([^"']*)["']?(?:,|$)/i);
    let group = groupMatch ? groupMatch[1] : 'Sem Categoria';
    
    // Limpa o grupo se tiver virgulas residuais (comum em m3u_plus)
    group = group.split(',')[0].trim();

    // Extrai o nome após a última vírgula da linha #EXTINF
    const commaIdx = info.lastIndexOf(',');
    const name = commaIdx >= 0 ? info.slice(commaIdx + 1).trim() : 'Sem Nome';

    const type = classifyType(group, name);
    items.push({ name, logo, group, url: streamUrl, type });
    
    i = nextIdx; // Pula para a linha do URL
  }

  console.log(`[M3U] Parsing concluído: ${items.length} itens extraídos.`);
  return items;
}
