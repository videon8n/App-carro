// Registry de fontes e runner paralelo.

import { config } from '../config.js';
import { normalizeListing } from '../normalize.js';
import { fetchOlx } from './olx.js';
import { fetchWebmotors } from './webmotors.js';
import { fetchMercadoLivre } from './mercadolivre.js';
import { fetchFacebook } from './facebook.js';

const SOURCES = [
  { name: 'olx', label: 'OLX', fn: fetchOlx, enabled: () => true },
  { name: 'webmotors', label: 'Webmotors', fn: fetchWebmotors, enabled: () => true },
  { name: 'mercadolivre', label: 'Mercado Livre', fn: fetchMercadoLivre, enabled: () => true },
  {
    name: 'facebook',
    label: 'Facebook Marketplace',
    fn: fetchFacebook,
    enabled: () => config.enableFacebook,
  },
];

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Roda todas as fontes ativas em paralelo.
 * Retorna { cars: [...], errors: [{ source, message }] }.
 */
export async function fetchAllSources(filters) {
  const active = SOURCES.filter((s) => s.enabled());
  const results = await Promise.allSettled(
    active.map((s) =>
      withTimeout(s.fn(filters), config.sourceTimeoutMs, s.label).then((list) => ({
        source: s.name,
        label: s.label,
        list,
      })),
    ),
  );

  const cars = [];
  const errors = [];
  const stats = {};

  for (let i = 0; i < results.length; i++) {
    const src = active[i];
    const r = results[i];
    if (r.status === 'fulfilled') {
      const listings = r.value.list || [];
      for (const raw of listings) {
        try {
          const norm = normalizeListing({ ...raw, source: src.name });
          if (norm.url && norm.externalId) cars.push(norm);
        } catch (err) {
          console.warn(`[${src.name}] normalize error:`, err.message);
        }
      }
      stats[src.name] = { label: src.label, count: listings.length, ok: true };
    } else {
      errors.push({ source: src.name, label: src.label, message: r.reason?.message || String(r.reason) });
      stats[src.name] = { label: src.label, count: 0, ok: false, error: r.reason?.message };
    }
  }

  return { cars, errors, stats };
}
