const $ = (sel) => document.querySelector(sel);
const form = $('#search-form');
const btn = $('#search-btn');
const statusEl = $('#status');
const results = $('#results');
const srcStatus = $('#source-status');
const healthEl = $('#health');

let currentCars = [];
const favorites = new Set(JSON.parse(localStorage.getItem('appCarroFavs') || '[]'));

const fmtBRL = (n) =>
  n == null
    ? '—'
    : n.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      });

const fmtKm = (n) => (n == null ? '—' : `${n.toLocaleString('pt-BR')} km`);

function fmtPhone(p) {
  if (!p) return null;
  const d = String(p).replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}

function scoreClass(s) {
  if (s == null) return '';
  if (s >= 85) return 's90';
  if (s >= 65) return 's70';
  if (s >= 45) return 's50';
  return 's30';
}

function deltaLabel(delta) {
  if (delta == null) return { text: 'sem FIPE', cls: 'neutral' };
  const pct = delta * 100;
  const text = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% FIPE`;
  if (pct <= -5) return { text, cls: 'good' };
  if (pct >= 5) return { text, cls: 'bad' };
  return { text, cls: 'neutral' };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Fallback SVG placeholder quando o carro nao tem photoUrl ou a imagem falha.
function carSvgPlaceholder(brand, model, year) {
  const BRAND_COLORS = {
    Toyota: '#eb0a1e', Honda: '#cc0000', Jeep: '#2b7a3a',
    Volkswagen: '#2a6ba8', Chevrolet: '#f0b400', Hyundai: '#3a7bd5',
    Fiat: '#9e2a3c', Renault: '#ffc533', Ford: '#1f5ea8', Nissan: '#c8102e',
  };
  const accent = BRAND_COLORS[brand] || '#4ea1ff';
  const safe = (s) => String(s || '').replace(/[<>&"']/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'><defs><linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1e2636'/><stop offset='1' stop-color='#0a0e18'/></linearGradient></defs><rect width='600' height='400' fill='url(#bg)'/><text x='300' y='200' font-family='system-ui' font-size='36' font-weight='800' fill='#fff' text-anchor='middle'>${safe(brand || 'Carro')}</text><text x='300' y='240' font-family='system-ui' font-size='20' fill='${accent}' text-anchor='middle'>${safe(model || '')} ${year || ''}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function cardHtml(car) {
  const phone = fmtPhone(car.phone);
  const delta = deltaLabel(car.fipeDelta);
  const redFlags = (car.redFlags || [])
    .slice(0, 3)
    .map((rf) => `<span class="red-flag">${escapeHtml(rf)}</span>`)
    .join('');

  const photoSrc = car.photoUrl || carSvgPlaceholder(car.brand, car.model, car.year);
  const fallback = carSvgPlaceholder(car.brand, car.model, car.year);

  const isFav = favorites.has(carKey(car));
  const favClass = isFav ? 'on' : '';
  const cardFavClass = isFav ? 'favorite' : '';

  return `
    <article class="card ${cardFavClass}" data-key="${escapeHtml(carKey(car))}">
      <div class="photo-wrap">
        <img class="photo" src="${escapeHtml(photoSrc)}" alt="${escapeHtml(car.title || '')}"
             loading="lazy"
             onerror="this.onerror=null;this.src='${fallback.replace(/'/g, "\\'")}'" />
        <span class="source-tag">${escapeHtml(car.source)}</span>
        <button class="fav-btn ${favClass}" aria-label="Favoritar" data-fav="${escapeHtml(carKey(car))}">
          ${isFav ? '★' : '☆'}
        </button>
        <div class="score-overlay">
          <div class="score-badge ${scoreClass(car.score)}">${car.score ?? '—'}</div>
        </div>
      </div>
      <div class="body">
        <div class="title">${escapeHtml(car.title || 'Sem titulo')}</div>
        <div class="meta">
          <span>${car.year ?? '—'}</span>
          <span class="sep">·</span>
          <span>${fmtKm(car.km)}</span>
          <span class="sep">·</span>
          <span>${escapeHtml(car.city || '—')}</span>
        </div>
        <div class="price-row">
          <div class="price">${fmtBRL(car.price)}</div>
          <div class="delta ${delta.cls}">${delta.text}</div>
        </div>
        ${car.fipePrice ? `<div class="fipe-line">FIPE: ${fmtBRL(car.fipePrice)}</div>` : ''}
        <div class="reason">${escapeHtml(car.reason || 'Sem avaliacao disponivel')}</div>
        ${redFlags ? `<div class="red-flags">${redFlags}</div>` : ''}
        <div class="actions">
          ${
            phone
              ? `<a class="btn primary" href="tel:${phone.replace(/\D/g, '')}">📞 ${phone}</a>`
              : '<span class="btn disabled">sem telefone</span>'
          }
          <a class="btn" href="${escapeHtml(car.url)}" target="_blank" rel="noopener">Ver →</a>
        </div>
      </div>
    </article>
  `;
}

function carKey(car) {
  return `${car.source}:${car.externalId}`;
}

function toggleFavorite(key) {
  if (favorites.has(key)) favorites.delete(key);
  else favorites.add(key);
  localStorage.setItem('appCarroFavs', JSON.stringify([...favorites]));
}

function sortCars(cars, mode) {
  const sorted = [...cars];
  switch (mode) {
    case 'price-asc':
      sorted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      break;
    case 'price-desc':
      sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      break;
    case 'km-asc':
      sorted.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
      break;
    case 'year-desc':
      sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      break;
    case 'delta-asc':
      sorted.sort((a, b) => (a.fipeDelta ?? 0) - (b.fipeDelta ?? 0));
      break;
    case 'score':
    default:
      sorted.sort((a, b) => {
        const sa = a.score ?? -1;
        const sb = b.score ?? -1;
        if (sa !== sb) return sb - sa;
        return (a.fipeDelta ?? 0) - (b.fipeDelta ?? 0);
      });
  }
  // Favoritos sempre no topo dentro do sort escolhido
  sorted.sort((a, b) => {
    const fa = favorites.has(carKey(a)) ? 1 : 0;
    const fb = favorites.has(carKey(b)) ? 1 : 0;
    return fb - fa;
  });
  return sorted;
}

function renderCars() {
  const sortEl = $('#sort-select');
  const mode = sortEl?.value || 'score';
  const sorted = sortCars(currentCars, mode);
  if (sorted.length === 0) {
    results.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🔍</div>
        <h3>Nenhum carro encontrado</h3>
        <p>Tente sem filtros ou aguarde — algumas fontes podem estar bloqueando.</p>
      </div>`;
    return;
  }
  results.innerHTML = sorted.map(cardHtml).join('');
}

