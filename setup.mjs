#!/usr/bin/env node
// Setup script multiplataforma — funciona no Mac, Linux e Windows.
// Uso: `node setup.mjs` ou `npm run setup`

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

const log = (msg) => console.log(`${C.blue}==>${C.reset} ${msg}`);
const ok = (msg) => console.log(`${C.green}  ✓${C.reset} ${msg}`);
const warn = (msg) => console.log(`${C.yellow}  !${C.reset} ${msg}`);
const fail = (msg) => {
  console.error(`${C.red}ERRO:${C.reset} ${msg}`);
  process.exit(1);
};

console.log(`${C.bold}App-carro — setup${C.reset}\n`);

// 1. Node version check
const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  fail(
    `Node v${process.versions.node} detectado. Precisa de Node 20+.\n` +
    `   Baixe em https://nodejs.org (versao LTS)`,
  );
}
ok(`Node v${process.versions.node}`);

// 2. Check for package.json (sanity)
if (!fs.existsSync('package.json')) {
  fail('package.json nao encontrado. Rode este script a partir da raiz do App-carro.');
}

// 3. Install dependencies
log('Instalando dependencias (pode levar 1-2 min na primeira vez)...');
try {
  execSync('npm install', {
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' },
  });
  ok('Dependencias instaladas');
} catch {
  fail('npm install falhou. Verifique a conexao e tente de novo.');
}

// 4. Create .env from template
if (!fs.existsSync('.env')) {
  if (!fs.existsSync('.env.example')) {
    fail('.env.example nao encontrado');
  }
  fs.copyFileSync('.env.example', '.env');
  ok('.env criado a partir de .env.example');
  console.log(`   ${C.dim}Modo DEMO esta ligado por padrao (8 carros ficticios).${C.reset}`);
  console.log(`   ${C.dim}Pra dados reais, edite .env e troque:${C.reset}`);
  console.log(`   ${C.dim}  DEMO_MODE=false${C.reset}`);
  console.log(`   ${C.dim}  ANTHROPIC_API_KEY=sk-ant-...${C.reset}`);
} else {
  warn('.env ja existe, pulando (nao sobrescrevo)');
}

// 5. Create data directory if missing
if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
  ok('Pasta data/ criada (SQLite vai viver ai)');
}

// 6. Done
console.log();
console.log(`${C.green}${C.bold}Setup completo!${C.reset}\n`);
console.log(`  ${C.bold}Desenvolvimento${C.reset} (auto-reload quando salva arquivo):`);
console.log(`      npm run dev\n`);
console.log(`  ${C.bold}Producao${C.reset}:`);
console.log(`      npm start\n`);
console.log(`  ${C.bold}Atualizar do GitHub${C.reset}:`);
console.log(`      npm run sync\n`);
console.log(`  Abrir: ${C.blue}http://localhost:3000${C.reset}\n`);
