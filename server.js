import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, isInRegion } from './src/config.js';
import { upsertCar, updateScore, getRecentCars } from './src/db.js';
import { fetchAllSources } from './src/sources/index.js';
import { enrichWithFipe } from './src/fipe.js';
import { scoreCars } from './src/intelligence.js';
import { getDemoResponse } from './src/demo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    region: config.region,
    minYear: config.minYear,
    hasAnthropicKey: !!config.anthropicApiKey,
    facebookEnabled: config.enableFacebook,
    demoMode: config.demoMode,
  });
});

/**
 * POST /api/search
 * Body: { brand?, model?, maxPrice?, minYear?, useCache? }
 * Roda todas as fontes, enriquece com FIPE, pontua com IA, persiste e devolve.
 */
app.post('/api/search', async (req, res) => {
  const filters = req.body || {};
  const minYear = filters.minYear || config.minYear;
  const started = Date.now();

  // Modo demo: retorna fixtures sem tocar em fontes/FIPE/Claude.
  // Util pra visualizar a UI em ambientes com IP de datacenter bloqueado
  // (Replit, Vercel, Railway...).
  if (config.demoMode) {
    console.log('[search] DEMO_MODE=true, retornando fixtures');
    const demo = getDemoResponse();
    return res.json({ ...demo, elapsedMs: Date.now() - started });
  }

  try {
    console.log('[search] iniciando busca', filters);
    const { cars, errors, stats } = await fetchAllSources(filters);
    console.log(
      `[search] fontes retornaram ${cars.length} anuncios brutos em ${Date.now() - started}ms`,
    );

    // Filtros hard: ano >= minYear e regiao
    const filtered = cars.filter((c) => {
      if (!c.price || c.price < 5000) return false;
      if (c.year != null && c.year < minYear) return false;
      if (filters.maxPrice && c.price > filters.maxPrice) return false;
      if (filters.brand && c.brand && !matchText(c.brand, filters.brand)) return false;
      if (filters.model && c.model && !matchText(c.model, filters.model)) return false;
      // Regiao: se conseguir parsear a cidade, exige que seja RMC; se nao, deixa passar.
      if (c.city && !isInRegion(c.city)) return false;
      return true;
    });

    console.log(`[search] ${filtered.length} anuncios apos filtro regiao/ano/preco`);

    // Enriquecimento FIPE (serializado, cacheado)
    await enrichWithFipe(filtered);

    // Persiste antes do score (pra ter dado mesmo se IA falhar)
    for (const car of filtered) {
      upsertCar(car);
    }

    // Score com IA (batch)
    const scores = await scoreCars(filtered);
    for (const s of scores) {
      updateScore(s.source, s.externalId, s);
      // Aplica o score no objeto em memoria pra resposta
      const car = filtered.find(
        (c) => c.source === s.source && String(c.externalId) === String(s.externalId),
      );
      if (car) {
        car.score = s.score;
        car.reason = s.reason;
        car.redFlags = s.redFlags;
      }
    }

    // Ordena por score desc, depois por delta FIPE asc (mais abaixo = melhor)
    filtered.sort((a, b) => {
      const sa = a.score ?? -1;
      const sb = b.score ?? -1;
      if (sa !== sb) return sb - sa;
      const da = a.fipeDelta ?? 0;
      const db = b.fipeDelta ?? 0;
      return da - db;
    });

    res.json({
      ok: true,
      count: filtered.length,
      elapsedMs: Date.now() - started,
      stats,
      errors,
      cars: filtered,
    });
  } catch (err) {
    console.error('[search] erro fatal', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/cars — retorna carros do cache (sem nova busca).
 */
app.get('/api/cars', (req, res) => {
  const sinceHours = parseInt(req.query.sinceHours || '72', 10);
  const limit = parseInt(req.query.limit || '200', 10);
  const cars = getRecentCars({
    sinceMs: sinceHours * 60 * 60 * 1000,
    minYear: config.minYear,
    limit,
  });
  res.json({ ok: true, count: cars.length, cars });
});

function matchText(a, b) {
  return String(a)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .includes(
      String(b)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
    );
}

app.listen(config.port, '0.0.0.0', () => {
  console.log(`\n  App-carro rodando em http://0.0.0.0:${config.port}`);
  console.log(`  Regiao: ${config.region.city}/${config.region.state}`);
  console.log(`  Ano minimo: ${config.minYear}`);
  console.log(
    `  Claude API: ${config.anthropicApiKey ? 'configurada' : 'AUSENTE (score IA desabilitado)'}`,
  );
  console.log(
    `  Facebook Marketplace: ${config.enableFacebook ? 'habilitado' : 'desabilitado'}`,
  );
  console.log(
    `  Demo mode: ${config.demoMode ? 'LIGADO (fixtures)' : 'desligado (scraping real)'}\n`,
  );
});
