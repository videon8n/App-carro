import fs from 'node:fs';
import Database from 'better-sqlite3';
import { config } from './config.js';

if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    external_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    brand TEXT,
    model TEXT,
    year INTEGER,
    km INTEGER,
    price REAL,
    phone TEXT,
    city TEXT,
    description TEXT,
    photo_url TEXT,
    fipe_price REAL,
    fipe_delta REAL,
    score INTEGER,
    reason TEXT,
    red_flags TEXT,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    UNIQUE(source, external_id)
  );

  CREATE INDEX IF NOT EXISTS idx_cars_year ON cars(year);
  CREATE INDEX IF NOT EXISTS idx_cars_score ON cars(score);
  CREATE INDEX IF NOT EXISTS idx_cars_last_seen ON cars(last_seen_at);

  CREATE TABLE IF NOT EXISTS fipe_cache (
    key TEXT PRIMARY KEY,
    price REAL,
    fetched_at INTEGER NOT NULL
  );
`);

const upsertCarStmt = db.prepare(`
  INSERT INTO cars (
    source, external_id, url, title, brand, model, year, km, price,
    phone, city, description, photo_url, fipe_price, fipe_delta,
    score, reason, red_flags, first_seen_at, last_seen_at
  ) VALUES (
    @source, @external_id, @url, @title, @brand, @model, @year, @km, @price,
    @phone, @city, @description, @photo_url, @fipe_price, @fipe_delta,
    @score, @reason, @red_flags, @now, @now
  )
  ON CONFLICT(source, external_id) DO UPDATE SET
    url          = excluded.url,
    title        = excluded.title,
    brand        = COALESCE(excluded.brand, cars.brand),
    model        = COALESCE(excluded.model, cars.model),
    year         = COALESCE(excluded.year, cars.year),
    km           = COALESCE(excluded.km, cars.km),
    price        = excluded.price,
    phone        = COALESCE(excluded.phone, cars.phone),
    city         = COALESCE(excluded.city, cars.city),
    description  = COALESCE(excluded.description, cars.description),
    photo_url    = COALESCE(excluded.photo_url, cars.photo_url),
    fipe_price   = COALESCE(excluded.fipe_price, cars.fipe_price),
    fipe_delta   = COALESCE(excluded.fipe_delta, cars.fipe_delta),
    score        = COALESCE(excluded.score, cars.score),
    reason       = COALESCE(excluded.reason, cars.reason),
    red_flags    = COALESCE(excluded.red_flags, cars.red_flags),
    last_seen_at = excluded.last_seen_at
  RETURNING id;
`);

export function upsertCar(car) {
  const now = Date.now();
  const row = upsertCarStmt.get({
    source: car.source,
    external_id: car.externalId,
    url: car.url,
    title: car.title ?? null,
    brand: car.brand ?? null,
    model: car.model ?? null,
    year: car.year ?? null,
    km: car.km ?? null,
    price: car.price ?? null,
    phone: car.phone ?? null,
    city: car.city ?? null,
    description: car.description ?? null,
    photo_url: car.photoUrl ?? null,
    fipe_price: car.fipePrice ?? null,
    fipe_delta: car.fipeDelta ?? null,
    score: car.score ?? null,
    reason: car.reason ?? null,
    red_flags: car.redFlags ? JSON.stringify(car.redFlags) : null,
    now,
  });
  return row?.id;
}

const updateScoreStmt = db.prepare(`
  UPDATE cars
     SET score = @score, reason = @reason, red_flags = @red_flags
   WHERE source = @source AND external_id = @external_id
`);

export function updateScore(source, externalId, { score, reason, redFlags }) {
  updateScoreStmt.run({
    source,
    external_id: externalId,
    score: score ?? null,
    reason: reason ?? null,
    red_flags: redFlags ? JSON.stringify(redFlags) : null,
  });
}

const recentCarsStmt = db.prepare(`
  SELECT * FROM cars
   WHERE last_seen_at >= @since
     AND (year IS NULL OR year >= @minYear)
   ORDER BY COALESCE(score, -1) DESC, last_seen_at DESC
   LIMIT @limit
`);

export function getRecentCars({ sinceMs, minYear, limit = 200 }) {
  const rows = recentCarsStmt.all({
    since: Date.now() - sinceMs,
    minYear,
    limit,
  });
  return rows.map(deserializeCar);
}

function deserializeCar(row) {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    url: row.url,
    title: row.title,
    brand: row.brand,
    model: row.model,
    year: row.year,
    km: row.km,
    price: row.price,
    phone: row.phone,
    city: row.city,
    description: row.description,
    photoUrl: row.photo_url,
    fipePrice: row.fipe_price,
    fipeDelta: row.fipe_delta,
    score: row.score,
    reason: row.reason,
    redFlags: row.red_flags ? JSON.parse(row.red_flags) : [],
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

const getFipeStmt = db.prepare('SELECT * FROM fipe_cache WHERE key = ?');
const setFipeStmt = db.prepare(`
  INSERT INTO fipe_cache (key, price, fetched_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET price = excluded.price, fetched_at = excluded.fetched_at
`);

export function getFipeCache(key, maxAgeMs) {
  const row = getFipeStmt.get(key);
  if (!row) return null;
  if (Date.now() - row.fetched_at > maxAgeMs) return null;
  return row.price;
}

export function setFipeCache(key, price) {
  setFipeStmt.run(key, price, Date.now());
}

export default db;
