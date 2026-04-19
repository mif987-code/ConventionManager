import type { ScryfallCard, ScryfallSet } from '../types';

const BASE = 'https://api.scryfall.com';
const USER_AGENT = 'MTGScanner/1.0';

async function sfetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(BASE + path);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).details ?? `Scryfall ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

// ─── Autocomplete card names ─────────────────────────────────────────────────
export async function autocompleteCardName(q: string): Promise<string[]> {
  if (q.length < 2) return [];
  try {
    const data = await sfetch<{ data: string[] }>('/cards/autocomplete', { q });
    return data.data;
  } catch {
    return [];
  }
}

// ─── Get card by exact name (returns cheapest NM English printing) ────────────
export async function getCardByName(
  name: string,
  setCode?: string
): Promise<ScryfallCard | null> {
  try {
    const params: Record<string, string> = { fuzzy: name };
    if (setCode) params.set = setCode;
    return await sfetch<ScryfallCard>('/cards/named', params);
  } catch {
    return null;
  }
}

// ─── Get all printings of a card (paper only) ────────────────────────────────
export async function getCardPrintings(oracleId: string): Promise<ScryfallCard[]> {
  try {
    const data = await sfetch<{ data: ScryfallCard[] }>('/cards/search', {
      q: `oracleid:${oracleId} -is:digital`,
      unique: 'prints',
      order: 'released',
      dir: 'desc',
    });
    return data.data;
  } catch {
    return [];
  }
}

// ─── Get card by set + collector number ──────────────────────────────────────
export async function getCardBySetNumber(
  setCode: string,
  collectorNumber: string
): Promise<ScryfallCard | null> {
  try {
    return await sfetch<ScryfallCard>(`/cards/${setCode}/${collectorNumber}`);
  } catch {
    return null;
  }
}

// ─── Get card by Scryfall ID ─────────────────────────────────────────────────
export async function getCardById(id: string): Promise<ScryfallCard | null> {
  try {
    return await sfetch<ScryfallCard>(`/cards/${id}`);
  } catch {
    return null;
  }
}

// ─── Search cards (general) ──────────────────────────────────────────────────
export async function searchCards(
  query: string,
  extra?: Record<string, string>
): Promise<ScryfallCard[]> {
  try {
    const data = await sfetch<{ data: ScryfallCard[] }>('/cards/search', {
      q: query + ' -is:digital',
      ...extra,
    });
    return data.data;
  } catch {
    return [];
  }
}

// ─── Get all paper sets ──────────────────────────────────────────────────────
let _setsCache: ScryfallSet[] | null = null;

export async function getPaperSets(): Promise<ScryfallSet[]> {
  if (_setsCache) return _setsCache;
  try {
    const data = await sfetch<{ data: ScryfallSet[] }>('/sets');
    _setsCache = data.data.filter(
      (s) => !s.digital && s.set_type !== 'token' && s.set_type !== 'memorabilia'
    );
    return _setsCache;
  } catch {
    return [];
  }
}

// ─── Get cards in a set (paper, sorted by collector number) ──────────────────
export async function getCardsInSet(setCode: string): Promise<ScryfallCard[]> {
  return searchCards(`e:${setCode}`, { order: 'set' });
}

// ─── Extract TCGPlayer price from a card ─────────────────────────────────────
export function getTcgPrice(card: ScryfallCard, finish: 'nonfoil' | 'foil' | 'etched'): number | null {
  const raw =
    finish === 'foil'
      ? card.prices.usd_foil
      : finish === 'etched'
      ? card.prices.usd_etched
      : card.prices.usd;
  if (!raw) return null;
  const v = parseFloat(raw);
  return isNaN(v) ? null : v;
}

// ─── Extract best image URL ───────────────────────────────────────────────────
export function getCardImageUrl(card: ScryfallCard, size: 'small' | 'normal' | 'art_crop' = 'normal'): string | null {
  const uris = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  return uris?.[size] ?? null;
}

// ─── Batch resolve cards (for Excel import) ──────────────────────────────────
export async function resolveCardBatch(
  cards: Array<{ name: string; setCode?: string; collectorNumber?: string }>
): Promise<Array<ScryfallCard | null>> {
  // Scryfall rate-limit: max 10 req/s; we respect it with small delay
  const results: Array<ScryfallCard | null> = [];
  for (const c of cards) {
    if (c.setCode && c.collectorNumber) {
      results.push(await getCardBySetNumber(c.setCode, c.collectorNumber));
    } else {
      results.push(await getCardByName(c.name, c.setCode));
    }
    await new Promise((r) => setTimeout(r, 110)); // ~9 req/s
  }
  return results;
}
