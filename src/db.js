// Persistencia em JSON files puro — sem dependencias nativas.
//
// Antes usavamos better-sqlite3, mas ele precisa compilar C++ via node-gyp
// e nao tem binarios prontos pra todas as versoes do Node (quebra em
// Node 24 sem VS Build Tools). Pro nosso uso (cache de FIPE + ate ~200
// carros), JSON em disco e mais do que suficiente e funciona em qualquer
// Node 20+.
//
// Dois arquivos sao mantidos:
//   data/cars.json    — carros agregados, key = "{source}:{externalId}"
//   data/fipe.json    — cache FIPE, key = "{brand}|{model}|{year}"
//
// Escrita e agendada com debounce de 100ms pra nao bater no disco a cada
// upsert durante uma busca. Atomico via write-to-tmp + rename.

import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

const CARS_FILE = path.join(config.dataDir, 'cars.json');
const FIPE_FILE = path.join(config.dataDir, 'fipe.json');

function loadJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const text = fs.readFileSync(file, 'utf-8');
    return text ? JSON.parse(text) : null;
  } catch (err) {
    console.warn(`[db] falha ao ler ${file}: ${err.message}. Comecando vazio.`);
    return null;
  }
}

function saveJsonAtomic(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

// Estado em memoria (hydrated do disco no import)
const carsMap = loadJson(CARS_FILE) || {};
const fipeCache = loadJson(FIPE_FILE) || {};

// Debounced saves pra nao escrever o arquivo inteiro a cada upsert
let saveCarsTimer = null;
function scheduleSaveCars() {
  if (saveCarsTimer) return;
  saveCarsTimer = setTimeout(() => {
    try {
      saveJsonAtomic(CARS_FILE, carsMap);
    } catch (err) {
      console.warn(`[db] falha ao salvar cars.json: ${err.message}`);
    }
    saveCarsTimer = null;
  }, 100);
}

let saveFipeTimer = null;
function scheduleSaveFipe() {
  if (saveFipeTimer) return;
  saveFipeTimer = setTimeout(() => {
    try {
      saveJsonAtomic(FIPE_FILE, fipeCache);
    } catch (err) {
      console.warn(`[db] falha ao salvar fipe.json: ${err.message}`);
    }
    saveFipeTimer = null;
  }, 100);
}

let nextId = Math.max(0, ...Object.values(carsMap).map((c) => c.id || 0)) + 1;

function keyOf(source, externalId) {
  return `${source}:${externalId}`;
}

// Merge "COALESCE-style": campos novos sobrepoem os existentes,
// mas so se forem nao-null/undefined (preserva valores ja populados).
function mergeField(newVal, oldVal) {
  return newVal != null ? newVal : oldVal != null ? oldVal : null;
}

export function upsertCar(car) {
  const key = keyOf(car.source, car.externalId);
  const now = Date.now();
  const existing = carsMap[key];

  const merged = {
    id: existing?.id ?? nextId++,
    source: car.source,
    externalId: String(car.externalId),
    url: car.url,
    title: mergeField(car.title, existing?.title),
    brand: mergeField(car.brand, existing?.brand),
    model: mergeField(car.model, existing?.model),
    year: mergeField(car.year, existing?.year),
    km: mergeField(car.km, existing?.km),
    price: car.price ?? existing?.price ?? null,
    phone: mergeField(car.phone, existing?.phone),
    city: mergeField(car.city, existing?.city),
    description: mergeField(car.description, existing?.description),
    photoUrl: mergeField(car.photoUrl, existing?.photoUrl),
    fipePrice: mergeField(car.fipePrice, existing?.fipePrice),
    fipeDelta: mergeField(car.fipeDelta, existing?.fipeDelta),
    score: mergeField(car.score, existing?.score),
    reason: mergeField(car.reason, existing?.reason),
    redFlags: car.redFlags ?? existing?.redFlags ?? [],
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
  };

  carsMap[key] = merged;
  scheduleSaveCars();
  return merged.id;
}

export function updateScore(source, externalId, { score, reason, redFlags }) {
  const key = keyOf(source, externalId);
  const car = carsMap[key];
  if (!car) return;
  car.score = score ?? null;
  car.reason = reason ?? null;
  car.redFlags = redFlags ?? [];
  scheduleSaveCars();
}

export function getRecentCars({ sinceMs, minYear, limit = 200 }) {
  const cutoff = Date.now() - sinceMs;
  return Object.values(carsMap)
    .filter((c) => c.lastSeenAt >= cutoff)
    .filter((c) => c.year == null || c.year >= minYear)
    .sort((a, b) => {
      const sa = a.score ?? -1;
      const sb = b.score ?? -1;
      if (sa !== sb) return sb - sa;
      return b.lastSeenAt - a.lastSeenAt;
    })
    .slice(0, limit);
}

export function getFipeCache(key, maxAgeMs) {
  const entry = fipeCache[key];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > maxAgeMs) return null;
  return entry.price;
}

export function setFipeCache(key, price) {
  fipeCache[key] = { price, fetchedAt: Date.now() };
  scheduleSaveFipe();
}

// Flush sincrono pra shutdown graceful
process.on('beforeExit', () => {
  if (saveCarsTimer) {
    clearTimeout(saveCarsTimer);
    saveJsonAtomic(CARS_FILE, carsMap);
  }
  if (saveFipeTimer) {
    clearTimeout(saveFipeTimer);
    saveJsonAtomic(FIPE_FILE, fipeCache);
  }
});

// Default export pra backwards compat com quem importava `import db from`
export default { upsertCar, updateScore, getRecentCars, getFipeCache, setFipeCache };
