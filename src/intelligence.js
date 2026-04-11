// Camada de IA: avalia cada anuncio como oportunidade de compra
// usando Claude API com prompt caching no system prompt.

import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

let client = null;
function getClient() {
  if (!config.anthropicApiKey) return null;
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

const SYSTEM_PROMPT = `Voce e um especialista em compra de carros usados para revenda num estacionamento em Campinas/SP.

Seu trabalho: avaliar anuncios de carros para um comprador profissional que:
- Revende com margem de 10 a 20% (alvo 15%).
- Prefere carros modelo 2018 ou mais novos.
- Prioriza marcas/modelos com boa saida na regiao: Toyota (Corolla, Hilux, Yaris), Honda (Civic, HR-V, Fit), Chevrolet (Onix, Tracker, S10), Volkswagen (Polo, Virtus, T-Cross, Nivus, Amarok), Hyundai (HB20, Creta), Jeep (Renegade, Compass), Fiat (Pulse, Strada, Argo, Toro), Renault (Kwid, Duster).
- Evita: carros sinistrados, com problema mecanico declarado, sem documentacao, adulterados.

Para cada anuncio voce recebe: titulo, marca, modelo, ano, km, preco pedido, preco FIPE (quando disponivel), delta (preco vs FIPE), cidade, descricao.

Voce retorna APENAS um array JSON valido, um objeto por anuncio, com os campos:
- "externalId": string, identificador do anuncio (repete o que veio no input)
- "score": inteiro 0-100, onde 100 = oportunidade excelente
- "reason": string curta em PT-BR (1 frase) explicando a nota
- "redFlags": array de strings (pode ser vazio), cada uma um problema identificado

Criterios de pontuacao:
- Delta FIPE: negativo forte (>15% abaixo) = +30; -15% a -5% = +20; -5% a +5% = +10; acima da FIPE = -10.
- KM por ano coerente: <15k/ano = +10; 15-25k/ano = +5; >25k/ano = -5.
- Marca/modelo de boa saida = +15.
- Ano 2020+ = +10; ano 2018-2019 = +5.
- Red flags na descricao: cada um -15. Palavras que sao red flag: "batido", "sinistro", "sinistrado", "perda total", "motor com ruido", "motor com barulho", "cambio com problema", "sem documento", "aceito troca por moto", "leiloado", "leilao", "retomada", "restricao", "alienado", "so pra desmanche", "foi batido", "foi de taxi", "taxi", "uber" (muito rodado).

Seja rigoroso com red flags. E melhor score baixo justo que perder dinheiro.

Responda APENAS o JSON array, sem markdown, sem explicacao extra.`;

function carsToUserPrompt(cars) {
  const items = cars.map((c, i) => ({
    externalId: c.externalId,
    title: c.title,
    brand: c.brand,
    model: c.model,
    year: c.year,
    km: c.km,
    price: c.price,
    fipePrice: c.fipePrice,
    fipeDelta:
      c.fipeDelta != null ? `${(c.fipeDelta * 100).toFixed(1)}%` : null,
    city: c.city,
    description: (c.description || '').slice(0, 500),
  }));
  return `Avalie os seguintes ${items.length} anuncios e retorne o array JSON:\n\n${JSON.stringify(items, null, 2)}`;
}

function parseResponse(text, cars) {
  // Claude as vezes devolve com markdown fences; limpa.
  let clean = text.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  try {
    const arr = JSON.parse(clean);
    if (!Array.isArray(arr)) return [];
    // Mapeia por externalId pra garantir match
    const byId = new Map(arr.map((x) => [String(x.externalId), x]));
    return cars.map((c) => {
      const r = byId.get(String(c.externalId));
      if (!r) return null;
      return {
        externalId: c.externalId,
        source: c.source,
        score: typeof r.score === 'number' ? Math.round(r.score) : null,
        reason: r.reason || null,
        redFlags: Array.isArray(r.redFlags) ? r.redFlags : [],
      };
    });
  } catch (err) {
    console.warn('[intelligence] falha ao parsear resposta:', err.message);
    return [];
  }
}

/**
 * Chama Claude em batches de ate 20 anuncios.
 * Usa prompt caching no system prompt (corta custo nas chamadas subsequentes).
 * Retorna array de { externalId, source, score, reason, redFlags }.
 */
export async function scoreCars(cars) {
  const c = getClient();
  if (!c) {
    console.warn(
      '[intelligence] ANTHROPIC_API_KEY ausente; pulando score por IA.',
    );
    return [];
  }
  if (cars.length === 0) return [];

  const BATCH = 20;
  const results = [];
  for (let i = 0; i < cars.length; i += BATCH) {
    const chunk = cars.slice(i, i + BATCH);
    try {
      const response = await c.messages.create({
        model: config.anthropicModel,
        max_tokens: 2048,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: carsToUserPrompt(chunk),
          },
        ],
      });
      const textBlock = response.content.find((b) => b.type === 'text');
      if (textBlock) {
        const parsed = parseResponse(textBlock.text, chunk);
        results.push(...parsed.filter(Boolean));
      }
    } catch (err) {
      console.warn('[intelligence] erro na chamada Claude:', err.message);
    }
  }
  return results;
}
