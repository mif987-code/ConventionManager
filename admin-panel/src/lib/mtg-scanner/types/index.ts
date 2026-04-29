// ─── Card meta types ──────────────────────────────────────────────────────────

export type CardCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'D';
export type CardLanguage =
  | 'EN' | 'ES' | 'FR' | 'DE' | 'IT' | 'PT' | 'JA' | 'KO' | 'RU' | 'ZHS' | 'ZHT' | 'PH';
export type CardFinish = 'nonfoil' | 'foil' | 'etched';
export type ListMode = 'buylist' | 'trade';

export const CONDITION_LABELS: Record<CardCondition, string> = {
  NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played',
  HP: 'Heavily Played', D: 'Damaged',
};

export const LANGUAGE_LABELS: Record<CardLanguage, string> = {
  EN: 'English', ES: 'Spanish', FR: 'French', DE: 'German',
  IT: 'Italian', PT: 'Portuguese', JA: 'Japanese', KO: 'Korean',
  RU: 'Russian', ZHS: 'Simp. Chinese', ZHT: 'Trad. Chinese', PH: 'Phyrexian',
};

// ─── Scryfall ─────────────────────────────────────────────────────────────────

export interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus';
  finishes: CardFinish[];
  lang: string;
  image_uris?: { small: string; normal: string; large: string; art_crop: string };
  card_faces?: Array<{ image_uris?: { small: string; normal: string; large: string; art_crop: string } }>;
  prices: { usd: string | null; usd_foil: string | null; usd_etched: string | null };
  tcgplayer_id?: number;
  digital: boolean;
  layout: string;
  color_identity: string[];
  type_line: string;
  prints_search_uri: string;
}

export interface ScryfallSet {
  code: string; name: string; released_at: string; set_type: string;
  digital: boolean; icon_svg_uri: string; card_count: number;
}

// ─── Card list entry ──────────────────────────────────────────────────────────

export interface CardEntry {
  id: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  finish: CardFinish;
  condition: CardCondition;
  language: CardLanguage;
  quantity: number;
  tcgPrice: number | null;
  scryfallId: string | null;
  needsConfirmation: boolean;
  imageUrl?: string;
  source: 'scan' | 'manual' | 'excel';
}

// ─── Pricing engine — mirrors pricing-rules.json ──────────────────────────────

export interface PriceRange {
  min: number;        // inclusive lower bound USD
  max: number;        // exclusive upper bound USD (use 1000 for open-ended)
  buyPercent: number; // 0–1  e.g. 0.25 = 25%
  tradeOffset: number;// 0–1  added to buyPercent for trade mode  e.g. 0.1 = +10%
}

export interface ConditionMultiplier {
  condition: CardCondition;
  multiplier: number; // 0–2, 1.0 = no change
}

export interface LanguageMultiplier {
  language: CardLanguage;
  multiplier: number;
}

export interface PricingSettings {
  id: string;
  name: string;
  mode: ListMode;
  priceRanges: PriceRange[];
  conditionMultipliers: ConditionMultiplier[];
  languageMultipliers: LanguageMultiplier[];
  globalMinPrice: number;
  roundTo: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Pricing output ───────────────────────────────────────────────────────────

export interface PriceBreakdown {
  tcgPrice: number;
  rangePercent: number;
  afterRange: number;
  conditionMultiplier: number;
  afterCondition: number;
  languageMultiplier: number;
  afterLanguage: number;
  floorApplied: boolean;
  final: number;
}

export interface PricedEntry extends CardEntry {
  adjustedPrice: number | null;
  effectivePercent: number | null;
  breakdown: PriceBreakdown | null;
}

export interface PricingSummary {
  entries: PricedEntry[];
  totalRawPrice: number;
  totalAdjustedPrice: number;
  cardCount: number;
  unresolved: number;
}

// ─── Scanner ──────────────────────────────────────────────────────────────────

export type ScanStatus = 'idle' | 'detecting' | 'matching' | 'confirming' | 'confirmed' | 'error';

export interface ScanResult {
  status: ScanStatus;
  candidates: ScryfallCard[];
  bestMatch: ScryfallCard | null;
  confidence: number;
  ocrText: string | null;
  error?: string;
  debugInfo?: { method: string; bottomOcrText: string | null; parsed: { setCode: string; collectorNumber: string } | null };
}

export interface ExcelRow {
  name?: string; setCode?: string; setName?: string; collectorNumber?: string;
  foil?: string | boolean; finish?: string; condition?: string;
  language?: string; quantity?: string | number; price?: string | number;
}
