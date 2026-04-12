const $ = (sel) => document.querySelector(sel);
const form = $('#search-form');
const searchBtn = $('#search-btn');
const statusEl = $('#status');
const results = $('#results');
const srcStatus = $('#source-status');
const healthEl = $('#health');

let currentCars = [];
const favorites = new Set(JSON.parse(localStorage.getItem('appCarroFavs') || '[]'));

// Cores de marca. Mantenha em sincronia com src/demo.js BRAND_COLORS.
const BRAND_COLORS = {
  Toyota: '#eb0a1e', Honda: '#cc0000', Jeep: '#2b7a3a',
  Volkswagen: '#2a6ba8', Chevrolet: '#f0b400', Hyundai: '#3a7bd5',
  Fiat: '#9e2a3c', Renault: '#ffc533', Ford: '#1f5ea8', Nissan: '#c8102e',
};

// Tiers de score. Mantenha em sincronia com .score-badge.s-* em styles.css.
const SCORE_TIERS = [
  { min: 85, cls: 's-excellent' },
  { min: 65, cls: 's-good' },
  { min: 45, cls: 's-fair' },
  { min: 0,  cls: 's-poor' },
];

const DELTA_TIERS = [
  { max: -0.05, cls: 'good' },
  { max:  0.05, cls: 'neutral' },
  { max:  Infinity, cls: 'bad' },
];

// Tabela unica de modos de ordenacao: alimenta tanto o <select> quanto
// a logica de comparacao. Adicione um item aqui pra criar um novo modo.
const SORT_MODES = [
  {
    key: 'score',
    label: 'Melhor oportunidade',
    compare: (a, b) => {
      const s = (b.score ?? -1) - (a.score ?? -1);
      if (s !== 0) return s;
      return (a.fipeDelta ?? 0) - (b.fipeDelta ?? 0);
    },
  },
  { key: 'delta-asc', label: 'Maior desconto FIPE',
    compare: (a, b) => (a.fipeDelta ?? 0) - (b.fipeDelta ?? 0) },
  { key: 'price-asc', label: 'Menor preço',
    compare: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) },
  { key: 'price-desc', label: 'Maior preço',
    compare: (a, b) => (b.price ?? 0) - (a.price ?? 0) },
  { key: 'km-asc', label: 'Menor km',
    compare: (a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) },
  { key: 'year-desc', label: 'Mais novo',
    compare: (a, b) => (b.year ?? 0) - (a.year ?? 0) },
];

const fmtBRL = (n) =>
  n == null
    ? '—'
    : n.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      });

const fmtKm = (n) => (n == null ? '—' : `${n.toLocaleString('pt-BR')} km`);

// Espelha src/normalize.js formatPhone. Mantenha em sincronia.
function fmtPhone(p) {
  if (!p) return null;
  const d = String(p).replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}

function scoreClass(s) {
  if (s == null) return '';
  return SCORE_TIERS.find((t) => s >= t.min)?.cls || '';
}

function deltaLabel(delta) {
  if (delta == null) return { text: 'sem FIPE', cls: 'neutral' };
  const pct = delta * 100;
  const text = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% FIPE`;
  const cls = DELTA_TIERS.find((t) => delta <= t.max)?.cls || 'neutral';
  return { text, cls };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Gera data URI de SVG como fallback quando o anuncio nao tem photoUrl.
// Memoizado por (brand|model|year) — mesma combinacao reaproveita a string.
// Mantenha em sincronia com src/demo.js carSvg (server serve a versao rica
// nos fixtures; esta aqui e a rede de seguranca pra listagens reais).
const svgCache = new Map();
function carSvgPlaceholder(brand, model, year) {
  const key = `${brand}|${model}|${year}`;
  const cached = svgCache.get(key);
  if (cached) return cached;
  const accent = BRAND_COLORS[brand] || '#4ea1ff';
  const safe = (s) => String(s || '').replace(/[<>&"']/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'><defs><linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1e2636'/><stop offset='1' stop-color='#0a0e18'/></linearGradient></defs><rect width='600' height='400' fill='url(#bg)'/><text x='300' y='200' font-family='system-ui' font-size='36' font-weight='800' fill='#fff' text-anchor='middle'>${safe(brand || 'Carro')}</text><text x='300' y='240' font-family='system-ui' font-size='20' fill='${accent}' text-anchor='middle'>${safe(model || '')} ${year || ''}</text></svg>`;
  const uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  svgCache.set(key, uri);
  return uri;
}

function carKey(car) {
  return `${car.source}:${car.externalId}`;
}