function renderSourceStatus(stats) {
  const parts = [];
  for (const key of Object.keys(stats || {})) {
    const s = stats[key];
    const cls = s.ok ? 'ok' : 'bad';
    parts.push(
      `<div class="src-chip ${cls}">${escapeHtml(s.label)}: ${s.ok ? `${s.count}` : 'indisponivel'}</div>`,
    );
  }
  srcStatus.innerHTML = parts.join('');
}

async function loadHealth() {
  try {
    const r = await fetch('/api/health');
    const d = await r.json();
    const flags = [];
    if (d.demoMode) flags.push('DEMO');
    flags.push(d.region.city + '/' + d.region.state);
    flags.push('≥' + d.minYear);
    flags.push(d.hasAnthropicKey ? 'IA on' : 'IA off');
    healthEl.className = 'health ' + (d.demoMode || d.hasAnthropicKey ? 'ok' : 'bad');
    healthEl.innerHTML =
      '<strong>' + (d.demoMode ? 'DEMO' : d.hasAnthropicKey ? 'LIVE' : 'IA off') + '</strong><br>' +
      escapeHtml(flags.slice(1).join(' · '));
    if (d.demoMode) {
      const banner = document.createElement('div');
      banner.className = 'demo-banner';
      banner.innerHTML =
        '<strong>Modo DEMO</strong> — dados de exemplo. Pra usar dados reais, ' +
        'desligue DEMO_MODE nas variaveis do ambiente e rode localmente.';
      document.querySelector('main').prepend(banner);
    }
  } catch {
    healthEl.className = 'health bad';
    healthEl.innerHTML = '<strong>OFF</strong>';
  }
}

function renderSkeleton() {
  results.innerHTML = Array(4)
    .fill(0)
    .map(() => '<div class="skeleton-card"></div>')
    .join('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const payload = {};
  for (const [k, v] of fd.entries()) {
    if (!v) continue;
    payload[k] = k === 'maxPrice' || k === 'minYear' ? Number(v) : v;
  }

  btn.disabled = true;
  btn.textContent = 'Buscando…';
  statusEl.innerHTML = '<span>Buscando nas fontes…</span>';
  srcStatus.innerHTML = '';
  renderSkeleton();

  try {
    const r = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'erro');

    renderSourceStatus(data.stats);
    currentCars = data.cars || [];
    renderCars();

    statusEl.innerHTML =
      `<span class="count">${data.count} carros encontrados</span>` +
      `<div class="sort-wrap">Ordenar:&nbsp;` +
      `<select id="sort-select">
        <option value="score">Melhor oportunidade</option>
        <option value="delta-asc">Maior desconto FIPE</option>
        <option value="price-asc">Menor preço</option>
        <option value="price-desc">Maior preço</option>
        <option value="km-asc">Menor km</option>
        <option value="year-desc">Mais novo</option>
      </select></div>`;
  } catch (err) {
    statusEl.textContent = 'Erro: ' + err.message;
    results.innerHTML = '';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Buscar';
  }
});

// Delegation pro botao de favorito
results.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-fav]');
  if (!btn) return;
  e.preventDefault();
  const key = btn.dataset.fav;
  toggleFavorite(key);
  renderCars();
});

// Sort dropdown (may be recreated after each search)
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'sort-select') {
    renderCars();
  }
});

loadHealth();
