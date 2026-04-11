// Adaptador OLX Autos.
// Estrategia: HTTP GET no HTML da listagem + extracao do __NEXT_DATA__ JSON.
// ATENCAO: OLX proibe scraping em seus ToS. Este adaptador e best-effort e
// pode quebrar a qualquer momento. Use por sua conta e risco.

import got from 'got';
import * as cheerio from 'cheerio';
import { config } from '../config.js';

const BASE = 'https://www.olx.com.br';
// Regiao "Campinas e Jundiai" no OLX
const REGION_PATH = '/autos-e-pecas/carros-vans-e-utilitarios/estado-sp/regiao-de-campinas-e-jundiai';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

async function fetchHtml(url) {
  const { body } = await got(url, {
    timeout: { request: 20000 },
    retry: { limit: 1 },
    headers: {
      'user-agent': UA,
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
  });
  return body;
}

function extractNextData(html) {
  const $ = cheerio.load(html);
  const script = $('#__NEXT_DATA__').contents().text();
  if (!script) return null;
  try {
    return JSON.parse(script);
  } catch {
    return null;
  }
}

/**
 * Extrai listings do __NEXT_DATA__ do OLX.
 * A estrutura pode mudar — tentamos varios caminhos conhecidos.
 */
function pickAdsFromNextData(data) {
  if (!data) return [];
  const candidates = [
    data?.props?.pageProps?.ads,
    data?.props?.pageProps?.listingProps?.ads,
    data?.props?.pageProps?.data?.ads,
    data?.props?.pageProps?.initialData?.ads,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

/**
 * Fallback: parse via seletores CSS quando __NEXT_DATA__ nao dispoe.
 */
function parseFromHtml(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('a[data-ds-component="DS-AdCard"]').each((_, el) => {
    const $el = $(el);
    const url = $el.attr('href') || '';
    const title = $el.find('[data-ds-component="DS-Text"]').first().text().trim();
    const priceText = $el.find('[class*="Price"]').first().text();
    const cityText = $el
      .find('[class*="Location"], [class*="location"]')
      .first()
      .text();
    const img = $el.find('img').first().attr('src') || null;
    const idMatch = url.match(/-(\d+)(?:\?|$)/);
    if (!url || !idMatch) return;
    out.push({
      externalId: `olx:${idMatch[1]}`,
      url: url.startsWith('http') ? url : BASE + url,
      title,
      price: priceText,
      city: cityText?.split(',')[0]?.trim(),
      photoUrl: img,
    });
  });
  return out;
}

/**
 * Busca carros no OLX regiao de Campinas, ano >= MIN_YEAR.
 */
export async function fetchOlx(filters = {}) {
  const params = new URLSearchParams();
  params.set('rs', String(config.minYear)); // ano inicial
  params.set('re', String(new Date().getFullYear() + 1));
  params.set('f', 'p'); // apenas anuncios de particular? 'p' em alguns contextos
  if (filters.maxPrice) params.set('pe', String(filters.maxPrice));
  if (filters.brand) params.set('q', filters.brand);

  const url = `${BASE}${REGION_PATH}?${params.toString()}`;
  const html = await fetchHtml(url);
  const nextData = extractNextData(html);
  const ads = pickAdsFromNextData(nextData);

  if (ads.length > 0) {
    return ads.map((ad) => ({
      externalId: `olx:${ad.listId || ad.id || ad.subject}`,
      url: ad.url || `${BASE}/item/${ad.listId || ad.id}`,
      title: ad.subject || ad.title,
      price: ad.price || ad.priceValue,
      year: ad.properties?.find?.((p) => p.name === 'Ano')?.value,
      km: ad.properties?.find?.((p) => p.name === 'Quilometragem')?.value,
      brand: ad.properties?.find?.((p) => p.name === 'Marca')?.value,
      model: ad.properties?.find?.((p) => p.name === 'Modelo')?.value,
      city: ad.locationProperties?.find?.((p) => p.name === 'city')?.value,
      description: ad.body || ad.description,
      phone: ad.phoneMeta?.phone || ad.phone,
      photoUrl: ad.thumbnail || ad.images?.[0]?.original,
    }));
  }

  // Fallback HTML scraping
  return parseFromHtml(html);
}
