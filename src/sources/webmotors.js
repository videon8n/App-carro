// Adaptador Webmotors.
// A Webmotors expoe um endpoint JSON interno em /api/search/car que alimenta
// a propria SPA. Usamos ele direto pra evitar renderizar JS.
// ATENCAO: nao e uma API publica documentada. Pode mudar sem aviso.

import got from 'got';
import { config } from '../config.js';

const API = 'https://www.webmotors.com.br/api/search/car';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

export async function fetchWebmotors(filters = {}) {
  const url = new URL(API);
  // Parametros do site real. Formato: url=/comprar/carros/...
  let path = `/comprar/carros/estado-sao-paulo/regiao-de-campinas/ano-${config.minYear}-9999`;
  if (filters.brand) path = `/comprar/${slug(filters.brand)}/estado-sao-paulo/regiao-de-campinas/ano-${config.minYear}-9999`;
  url.searchParams.set('url', path);
  url.searchParams.set('actualPage', '1');
  url.searchParams.set('displayPerPage', '48');
  url.searchParams.set('order', '1'); // 1 = relevancia

  const res = await got(url.toString(), {
    timeout: { request: 20000 },
    retry: { limit: 1 },
    headers: {
      'user-agent': UA,
      'accept-language': 'pt-BR,pt;q=0.9',
      accept: 'application/json, text/plain, */*',
      referer: 'https://www.webmotors.com.br/',
    },
    responseType: 'json',
  });

  const body = res.body || {};
  const ads = body.SearchResults || body.Results || [];

  return ads.map((ad) => {
    const id = ad.UniqueId || ad.ID || ad.id;
    const specs = ad.Specification || {};
    const make = specs.Make?.Value || specs.Make || ad.Make;
    const model = specs.Model?.Value || specs.Model || ad.Model;
    const version = specs.Version?.Value || specs.Version;
    const year =
      specs.YearModel || specs.YearFabrication || ad.YearModel || ad.Year;
    const km = specs.Odometer || ad.Odometer;
    const city = ad.Seller?.City || ad.Location?.City || specs.City;
    const photo =
      ad.Media?.Photos?.[0]?.Image || ad.Media?.Photos?.[0] || ad.PhotoPath;
    const phone = ad.Seller?.Phone1 || ad.Seller?.SellerPhone;
    const price = ad.Prices?.Price || ad.Price || ad.Value;

    return {
      externalId: `webmotors:${id}`,
      url: `https://www.webmotors.com.br/comprar/${slug(make || '')}/${slug(model || '')}/${id}`,
      title: [make, model, version].filter(Boolean).join(' '),
      brand: make,
      model,
      year: typeof year === 'number' ? year : parseInt(year, 10),
      km: typeof km === 'number' ? km : parseInt(km, 10),
      price,
      phone,
      city,
      description: ad.Specification?.Comments || ad.Comments || '',
      photoUrl: photo ? (photo.startsWith('http') ? photo : `https://image.webmotors.com.br/${photo}`) : null,
    };
  });
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
