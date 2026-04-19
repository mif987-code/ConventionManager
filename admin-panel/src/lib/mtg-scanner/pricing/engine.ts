import type {
  CardEntry, PricedEntry, PricingSummary, PricingSettings,
  PriceRange, PriceBreakdown,
} from '../types';

// ─── Default settings — loaded directly from pricing-rules.json logic ─────────

export function createDefaultPricingSettings(mode: 'buylist' | 'trade' = 'buylist'): PricingSettings {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: mode === 'buylist' ? 'Default Buylist' : 'Default Trade',
    mode,
    // Exact values from pricing-rules.json
    priceRanges: [
      { min: 0,    max: 1,    buyPercent: 0.10, tradeOffset: 0    },
      { min: 1,    max: 3,    buyPercent: 0.25, tradeOffset: 0.10 },
      { min: 3,    max: 5,    buyPercent: 0.40, tradeOffset: 0.15 },
      { min: 5,    max: 1000, buyPercent: 0.50, tradeOffset: 0.20 },
    ],
    conditionMultipliers: [
      { condition: 'NM', multiplier: 1.00 },
      { condition: 'LP', multiplier: 0.90 },
      { condition: 'MP', multiplier: 0.80 },
      { condition: 'HP', multiplier: 0.60 },
      { condition: 'D',  multiplier: 0.25 },
    ],
    languageMultipliers: [
      { language: 'EN',  multiplier: 1.00 },
      { language: 'JA',  multiplier: 1.10 },
      { language: 'ES',  multiplier: 0.95 },
      { language: 'FR',  multiplier: 0.95 },
      { language: 'DE',  multiplier: 0.95 },
      { language: 'IT',  multiplier: 0.95 },
      { language: 'PT',  multiplier: 0.95 },
      { language: 'KO',  multiplier: 1.00 },
      { language: 'RU',  multiplier: 0.90 },
      { language: 'ZHS', multiplier: 0.90 },
      { language: 'ZHT', multiplier: 0.90 },
      { language: 'PH',  multiplier: 0.90 },
    ],
    globalMinPrice: 0.25,
    roundTo: 0.25,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Core calculation ─────────────────────────────────────────────────────────

export function priceEntry(entry: CardEntry, settings: PricingSettings): PricedEntry {
  if (entry.tcgPrice === null || entry.needsConfirmation) {
    return { ...entry, adjustedPrice: null, effectivePercent: null, breakdown: null };
  }

  const tcg = entry.tcgPrice;

  // 1. Find matching price range bracket
  const range = findRange(tcg, settings.priceRanges);
  if (!range) {
    return { ...entry, adjustedPrice: null, effectivePercent: null, breakdown: null };
  }

  // 2. Buy % or trade % (buy + offset)
  const rangePercent =
    settings.mode === 'trade'
      ? range.buyPercent + range.tradeOffset
      : range.buyPercent;

  const afterRange = tcg * rangePercent;

  // 3. Condition multiplier
  const condRule = settings.conditionMultipliers.find((c) => c.condition === entry.condition);
  const condMult = condRule?.multiplier ?? 1.0;
  const afterCondition = afterRange * condMult;

  // 4. Language multiplier
  const langRule = settings.languageMultipliers.find((l) => l.language === entry.language);
  const langMult = langRule?.multiplier ?? 1.0;
  const afterLanguage = afterCondition * langMult;

  // 5. Floor
  const floored = Math.max(afterLanguage, settings.globalMinPrice);
  const floorApplied = floored > afterLanguage;

  // 6. Round
  const final = roundTo(floored, settings.roundTo);

  const effectivePercent = tcg > 0 ? final / tcg : null;

  const breakdown: PriceBreakdown = {
    tcgPrice: tcg,
    rangePercent,
    afterRange,
    conditionMultiplier: condMult,
    afterCondition,
    languageMultiplier: langMult,
    afterLanguage,
    floorApplied,
    final,
  };

  return { ...entry, adjustedPrice: final, effectivePercent, breakdown };
}

function findRange(price: number, ranges: PriceRange[]): PriceRange | null {
  return ranges.find((r) => price >= r.min && price < r.max) ?? null;
}

function roundTo(value: number, nearest: number): number {
  if (nearest <= 0) return value;
  return Math.round(value / nearest) * nearest;
}

// ─── Process full list ────────────────────────────────────────────────────────

export function priceList(entries: CardEntry[], settings: PricingSettings): PricingSummary {
  const priced = entries.map((e) => priceEntry(e, settings));
  const totalRawPrice = priced.reduce((s, e) => s + (e.tcgPrice ?? 0) * e.quantity, 0);
  const totalAdjustedPrice = priced.reduce((s, e) => s + (e.adjustedPrice ?? 0) * e.quantity, 0);
  const unresolved = priced.filter((e) => e.adjustedPrice === null).length;
  return {
    entries: priced,
    totalRawPrice,
    totalAdjustedPrice,
    cardCount: entries.reduce((s, e) => s + e.quantity, 0),
    unresolved,
  };
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'mtg-scanner:pricing-presets';

export function savePricingPresets(presets: PricingSettings[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch {}
}

export function loadPricingPresets(): PricingSettings[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PricingSettings[];
  } catch {}
  return [createDefaultPricingSettings('buylist'), createDefaultPricingSettings('trade')];
}

// ─── Import/export ────────────────────────────────────────────────────────────

/** Export to the same JSON format as pricing-rules.json */
export function exportSettingsToJson(settings: PricingSettings): string {
  const obj = {
    priceRanges: settings.priceRanges.map((r) => ({
      min: r.min,
      max: r.max,
      buyPercent: r.buyPercent,
      tradePercent: r.tradeOffset === 0 ? 'buy' : `buy+${r.tradeOffset}`,
    })),
    condition: Object.fromEntries(
      settings.conditionMultipliers.map((c) => [c.condition, c.multiplier])
    ),
    language: Object.fromEntries(
      settings.languageMultipliers.map((l) => [l.language, l.multiplier])
    ),
  };
  return JSON.stringify(obj, null, 2);
}

/** Import from pricing-rules.json format */
export function importSettingsFromJson(raw: string, name = 'Imported'): PricingSettings {
  const obj = JSON.parse(raw);
  const now = new Date().toISOString();

  const priceRanges: PriceRange[] = (obj.priceRanges ?? []).map((r: any) => {
    let tradeOffset = 0;
    if (typeof r.tradePercent === 'string') {
      if (r.tradePercent === 'buy') tradeOffset = 0;
      else {
        const match = r.tradePercent.match(/buy\+([0-9.]+)/);
        if (match) tradeOffset = parseFloat(match[1]);
      }
    }
    return { min: r.min, max: r.max, buyPercent: r.buyPercent, tradeOffset };
  });

  const conditionMultipliers = Object.entries(obj.condition ?? {}).map(([k, v]) => ({
    condition: k as any,
    multiplier: v as number,
  }));

  const languageMultipliers = Object.entries(obj.language ?? {}).map(([k, v]) => ({
    language: k as any,
    multiplier: v as number,
  }));

  return {
    id: crypto.randomUUID(),
    name,
    mode: 'buylist',
    priceRanges,
    conditionMultipliers,
    languageMultipliers,
    globalMinPrice: 0.25,
    roundTo: 0.25,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── CSV export ───────────────────────────────────────────────────────────────

export function exportToCsv(summary: PricingSummary): string {
  const header = [
    'Name','Set','Collector #','Finish','Condition','Language',
    'Qty','TCG Price','Range %','Cond Mult','Lang Mult','Adjusted Price','Line Total'
  ].join(',');

  const rows = summary.entries.map((e) => [
    `"${e.name}"`,
    e.setCode.toUpperCase(),
    e.collectorNumber,
    e.finish,
    e.condition,
    e.language,
    e.quantity,
    e.tcgPrice?.toFixed(2) ?? '',
    e.breakdown ? `${(e.breakdown.rangePercent * 100).toFixed(0)}%` : '',
    e.breakdown ? `×${e.breakdown.conditionMultiplier}` : '',
    e.breakdown ? `×${e.breakdown.languageMultiplier}` : '',
    e.adjustedPrice?.toFixed(2) ?? '',
    e.adjustedPrice != null ? (e.adjustedPrice * e.quantity).toFixed(2) : '',
  ].join(','));

  return [header, ...rows].join('\n');
}
