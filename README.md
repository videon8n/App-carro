# App-carro

Agregador inteligente de carros usados para estacionamento em Campinas e
região. Busca anúncios em OLX, Webmotors, Mercado Livre e Facebook
Marketplace, enriquece com tabela FIPE e usa a **Claude API** (Anthropic)
pra dar uma nota de 0–100 a cada oportunidade de compra, ordenando a lista
pelas melhores.

Filtro hard: carros de **2018 ou mais novos**, na **Região Metropolitana
de Campinas**.

## 🚀 Quickstart (roda no seu computador)

Pré-requisitos: **Node.js 20+** (baixe em <https://nodejs.org>, versão LTS).

```bash
git clone https://github.com/videon8n/App-carro
cd App-carro
npm run setup      # instala deps, cria .env, prepara data/
npm run dev        # auto-reload quando qualquer arquivo muda
```

Abra <http://localhost:3000>. **O modo DEMO já vem ligado** por padrão —
você vê os 8 carros fictícios sem precisar de chave da API.

**Pra usar dados reais** (scraping real + IA avaliando):

1. Edite `.env`
2. Troque `DEMO_MODE=true` por `DEMO_MODE=false`
3. Preencha `ANTHROPIC_API_KEY=sk-ant-...` (pega em <https://console.anthropic.com>)
4. Reinicie o `npm run dev`

### Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run setup` | Setup inicial: checa Node, instala deps, cria `.env` |
| `npm run dev` | Server em modo desenvolvimento, auto-reload ao salvar |
| `npm start` | Server em modo produção (sem watch) |
| `npm run sync` | Puxa a versão mais nova do GitHub + `npm install` |

### Estrutura do projeto

```
App-carro/
├── server.js                  # Express: /api/search, /api/health, /api/cars
├── setup.mjs                  # Setup multiplataforma (Node-only)
├── public/                    # Frontend: HTML + CSS + JS vanilla
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── config.js              # .env + lista de cidades da RMC
│   ├── db.js                  # SQLite: schema + upsert + cache
│   ├── demo.js                # 8 carros fictícios com SVG inline
│   ├── normalize.js           # parsers: preço, ano, km, telefone
│   ├── fipe.js                # cliente FIPE público + cache 7 dias
│   ├── intelligence.js        # Claude API com prompt caching + adaptive thinking
│   └── sources/               # 4 adaptadores: OLX, Webmotors, ML, FB
└── data/app.db                # SQLite (criado em runtime)
```

## Avisos importantes

- **OLX, Webmotors, Mercado Livre e Facebook proíbem scraping nos Termos
  de Uso.** Os adaptadores são _best-effort_ e podem quebrar a qualquer
  momento (mudança de HTML, bloqueio de IP, captcha). Use por sua conta
  e risco.
- **Facebook Marketplace** é o mais frágil. Frequentemente exige login e
  retorna vazio. Isso é esperado; a UI mostra um chip "indisponível".
- A avaliação da IA **não substitui vistoria presencial**. Use a nota só
  pra priorizar quais telefones ligar primeiro.

## Requisitos

- Node.js 20+
- Chave da API Anthropic (pega em <https://console.anthropic.com/>)

## Instalação

```bash
npm install
npx playwright install chromium   # só se for usar o adaptador Facebook
cp .env.example .env
# edite .env e preencha ANTHROPIC_API_KEY
```

## Rodar

```bash
npm start
```

Abra <http://localhost:3000> no navegador. Clique **Buscar** (pode deixar
os filtros vazios). A primeira busca leva 20–60s — fontes rodam em
paralelo e a IA pontua em batches.

## Rodar no celular via Replit (mais rápido pra visualizar)

Se você só quer **ver a cara do app no celular**, sem instalar nada:

1. Abre <https://replit.com> no navegador do celular, cria conta grátis.
2. **Create Repl** → **Import from GitHub** → cola a URL:
   `https://github.com/videon8n/app-carro`
3. Seleciona a branch `claude/car-marketplace-aggregator-E2ZZx`.
4. O Replit lê o `.replit` do repo automaticamente e já configura Node 20,
   `DEMO_MODE=true` (mostra fixtures) e `ENABLE_FACEBOOK=false`.
5. Aperta **Run**. Primeira execução instala deps (~1 min).
6. O Replit abre uma aba "Webview" com o app rodando. Dá pra abrir também
   numa URL pública tipo `https://app-carro.<seu-user>.repl.co`.

### Por que modo demo no Replit?

Os IPs do Replit/Vercel/Railway/etc são de datacenter e ficam **bloqueados
pelos anti-bots** da OLX, Webmotors e Mercado Livre. Então o scraping real
quase sempre devolve zero resultados. O **modo demo** retorna 8 carros
fictícios (Corolla, HR-V, T-Cross, Toro, Renegade…) com score pré-calculado,
red flags e FIPE delta, pra você ver exatamente como a UI se comporta.

### Ligar o scraping real no Replit (opcional)

Se quiser tentar mesmo assim:
- Tab **Secrets** (ícone de cadeado na barra lateral)
- Adiciona `DEMO_MODE` = `false`
- Adiciona `ANTHROPIC_API_KEY` = sua chave
- Reroda

Taxa de sucesso esperada: **baixa** (ver nota sobre IPs de datacenter).
Pra scraping estável, rode local (IP residencial) ou use Cloudflare Tunnel.

## Configuração

Via `.env`:

| Variável            | Padrão               | O que faz                                |
|---------------------|----------------------|------------------------------------------|
| `ANTHROPIC_API_KEY` | —                    | Chave da Claude API (obrigatória p/ IA)  |
| `ANTHROPIC_MODEL`   | `claude-sonnet-4-6`  | Modelo usado                             |
| `PORT`              | `3000`               | Porta do servidor                        |
| `REGION_CITY`       | `Campinas`           | Cidade base                              |
| `REGION_STATE`      | `SP`                 | Estado                                   |
| `MIN_YEAR`          | `2018`               | Ano mínimo dos carros                    |
| `TARGET_MARGIN`     | `0.15`               | Margem alvo de revenda (usada no prompt) |
| `SOURCE_TIMEOUT_MS` | `45000`              | Timeout por fonte                        |
| `ENABLE_FACEBOOK`   | `false`              | Liga/desliga adaptador FB Marketplace    |
| `DEMO_MODE`         | `false`              | Retorna fixtures em vez de scraping real |

## Arquitetura

```
App-carro/
├── server.js               # Express: rotas /api/search, /api/health, /api/cars
├── public/                 # UI: HTML + CSS + JS vanilla
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── config.js           # .env + lista de cidades da RMC
│   ├── db.js               # SQLite (better-sqlite3): schema + upsert + cache
│   ├── normalize.js        # parsers: preço, ano, km, telefone, marca/modelo
│   ├── fipe.js             # cliente FIPE público + cache 7 dias
│   ├── intelligence.js     # cliente Claude API com prompt caching
│   └── sources/
│       ├── index.js        # runner paralelo com Promise.allSettled
│       ├── olx.js
│       ├── webmotors.js
│       ├── mercadolivre.js
│       └── facebook.js     # Playwright, best-effort
└── data/app.db             # SQLite, criado em runtime
```

### Fluxo de uma busca

1. Usuário clica **Buscar** → `POST /api/search`.
2. `sources/index.js` dispara os 4 adaptadores em paralelo.
3. Listings são normalizadas (`src/normalize.js`) para um formato canônico.
4. Filtro hard: `year >= MIN_YEAR`, cidade na RMC, preço > R$ 5.000.
5. `fipe.js` busca preço FIPE pra cada carro (cache 7 dias).
6. Dados persistidos em SQLite (upsert por `(source, externalId)`).
7. `intelligence.js` chama Claude em batches de 20, com `cache_control`
   no system prompt — primeiro request paga os tokens, os seguintes
   reaproveitam do cache e ficam baratos.
8. Resposta ordenada por `score desc`.
9. Frontend renderiza cards com foto, preço, FIPE, delta, nota, red
   flags, e botão **Ligar** (`tel:` link).

## Roadmap

O plano completo de melhorias pós-MVP está em
`/root/.claude/plans/purrfect-sleeping-swan.md` (se você tem acesso ao
plano) ou pode ser resumido assim:

- **Mais fontes**: iCarros, Chave na Mão, Kavak, Telegram, leilões.
- **Histórico de preço** e tempo no mercado (sinal forte de urgência).
- **Deduplicação cross-source** (mesmo carro em vários sites).
- **Análise de fotos** com modelo de visão pra detectar batidas.
- **Pipeline de leads** (CRM: contactado → visitado → comprado).
- **Consulta de placa** e detecção de fraude.
- **Estoque próprio** + gerador de anúncio IA + dashboard financeiro.
- **PWA / app mobile**, notificações push, busca salva com alertas.
- **LGPD** e auditoria de acesso a dados pessoais dos vendedores.

Veja o arquivo de plano para a lista completa (60+ itens categorizados
em A–H com estimativa de esforço).

## Troubleshooting

- **Todas as fontes retornam 0**: provavelmente seu IP está bloqueado.
  Tente rodar de uma rede diferente ou aguarde alguns minutos.
- **Facebook sempre vazio**: normal. FB exige login. Deixe
  `ENABLE_FACEBOOK=false` se quiser acelerar as buscas.
- **Erro ao chamar Claude**: verifique `ANTHROPIC_API_KEY` no `.env` e
  se tem crédito na conta. O app continua funcionando sem IA, só sem
  score.
- **FIPE retorna null pra muitos carros**: o matcher de marca/modelo é
  heurístico. Melhorias futuras vão incluir um mapeamento mais robusto.
