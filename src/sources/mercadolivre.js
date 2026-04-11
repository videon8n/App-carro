// Adaptador Mercado Livre Veiculos.
// Estrategia: HTTP GET no HTML da listagem + parsing com cheerio.
// ATENCAO: o ML proibe scraping em ToS. Best-effort.

import got from 'got';
import * as cheerio from 'cheerio';
import { config } from '../config.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

function buildUrl(filters = {}) {
  // Mercado Livre usa URLs estruturais.
  // Ex: https://veiculos.mercadolivre.com.br/campinas/carros-e-caminhonetes/ano-2018-em-diante/
  const parts = [
    'https://veiculos.mercadolivre.com.br',
    'sp',
    'campinas',
    'carros-e-caminhonetes',
    `ano-${config.minYear}-em-diante`,
  ];
  if (filters.brand) parts.push(`_MARCA_${encodeURIComponent(filters.brand)}`);
  return parts.join('/') + '/';
}

async function fetchHtml(url) {
  const { body } = await got(url, {
    timeout: { request: 20000 },
    retry: { limit: 1 },
    headers: {
      'user-agent': UA,
      'accept-language': 'pt-BR,pt;q=0.9',
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
  });
  return body;
}

export async function fetchMercadoLivre(filters = {}) {
  const url = buildUrl(filters);
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const out = [];

  // Cards modernos (2024+)
  $('li.ui-search-layout__item, .ui-search-result__wrapper').each((_, el) => {
    const $el = $(el);
    const link = $el.find('a.poly-component__title, a.ui-search-link').first();
    const href = link.attr('href');
    if (!href) return;

    const idMatch = href.match(/MLB-?(\d+)/);
    const externalId = idMatch
      ? `ml:${idMatch[1]}`
      : `ml:${Buffer.from(href).toString('base64').slice(0, 20)}`;

    const title = link.text().trim() || $el.find('h2').first().text().trim();
    const priceText = $el
      .find('.andes-money-amount__fraction, .price-tag-fraction')
      .first()
      .text()
      .trim();
    const attrs = [];
    $el.find('.poly-attributes_list__item, .ui-search-card-attributes__attribute').each((_, a) => {
      attrs.push($(a).text().trim());
    });
    const locationText = $el
      .find('.poly-component__location, .ui-search-item__location')
      .first()
      .text()
      .trim();
    const img = $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src');

    out.push({
      externalId,
      url: href.startsWith('http') ? href : `https:${href}`,
      title,
      price: priceText,
      description: attrs.join(' | '),
      city: locationText?.split(' - ')[0]?.trim(),
      photoUrl: img,
    });
  });

  return out;
}