function cardHtml(car) {
  const phone = fmtPhone(car.phone);
  const delta = deltaLabel(car.fipeDelta);
  const key = carKey(car);
  const isFav = favorites.has(key);
  const photoSrc =
    car.photoUrl || carSvgPlaceholder(car.brand, car.model, car.year);
  const redFlags = (car.redFlags || [])
    .slice(0, 3)
    .map((rf) => `<span class="red-flag">${escapeHtml(rf)}</span>`)
    .join('');

  return `
    <article class="card ${isFav ? 'favorite' : ''}" data-key="${escapeHtml(key)}">
      <div class="photo-wrap">
        <img class="photo" src="${escapeHtml(photoSrc)}" alt="${escapeHtml(car.title || '')}" loading="lazy" />
        <span class="source-tag">${escapeHtml(car.source)}</span>
        <button class="fav-btn ${isFav ? 'on' : ''}" aria-label="Favoritar" data-fav="${escapeHtml(key)}">
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

function sortCars(cars, modeKey) {
  const mode = SORT_MODES.find((m) => m.key === modeKey) || SORT_MODES[0];
  return [...cars].sort((a, b) => {
    const fa = favorites.has(carKey(a)) ? 1 : 0;
    const fb = favorites.has(carKey(b)) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return mode.compare(a, b);
  });
}

function renderCars() {
  const sortEl = $('#sort-select');
  const modeKey = sortEl?.value || 'score';
  const sorted = sortCars(currentCars, modeKey);
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

// Muta um unico card ao invez de re-renderizar tudo: evita perder scroll,
// foco e forcar re-decode de imagens.
function updateCardFavorite(cardEl, isFav) {
  cardEl.classList.toggle('favorite', isFav);
  const fav = cardEl.querySelector('.fav-btn');
  if (fav) {
    fav.classList.toggle('on', isFav);
    fav.textContent = isFav ? '★' : '☆';
  }
  if (isFav) results.prepend(cardEl);
}

function toggleFavorite(key) {
  if (favorites.has(key)) favorites.delete(key);
  else favorites.add(key);
  localStorage.setItem('appCarroFavs', JSON.stringify([...favorites]));
}

function renderSourceStatus(stats) {
  const parts = [];
  for (const key of Object.keys(stats || {})) {
    const s = stats[key];
    const cls = s.ok ? 'ok' : 'bad';
    parts.push(
      `<div class="src-chip ${cls}">${escapeHtml(s.label)}: ${s.ok ? s.count : 'indisponivel'}</div>`,
    );
  }
  srcStatus.innerHTML = parts.join('');
}

async function loadHealth() {
  try {
    const r = await fetch('/api/health');
    const d = await r.json();
    const flags = [
      d.region.city + '/' + d.region.state,
      '≥' + d.minYear,
      d.hasAnthropicKey ? 'IA on' : 'IA off',
    ];
    healthEl.className =
      'health ' + (d.demoMode || d.hasAnthropicKey ? 'ok' : 'bad');
    healthEl.innerHTML =
      '<strong>' +
      (d.demoMode ? 'DEMO' : d.hasAnthropicKey ? 'LIVE' : 'IA off') +
      '</strong><br>' +
      escapeHtml(flags.join(' · '));
    if (d.demoMode && !document.querySelector('.demo-banner')) {
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
  results.innerHTML = Array(4).fill('<div class="skeleton-card"></div>').join('');
}

function buildStatusHtml(count) {
  const options = SORT_MODES
    .map((m) => `<option value="${m.key}">${escapeHtml(m.label)}</option>`)
    .join('');
  return (
    `<span class="count">${count} carros encontrados</span>` +
    `<div class="sort-wrap">Ordenar:&nbsp;<select id="sort-select">${options}</select></div>`
  );
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const payload = {};
  for (const [k, v] of fd.entries()) {
    if (!v) continue;
    payload[k] = k === 'maxPrice' || k === 'minYear' ? Number(v) : v;
  }

  searchBtn.disabled = true;
  searchBtn.textContent = 'Buscando…';
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
    statusEl.innerHTML = buildStatusHtml(data.count);
  } catch (err) {
    statusEl.textContent = 'Erro: ' + err.message;
    results.innerHTML = '';
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Buscar';
  }
});

results.addEventListener('click', (e) => {
  const favBtn = e.target.closest('[data-fav]');
  if (!favBtn) return;
  e.preventDefault();
  const key = favBtn.dataset.fav;
  toggleFavorite(key);
  const cardEl = favBtn.closest('.card');
  if (cardEl) updateCardFavorite(cardEl, favorites.has(key));
});

// O #sort-select e recriado a cada busca (via buildStatusHtml), entao
// delegamos do pai #status em vez de rebind.
statusEl.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'sort-select') renderCars();
});

loadHealth();
