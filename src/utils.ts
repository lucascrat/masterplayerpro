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

export async function parseM3UFromUrl(url: string): Promise<M3UItem[]> {
  const startTime = Date.now();
  let text = '';
  let errorDetail = '';

  const fetchMethods = [
    // Método 1: Fetch Direto
    async () => {
      console.log('Tentando Fetch Direto...');
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    },
    // Método 2: Proxy AllOrigins (Raw)
    async () => {
      console.log('Tentando Proxy 1 (AllOrigins Raw)...');
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Proxy 1 falhou: ${res.status}`);
      const text = await res.text();
      if (text.includes('Oops... Really?') || text.includes('<!DOCTYPE html>')) {
        throw new Error('Proxy 1 retornou erro HTML');
      }
      return text;
    },
    // Método 3: Proxy CorsProxy.io
    async () => {
      console.log('Tentando Proxy 2 (CorsProxy.io)...');
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Proxy 2 falhou: ${res.status}`);
      const text = await res.text();
      if (text.includes('<!DOCTYPE html>')) {
        throw new Error('Proxy 2 retornou HTML');
      }
      return text;
    },
    // Método 4: Proxy CodeTabs (Resiliente)
    async () => {
      console.log('Tentando Proxy 3 (CodeTabs)...');
      const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Proxy 3 falhou: ${res.status}`);
      const text = await res.text();
      if (text.includes('<!DOCTYPE html>')) {
        throw new Error('Proxy 3 retornou HTML');
      }
      return text;
    },
    // Método 5: Proxy AllOrigins (Get - JSON Wrapper)
    async () => {
      console.log('Tentando Proxy 4 (AllOrigins Get)...');
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, { cache: 'no-store' });
      const body = await res.text();
      
      if (!body || body.includes('Oops... Really?') || body.includes('<!DOCTYPE html>')) {
        throw new Error('Proxy 4 retornou erro ou corpo vazio');
      }

      try {
        const data = JSON.parse(body);
        if (data.contents) {
          if (data.contents.includes('<!DOCTYPE html>')) {
            throw new Error('Conteúdo do Proxy 4 é HTML (erro do provedor)');
          }
          return data.contents;
        }
        throw new Error('Formato JSON inválido no Proxy 4');
      } catch (e: any) {
        if (e.message.includes('Unexpected token') || e.message.includes('is not valid JSON')) {
          throw new Error('O servidor de proxy retornou uma resposta inválida (não-JSON)');
        }
        throw e;
      }
    }
  ];

  for (const method of fetchMethods) {
    try {
      text = await method();
      if (text && text.trim().length > 0) break;
    } catch (e: any) {
      console.warn('Falha no método de busca:', e.message);
      errorDetail = e.message;
    }
  }

  if (!text || text.trim().length === 0) {
    // Se chegamos aqui, todos falharam. Mostramos o último erro ou um genérico.
    const msg = errorDetail || 'Todos os servidores de proxy falharam.';
    throw new Error(`Não foi possível carregar a lista. Detalhe: ${msg}`);
  }

  // Verifica se é uma lista M3U válida, mas tenta ser flexível
  const textPreview = text.substring(0, 100).replace(/\n/g, ' ');
  console.log(`Início do conteúdo recebido: "${textPreview}..."`);

  if (!text.includes('#EXTM3U') && !text.includes('#EXTINF')) {
    throw new Error('O arquivo retornado não parece ser uma lista M3U válida.');
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: M3UItem[] = [];
  
  console.log(`Processando ${lines.length} linhas de texto...`);

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

  console.log(`Parsing concluído: ${items.length} itens extraídos.`);
  return items;
}
