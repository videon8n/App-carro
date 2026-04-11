// Cliente da API publica da FIPE (https://deividfortuna.github.io/fipe/v2)
// Sem chave. Cache local em SQLite por 7 dias.

import got from 'got';
import { getFipeCache, setFipeCache } from './db.js';

const BASE = 'https://parallelum.com.br/fipe/api/v1';
const CACHE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

const httpOpts = {
  timeout: { request: 10000 },
  retry: { limit: 1 },
  headers: { 'user-agent': 'app-carro/0.1' },
  responseType: 'json',
};

// Memo em memoria pro ciclo da busca atual (evita hit no SQLite repetido).
const memo = new Map();

async function listBrands() {
  const key = 'fipe:brands';
  if (memo.has(key)) return memo.get(key);
  const { body } = await got(`${BASE}/carros/marcas`, httpOpts);
  memo.set(key, body);
  return body;
}

async function listModels(brandCode) {
  const key = `fipe:models:${brandCode}`;
  if (memo.has(key)) return memo.get(key);
  const { body } = await got(
    `${BASE}/carros/marcas/${brandCode}/modelos`,
    httpOpts,
  );
  memo.set(key, body.modelos || []);
  return memo.get(key);
}

async function listYears(brandCode, modelCode) {
  const key = `fipe:years:${brandCode}:${modelCode}`;
  if (memo.has(key)) return memo.get(key);
  const { body } = await got(
    `${BASE}/carros/marcas/${brandCode}/modelos/${modelCode}/anos`,
    httpOpts,
  );
  memo.set(key, body);
  return body;
}

async function getPriceFor(brandCode, modelCode, yearCode) {
  const { body } = await got(
    `${BASE}/carros/marcas/${brandCode}/modelos/${modelCode}/anos/${yearCode}`,
    httpOpts,
  );
  // body.Valor = "R$ 89.900,00"
  const n = parseFloat(
    String(body.Valor || '')
      .replace(/[^\d,]/g, '')
      .replace(',', '.'),
  );
  return isNaN(n) ? null : n;
}

const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

function findBestMatch(list, target, fieldName = 'nome') {
  if (!target) return null;
  const t = normalize(target);
  // Match exato primeiro
  const exact = list.find((x) => normalize(x[fieldName]) === t);
  if (exact) return exact;
  // Match por "startsWith"
  const starts = list.find((x) => normalize(x[fieldName]).startsWith(t));
  if (starts) return starts;
  // Match por "includes"
  const inc = list.find((x) => normalize(x[fieldName]).includes(t));
  if (inc) return inc;
  // Match invertido: target inclui o nome da lista (ex: titulo "Corolla XEI" -> modelo "Corolla")
  const rev = list.find((x) => t.includes(normalize(x[fieldName])));
  return rev || null;
}

/**
 * Busca preco FIPE para (brand, model, year).
 * Retorna { price } ou null se nao encontrar.
 */
export async function getFipePrice({ brand, model, year }) {
  if (!brand || !model || !year) return null;

  const cacheKey = `${normalize(brand)}|${normalize(model)}|${year}`;
  const cached = getFipeCache(cacheKey, CACHE_MS);
  if (cached != null) return { price: cached, cached: true };

  try {
    const brands = await listBrands();
    const brandMatch = findBestMatch(brands, brand);
    if (!brandMatch) return null;

    const models = await listModels(brandMatch.codigo);
    const modelMatch = findBestMatch(models, model);
    if (!modelMatch) return null;

    const years = await listYears(brandMatch.codigo, modelMatch.codigo);
    // Year codes formato "2020-1" = gasolina, "2020-3" = diesel, etc.
    const yearMatch =
      years.find((y) => String(y.codigo).startsWith(String(year))) ||
      years.find((y) => String(y.nome).startsWith(String(year)));
    if (!yearMatch) return null;

    const price = await getPriceFor(
      brandMatch.codigo,
      modelMatch.codigo,
      yearMatch.codigo,
    );
    if (price == null) return null;

    setFipeCache(cacheKey, price);
    return { price, cached: false };
  } catch (err) {
    // FIPE indisponivel nao e fatal, so perde o score comparativo
    console.warn(`[fipe] erro ao buscar ${cacheKey}:`, err.message);
    return null;
  }
}

/**
 * Enriquece uma lista de carros com campo fipePrice e fipeDelta.
 * Processa em serie (rate-limit amigavel com a API publica).
 */
export async function enrichWithFipe(cars) {
  for (const car of cars) {
    if (car.fipePrice || !car.brand || !car.model || !car.year) continue;
    const res = await getFipePrice({
      brand: car.brand,
      model: car.model,
      year: car.year,
    });
    if (res) {
      car.fipePrice = res.price;
      if (car.price) {
        car.fipeDelta = (car.price - res.price) / res.price;
      }
    }
  }
  return cars;
}
