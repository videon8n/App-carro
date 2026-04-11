// Helpers pra extrair dados estruturados de texto livre de anuncios.

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Extrai preco em reais de uma string.
 * Aceita "R$ 89.900", "89.900,00", "R$89900", "89 mil", etc.
 */
export function parsePrice(input) {
  if (input == null) return null;
  if (typeof input === 'number') return input > 0 ? input : null;

  const s = String(input).toLowerCase().replace(/\s+/g, ' ').trim();

  // "89 mil" / "89.5 mil"
  const milMatch = s.match(/([\d.,]+)\s*mil/);
  if (milMatch) {
    const n = parseFloat(milMatch[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(n)) return Math.round(n * 1000);
  }

  // "R$ 89.900,00" ou "89.900"
  const cleaned = s.replace(/r\$|\s/g, '');
  // Remove separadores de milhar (pontos) e troca virgula decimal por ponto
  const numeric = cleaned.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = parseFloat(numeric);
  if (!isNaN(n) && n > 1000) return Math.round(n);
  return null;
}

/**
 * Extrai ano (4 digitos) ou ano de modelo formato "2019/2020".
 * Retorna o ano MODELO (segundo numero, quando presente).
 */
export function parseYear(input) {
  if (input == null) return null;
  if (typeof input === 'number') {
    return input >= 1900 && input <= CURRENT_YEAR + 1 ? input : null;
  }
  const s = String(input);

  // "2019/2020" -> 2020
  const pair = s.match(/(19|20)\d{2}\s*\/\s*((19|20)\d{2})/);
  if (pair) return parseInt(pair[2], 10);

  const single = s.match(/(19|20)\d{2}/);
  if (single) {
    const y = parseInt(single[0], 10);
    if (y >= 1900 && y <= CURRENT_YEAR + 1) return y;
  }
  return null;
}

/**
 * Extrai quilometragem. Aceita "45.000 km", "45000km", "45 mil km".
 */
export function parseKm(input) {
  if (input == null) return null;
  if (typeof input === 'number') return input >= 0 ? input : null;
  // Remove telefones pra nao capturar seus digitos como km
  let s = String(input).toLowerCase();
  s = s.replace(/(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]?)\d{4,5}[\s.-]?\d{4}/g, ' ');

  const milKm = s.match(/(\d[\d.,]*)\s*mil\s*(km|quil)/);
  if (milKm) {
    const n = parseFloat(milKm[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(n)) return Math.round(n * 1000);
  }

  // Numero ANTES de "km" (com word boundary pra evitar pegar sufixo de outro numero)
  const before = s.match(/(?:^|[^\d.])(\d[\d.]*)\s*(?:km|quil[oô]metr)/);
  if (before) {
    const n = parseInt(before[1].replace(/\./g, ''), 10);
    if (!isNaN(n)) return n;
  }

  // Numero DEPOIS de "km" ("km: 45.000")
  const after = s.match(/(?:km|quil[oô]metr)[:\s]+(\d[\d.]*)/);
  if (after) {
    const n = parseInt(after[1].replace(/\./g, ''), 10);
    if (!isNaN(n)) return n;
  }
  return null;
}

/**
 * Extrai primeiro telefone BR encontrado no texto.
 * Padroes: (19) 99999-9999, 19999999999, +55 19 99999 9999
 */
export function parsePhone(input) {
  if (!input) return null;
  const s = String(input);
  // Captura 10 ou 11 digitos com ou sem mascara
  const re = /(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]?)\d{4,5}[\s.-]?\d{4}/g;
  const matches = s.match(re);
  if (!matches || matches.length === 0) return null;
  // Escolhe o primeiro, limpa tudo que nao e digito
  const digits = matches[0].replace(/\D/g, '');
  // Remove prefixo 55 se tiver 12 ou 13 digitos
  let phone = digits;
  if (phone.length === 13 && phone.startsWith('55')) phone = phone.slice(2);
  if (phone.length === 12 && phone.startsWith('55')) phone = phone.slice(2);
  if (phone.length < 10 || phone.length > 11) return null;
  return phone;
}

/**
 * Formata telefone BR pra exibicao: "(19) 99999-9999".
 */
export function formatPhone(phone) {
  if (!phone) return '';
  const d = String(phone).replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

// Marcas mais comuns no Brasil + modelos populares pra heuristica de parsing.
const BRANDS = [
  'Chevrolet', 'Volkswagen', 'Fiat', 'Ford', 'Toyota', 'Hyundai', 'Renault',
  'Honda', 'Nissan', 'Jeep', 'Peugeot', 'Citroen', 'Citroën', 'Kia', 'Mitsubishi',
  'BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Volvo', 'Land Rover', 'Subaru',
  'Suzuki', 'Caoa Chery', 'Chery', 'BYD', 'GWM', 'Ram', 'Dodge', 'Mini',
];

/**
 * Tenta extrair (brand, model) de um titulo de anuncio.
 * Ex: "Toyota Corolla XEI 2.0 Flex 2020" -> { brand: 'Toyota', model: 'Corolla' }
 */
export function parseBrandModel(title) {
  if (!title) return { brand: null, model: null };
  const s = String(title).trim();
  for (const brand of BRANDS) {
    const re = new RegExp(`\\b${brand}\\b`, 'i');
    if (re.test(s)) {
      // Modelo = proxima palavra nao-numerica depois da marca
      const after = s.replace(re, '').trim().split(/[\s,./-]+/);
      const model = after.find((w) => w && !/^\d/.test(w) && w.length > 1);
      return { brand, model: model || null };
    }
  }
  // Fallback: primeira palavra e "marca", segunda e "modelo"
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { brand: parts[0], model: parts[1] };
  }
  return { brand: null, model: null };
}

/**
 * Normaliza uma listing crua de qualquer source pra forma canonica.
 * Campos minimos esperados: source, externalId, url, title, price.
 */
export function normalizeListing(raw) {
  const title = raw.title || '';
  const description = raw.description || '';
  const textAll = `${title} ${description}`;

  const { brand, model } = raw.brand
    ? { brand: raw.brand, model: raw.model }
    : parseBrandModel(title);

  return {
    source: raw.source,
    externalId: String(raw.externalId),
    url: raw.url,
    title: title || null,
    brand: brand || null,
    model: model || null,
    year: raw.year ?? parseYear(textAll),
    km: raw.km ?? parseKm(textAll),
    price: raw.price != null ? parsePrice(raw.price) : null,
    phone: raw.phone ? parsePhone(raw.phone) : parsePhone(textAll),
    city: raw.city || null,
    description: description || null,
    photoUrl: raw.photoUrl || null,
  };
}
