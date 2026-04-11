// Fixtures para DEMO_MODE=true.
// Dados realistas de carros ficticios da regiao de Campinas, com score
// pre-calculado, red flags e preco FIPE. Fotos sao SVG inline (data URI)
// pra renderizar sempre, sem depender de hosts externos.

// Cores de marca pra personalizar o placeholder SVG de cada carro.
const BRAND_COLORS = {
  Toyota: '#eb0a1e',
  Honda: '#cc0000',
  Jeep: '#2b7a3a',
  Volkswagen: '#2a6ba8',
  Chevrolet: '#f0b400',
  Hyundai: '#3a7bd5',
  Fiat: '#9e2a3c',
  Renault: '#ffc533',
  Ford: '#1f5ea8',
  Nissan: '#c8102e',
};

// Gera um "foto" placeholder em SVG pra um carro.
// Retorna data URI pronta pra usar em <img src="...">.
function carSvg(brand, model, year) {
  const accent = BRAND_COLORS[brand] || '#4ea1ff';
  const safe = (s) => String(s || '').replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  }[c]));
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'>
<defs>
<linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'>
<stop offset='0' stop-color='#1e2636'/>
<stop offset='1' stop-color='#0a0e18'/>
</linearGradient>
<radialGradient id='glow' cx='50%' cy='70%' r='60%'>
<stop offset='0' stop-color='${accent}' stop-opacity='0.25'/>
<stop offset='1' stop-color='${accent}' stop-opacity='0'/>
</radialGradient>
</defs>
<rect width='600' height='400' fill='url(#bg)'/>
<rect width='600' height='400' fill='url(#glow)'/>
<g transform='translate(80 200)'>
<path d='M 30 80 Q 40 35 85 22 L 145 5 Q 195 -5 260 -5 Q 325 -5 370 8 L 410 22 Q 445 32 452 70 L 458 105 Q 458 120 445 120 L 425 120 Q 418 150 395 150 Q 372 150 365 120 L 125 120 Q 118 150 95 150 Q 72 150 65 120 L 42 120 Q 28 120 28 105 Z' fill='${accent}' fill-opacity='0.22' stroke='${accent}' stroke-width='2' stroke-opacity='0.55'/>
<path d='M 100 30 L 150 8 Q 200 0 260 0 Q 320 0 370 12 L 400 28 Q 410 60 395 75 L 85 75 Q 75 60 100 30 Z' fill='${accent}' fill-opacity='0.12'/>
<circle cx='95' cy='125' r='22' fill='#0a0e18' stroke='${accent}' stroke-width='3'/>
<circle cx='95' cy='125' r='8' fill='${accent}' fill-opacity='0.4'/>
<circle cx='395' cy='125' r='22' fill='#0a0e18' stroke='${accent}' stroke-width='3'/>
<circle cx='395' cy='125' r='8' fill='${accent}' fill-opacity='0.4'/>
</g>
<text x='300' y='70' font-family='system-ui,-apple-system,sans-serif' font-size='36' font-weight='800' fill='#ffffff' text-anchor='middle' letter-spacing='-0.5'>${safe(brand)}</text>
<text x='300' y='105' font-family='system-ui,-apple-system,sans-serif' font-size='22' font-weight='500' fill='${accent}' text-anchor='middle'>${safe(model)} · ${year}</text>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export const DEMO_CARS = [
  {
    source: 'webmotors',
    externalId: 'demo:1',
    url: 'https://www.webmotors.com.br/comprar/toyota/corolla/demo-1',
    title: 'Toyota Corolla XEI 2.0 Flex 2020 Automatico',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2020,
    km: 45000,
    price: 98900,
    phone: '19998887766',
    city: 'Campinas',
    description:
      'Unico dono, revisoes em dia na concessionaria, IPVA 2026 pago, pneus novos. Motivo da venda: comprando maior. Aceito troca por carro de menor valor.',
    photoUrl: carSvg('Toyota', 'Corolla XEI', 2020),
    fipePrice: 109500,
    fipeDelta: -0.0968,
    score: 92,
    reason:
      'Oportunidade forte: 9,7% abaixo da FIPE, km/ano baixa, unico dono e modelo com alta saida na regiao.',
    redFlags: [],
    firstSeenAt: Date.now() - 3 * 60 * 60 * 1000,
    lastSeenAt: Date.now(),
  },
  {
    source: 'olx',
    externalId: 'demo:2',
    url: 'https://www.olx.com.br/item/demo-2',
    title: 'Honda HR-V EXL 1.8 CVT 2021',
    brand: 'Honda',
    model: 'HR-V',
    year: 2021,
    km: 38000,
    price: 124500,
    phone: '19987654321',
    city: 'Valinhos',
    description:
      'Carro de mulher, garagem, nunca batido, sem detalhes. Revisoes Honda. Manuais e duas chaves.',
    photoUrl: carSvg('Honda', 'HR-V EXL', 2021),
    fipePrice: 132000,
    fipeDelta: -0.0568,
    score: 86,
    reason:
      'Bom preco vs FIPE (-5,7%), marca de alta saida, km coerente com o ano e sem red flags.',
    redFlags: [],
    firstSeenAt: Date.now() - 6 * 60 * 60 * 1000,
    lastSeenAt: Date.now(),
  },
  {
    source: 'mercadolivre',
    externalId: 'demo:3',
    url: 'https://produto.mercadolivre.com.br/demo-3',
    title: 'Jeep Renegade Sport 1.8 Flex 2019',
    brand: 'Jeep',
    model: 'Renegade',
    year: 2019,
    km: 72000,
    price: 78900,
    phone: '19996541234',
    city: 'Sumare',
    description:
      'Segundo dono, IPVA atrasado (2024 e 2025), precisa resolver. Aceita troca por moto. Sem detalhes mecanicos.',
    photoUrl: carSvg('Jeep', 'Renegade', 2019),
    fipePrice: 82000,
    fipeDelta: -0.0378,
    score: 58,
    reason:
      'Preco razoavel, mas IPVA atrasado significa custo extra de R$ 4-6k pra regularizar. Verifica debitos antes.',
    redFlags: ['IPVA atrasado (2 anos)', 'Aceita troca por moto'],
    firstSeenAt: Date.now() - 12 * 60 * 60 * 1000,
    lastSeenAt: Date.now(),
  },
  {
    source: 'olx',
    externalId: 'demo:4',
    url: 'https://www.olx.com.br/item/demo-4',
    title: 'Volkswagen T-Cross Highline 1.4 TSI 2022',
    brand: 'Volkswagen',
    model: 'T-Cross',
    year: 2022,
    km: 28000,
    price: 132000,
    phone: '19991112233',
    city: 'Indaiatuba',
    description:
      'Carro impecavel, teto panoramico, bancos de couro, central multimidia. Revisoes em concessionaria. Garantia de fabrica ate 2026.',
    photoUrl: carSvg('Volkswagen', 'T-Cross', 2022),
    fipePrice: 139000,
    fipeDelta: -0.0504,
    score: 81,
    reason:
      'Carro novo, bem preservado, 5% abaixo da FIPE, modelo quente. Garantia ainda ativa e um diferencial.',
    redFlags: [],
    firstSeenAt: Date.now() - 2 * 60 * 60 * 1000,
    lastSeenAt: Date.now(),
  },
  {
    source: 'webmotors',
    externalId: 'demo:5',
    url: 'https://www.webmotors.com.br/demo-5',
    title: 'Chevrolet Onix LT 1.0 Turbo 2019',
    brand: 'Chevrolet',
    model: 'Onix',
    year: 2019,
    km: 98000,
    price: 62900,
    phone: '19992345678',
    city: 'Hortolandia',
    description:
      'Motor com pequeno ruido, precisa de revisao. Foi usado como Uber por 2 anos. Documentacao ok.',
    photoUrl: carSvg('Chevrolet', 'Onix LT', 2019),
    fipePrice: 68500,
    fipeDelta: -0.0817,
    score: 32,
    reason:
      'Preco tentador mas red flags pesados: motor com ruido e historico de Uber significam desgaste alto e risco de problema mecanico grande.',
    redFlags: [
      'Motor com ruido declarado',
      'Foi Uber (alta quilometragem)',
      'KM alta para o ano',
    ],
    firstSeenAt: Date.now() - 24 * 60 * 60 * 1000,
    lastSeenAt: Date.now(),
  },
  {
    source: 'mercadolivre',
    externalId: 'demo:6',
    url: 'https://produto.mercadolivre.com.br/demo-6',
    title: 'Hyundai HB20 Comfort Plus 1.6 2020',
    brand: 'Hyundai',
    model: 'HB20',
    year: 2020,
    km: 52000,
    price: 68500,
    phone: '19994445566',
    city: 'Paulinia',
    description:
      'Carro de familia, bem cuidado, revisoes feitas. Pneus recentes. Aceito financiamento.',
    photoUrl: carSvg('Hyundai', 'HB20', 2020),
    fipePrice: 71000,
    fipeDelta: -0.0352,
    score: 74,
    reason:
      'Preco justo, marca popular na regiao, sem red flags. Margem apertada mas giro rapido compensa.',
    redFlags: [],
    firstSeenAt: Date.now() - 8 * 60 * 60 * 1000,
    lastSeenAt: Date.now(),
  },
  {
    source: 'olx',
    externalId: 'demo:7',
    url: 'https://www.olx.com.br/item/demo-7',
    title: 'Fiat Toro Freedom 1.8 AT 2021',
    brand: 'Fiat',
    model: 'Toro',
    year: 2021,
    km: 61000,
    price: 109900,
    phone: '19993332211',
    city: 'Campinas',
    description:
      'Toro em estado de nova, sem detalhes. Unica dona, todas revisoes na Fiat. 4 pneus novos, tapete de borracha, protetor de cacamba.',
    photoUrl: carSvg('Fiat', 'Toro', 2021),
    fipePrice: 117500,
    fipeDelta: -0.0723,
    score: 88,
    reason:
      'Picape com otima saida na regiao, 7% abaixo da FIPE, unica dona e estado excelente. Compra solida.',
    redFlags: [],
    firstSeenAt: Date.now() - 1 * 60 * 60 * 1000,
    lastSeenAt: Date.now(),
  },
  {
    source: 'webmotors',
    externalId: 'demo:8',
    url: 'https://www.webmotors.com.br/demo-8',
    title: 'Renault Kwid Zen 1.0 2019',
    brand: 'Renault',
    model: 'Kwid',
    year: 2019,
    km: 43000,
    price: 41900,
    phone: '19990001122',
    city: 'Itatiba',
    description: 'Carro basico, bom para uber, economico. Ja foi batido na traseira, reparado.',
    photoUrl: carSvg('Renault', 'Kwid', 2019),
    fipePrice: 44500,
    fipeDelta: -0.0584,
    score: 41,
    reason:
      'Preco ok mas historico de sinistro reduz valor de revenda. Se conseguir baixar mais 10%, vira oportunidade.',
    redFlags: ['Ja foi batido (traseira)'],
    firstSeenAt: Date.now() - 18 * 60 * 60 * 1000,
    lastSeenAt: Date.now(),
  },
];

export function getDemoResponse() {
  const cars = [...DEMO_CARS].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return {
    ok: true,
    count: cars.length,
    elapsedMs: 420,
    demo: true,
    stats: {
      olx: { label: 'OLX', count: 3, ok: true },
      webmotors: { label: 'Webmotors', count: 3, ok: true },
      mercadolivre: { label: 'Mercado Livre', count: 2, ok: true },
      facebook: { label: 'Facebook Marketplace', count: 0, ok: false, error: 'Modo demo — FB desativado' },
    },
    errors: [],
    cars,
  };
}
