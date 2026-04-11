// Adaptador Facebook Marketplace.
//
// ATENCAO: Facebook bloqueia scraping agressivamente e proibe em ToS.
// Esse adaptador roda em modo best-effort com Playwright headless, sem
// autenticacao. Em muitos casos ele vai retornar array vazio ou lancar erro
// (Facebook pede login) — isso e ESPERADO e tratado no runner.
//
// Para obter mais resultados, seria necessario manter uma sessao autenticada,
// o que tem alto risco de ban de conta. Nao recomendado.

import { config } from '../config.js';

const URL_BASE = 'https://www.facebook.com/marketplace';

export async function fetchFacebook(filters = {}) {
  // Import dinamico: playwright-chromium e optional dependency.
  // Se nao estiver instalado, o runner pega o throw e marca a fonte como indisponivel.
  let chromium;
  try {
    ({ chromium } = await import('playwright-chromium'));
  } catch {
    throw new Error('playwright-chromium nao instalado (npx playwright install chromium)');
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      locale: 'pt-BR',
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();

    // Marketplace por categoria "vehicles" + filtros de ano + preco + cidade
    // A UI do FB muda constantemente; este e best-effort.
    const url =
      `${URL_BASE}/campinas/vehicles?` +
      `minYear=${config.minYear}&sortBy=creation_time_descend&exact=false`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Se o FB redirecionar pra login, abortamos
    if (/login/.test(page.url())) {
      throw new Error('Facebook exigiu login — fonte indisponivel sem sessao');
    }

    // Rolar um pouco pra carregar lazy-loaded cards
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(800);
    }

    // Extrai cards. Seletores do FB sao ofuscados, usamos atributos semanticos.
    const items = await page.evaluate(() => {
      const out = [];
      const seen = new Set();
      const links = document.querySelectorAll('a[href*="/marketplace/item/"]');
      links.forEach((a) => {
        const href = a.getAttribute('href') || '';
        const m = href.match(/\/marketplace\/item\/(\d+)/);
        if (!m) return;
        if (seen.has(m[1])) return;
        seen.add(m[1]);
        const container = a.closest('[role="article"]') || a;
        const text = container.innerText || '';
        const img = container.querySelector('img');
        out.push({
          id: m[1],
          href: 'https://www.facebook.com' + href.split('?')[0],
          text,
          img: img ? img.getAttribute('src') : null,
        });
      });
      return out.slice(0, 60);
    });

    return items.map((it) => {
      const lines = it.text.split('\n').map((s) => s.trim()).filter(Boolean);
      const price = lines.find((l) => /R\$/.test(l));
      const title = lines.find((l) => !/R\$/.test(l) && l.length > 5);
      const city = lines.find((l) => /campinas|valinhos|vinhedo|indaiatuba|paulinia|hortol|sumar|americana|itatiba|indai/i.test(l));
      return {
        externalId: `fb:${it.id}`,
        url: it.href,
        title,
        price,
        city,
        description: it.text,
        photoUrl: it.img,
      };
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
