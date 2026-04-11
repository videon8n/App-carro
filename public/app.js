const $ = (sel) => document.querySelector(sel);
const form = $('#search-form');
const btn = $('#search-btn');
const statusEl = $('#status');
const results = $('#results');
const srcStatus = $('#source-status');
const healthEl = $('#health');

const fmtBRL = (n) =>
  n == null
    ? '—'
    : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

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
  if (s >= 90) return 's90';
  if (s >= 70) return 's70';
  if (s >= 50) return 's50';
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

function cardHtml(car) {
  const phone = fmtPhone(car.phone);
  const delta = deltaLabel(car.fipeDelta);
  const redFlags = (car.redFlags || [])
    .map((rf) => `<span class="red-flag">${escapeHtml(rf)}</span>`)
    .join('');

  const photo = car.photoUrl
    ? `<img class="photo" src="${escapeHtml(car.photoUrl)}" alt="${escapeHtml(car.title || '')}" loading="lazy" onerror="this.outerHTML='<div class=&quot;photo placeholder&quot;>sem foto</div>'" />`
    : `<div class="photo placeholder">sem foto</div>`;

  return `
    <article class="card">
      <div class="photo-wrap">
        ${photo}
        <span class="source-tag">${escapeHtml(car.source)}</span>
      </div>
      <div class="body">
        <div class="title">${escapeHtml(car.title || 'Sem titulo')}</div>
        <div class="meta">
          <span>${car.year ?? '—'}</span>
          <span>${fmtKm(car.km)}</span>
          <span>${escapeHtml(car.city || '—')}</span>
        </div>
        <div class="price">
          <div class="amount">${fmtBRL(car.price)}</div>
          <div class="delta ${delta.cls}">${delta.text}</div>
        </div>
        ${car.fipePrice ? `<div class="fipe">FIPE: ${fmtBRL(car.fipePrice)}</div>` : ''}
        <div class="score-row">
          <div class="score-badge ${scoreClass(car.score)}">${car.score ?? '—'}</div>
          <div class="reason">${escapeHtml(car.reason || 'sem avaliacao')}</div>
        </div>
        ${redFlags ? `<div class="red-flags">${redFlags}</div>` : ''}
        <div class="actions">
          ${phone ? `<a class="btn primary" href="tel:${phone.replace(/\D/g, '')}">Ligar ${phone}</a>` : `<span class="btn" style="opacity:.5">sem telefone</span>`}
          <a class="btn" href="${escapeHtml(car.url)}" target="_blank" rel="noopener">Ver anuncio</a>
        </div>
      </div>
    </article>
  `;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSourceStatus(stats, errors) {
  const parts = [];
  for (const key of Object.keys(stats || {})) {
    const s = stats[key];
    const cls = s.ok ? 'ok' : 'bad';
    parts.push(
      `<div class="src-chip ${cls}">${escapeHtml(s.label)}: ${s.ok ? `${s.count} resultados` : 'indisponivel'}</div>`,
    );
  }
  srcStatus.innerHTML = parts.join('');
}

async function loadHealth() {
  try {
    const r = await fetch('/api/health');
    const d = await r.json();
    const parts = [
      `Regiao: ${d.region.city}/${d.region.state}`,
      `Ano min: ${d.minYear}`,
      d.hasAnthropicKey ? 'IA ligada' : 'IA DESLIGADA',
      d.facebookEnabled ? 'FB ligado' : 'FB off',
    ];
    healthEl.className = 'health ' + (d.hasAnthropicKey ? 'ok' : 'bad');
    healthEl.textContent = parts.join(' · ');
  } catch {
    healthEl.className = 'health bad';
    healthEl.textContent = 'server off';
  }
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
  statusEl.textContent = 'Buscando nas fontes… pode levar 20-60s.';
  results.innerHTML = '';
  srcStatus.innerHTML = '';

  try {
    const r = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'erro');

    renderSourceStatus(data.stats, data.errors);
    statusEl.textContent = `${data.count} carros encontrados em ${(data.elapsedMs / 1000).toFixed(1)}s (ordenados por score da IA).`;

    if (data.cars.length === 0) {
      results.innerHTML =
        '<div style="color:var(--muted);padding:20px;">Nenhum carro encontrado. Tente sem filtros ou aguarde — algumas fontes podem estar bloqueando.</div>';
    } else {
      results.innerHTML = data.cars.map(cardHtml).join('');
    }
  } catch (err) {
    statusEl.textContent = 'Erro: ' + err.message;
  } finally {
    btn.disabled = false;
  }
});

loadHealth();
