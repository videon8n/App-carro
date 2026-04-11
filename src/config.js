import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const config = {
  root: ROOT,
  dataDir: path.join(ROOT, 'data'),
  dbPath: path.join(ROOT, 'data', 'app.db'),
  port: parseInt(process.env.PORT || '3000', 10),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  region: {
    city: process.env.REGION_CITY || 'Campinas',
    state: process.env.REGION_STATE || 'SP',
  },
  minYear: parseInt(process.env.MIN_YEAR || '2018', 10),
  targetMargin: parseFloat(process.env.TARGET_MARGIN || '0.15'),
  sourceTimeoutMs: parseInt(process.env.SOURCE_TIMEOUT_MS || '45000', 10),
  enableFacebook: (process.env.ENABLE_FACEBOOK || 'false') === 'true',
  demoMode: (process.env.DEMO_MODE || 'false') === 'true',
};

// Regiao Metropolitana de Campinas (IBGE). Usada pra filtrar cidades.
export const RMC_CITIES = [
  'Americana',
  'Artur Nogueira',
  'Campinas',
  'Cosmopolis',
  'Cosmópolis',
  'Engenheiro Coelho',
  'Holambra',
  'Hortolandia',
  'Hortolândia',
  'Indaiatuba',
  'Itatiba',
  'Jaguariuna',
  'Jaguariúna',
  'Monte Mor',
  'Morungaba',
  'Nova Odessa',
  'Paulinia',
  'Paulínia',
  'Pedreira',
  'Santa Barbara d Oeste',
  'Santa Bárbara d\'Oeste',
  'Santo Antonio de Posse',
  'Santo Antônio de Posse',
  'Sumare',
  'Sumaré',
  'Valinhos',
  'Vinhedo',
];

const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const RMC_SET = new Set(RMC_CITIES.map(normalize));

export function isInRegion(city) {
  if (!city) return false;
  return RMC_SET.has(normalize(city));
}
