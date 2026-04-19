# MTG Scanner — Monorepo

A modular MTG card scanning and pricing system. Delivers as:
- **Standalone web app** (`apps/web`) — full-featured PWA
- **Expo app** (`apps/expo`) — React Native mobile (camera-first)
- **npm package** (`packages/core`) — `@mtg-scanner/core` for embedding in any project

---

## Repository structure

```
mtg-scanner/
├── packages/
│   └── core/                        # @mtg-scanner/core — shared logic + components
│       └── src/
│           ├── types/index.ts        # All TypeScript types (CardEntry, PricingSettings, …)
│           ├── services/
│           │   ├── scryfall.ts       # All Scryfall API calls
│           │   └── excelImport.ts    # .xlsx/.xls parser with flexible column matching
│           ├── scanner/
│           │   └── pipeline.ts       # CV pipeline: detect → hash → OCR → match
│           ├── pricing/
│           │   └── engine.ts         # Pricing engine: base % → condition → lang → finish → rarity
│           ├── components/
│           │   ├── CardListTable.tsx  # Editable card list (mirrors Bulk Import UX)
│           │   └── PricingSettings.tsx # Pricing rules UI: conditions/languages/finishes/rarity
│           ├── index.ts              # Package entry: services, engine, types, scanner
│           └── components.ts         # Separate entry: React components only
│
├── apps/
│   ├── web/                          # Vite + React standalone web app
│   │   └── src/App.tsx               # Tabbed app: Scanner · List · Manual · Excel · Pricing · Results
│   └── expo/                         # React Native (Expo) — mobile app
│       └── src/screens/              # Scanner screen uses Expo Camera + ML Kit
│
└── package.json                      # Workspace root
```

---

## Quick start

```bash
# Install all workspaces
npm install

# Run web app (localhost:5173)
npm run dev:web

# Run Expo app
npm run dev:expo

# Build the core package (for publishing)
npm run build:core
```

---

## @mtg-scanner/core — package API

### Install in another project
```bash
npm install @mtg-scanner/core
```

### Services

```ts
import {
  autocompleteCardName,   // GET /cards/autocomplete
  getCardByName,          // GET /cards/named?fuzzy=&set=
  getCardPrintings,       // GET /cards/search?q=oracleid:xxx
  getCardBySetNumber,     // GET /cards/:set/:number
  getPaperSets,           // GET /sets (filtered to paper only)
  getCardsInSet,          // GET /cards/search?q=e:setcode
  getTcgPrice,            // Extract USD price for a finish
  getCardImageUrl,        // Extract image URI for a size
  resolveCardBatch,       // Batch resolve cards respecting rate limit
  parseExcelFile,         // Parse .xlsx with flexible column matching
} from '@mtg-scanner/core';
```

### Pricing engine

```ts
import {
  createDefaultPricingSettings,  // Create default buylist or trade preset
  priceEntry,                     // Price a single CardEntry
  priceList,                      // Price all entries → PricingSummary
  loadPricingPresets,             // Load from localStorage
  savePricingPresets,             // Save to localStorage
  exportToCsv,                    // Export PricingSummary → CSV string
} from '@mtg-scanner/core';
```

### React components

```tsx
import { CardListTable } from '@mtg-scanner/core/components';
import { PricingSettingsPanel } from '@mtg-scanner/core/components';

// Embed the card list table (e.g. in admin panel)
<CardListTable
  entries={entries}
  onChange={setEntries}
  adjustedPrices={priceMap}   // optional: { [cardId]: adjustedPrice }
/>

// Embed pricing settings
<PricingSettingsPanel
  presets={presets}
  activePresetId={activeId}
  onPresetsChange={setPresets}
  onActiveChange={setActiveId}
/>
```

---

## Embedding in Convention Manager admin panel

```tsx
// In your admin panel route/page:
import { CardListTable, PricingSettingsPanel } from '@mtg-scanner/core/components';
import { priceList, loadPricingPresets } from '@mtg-scanner/core';

// Drop in wherever you want MTG scanning/pricing to appear.
// Components are self-contained and use inline styles — no CSS import needed.
```

---

## Pricing engine — calculation order

For each card:
```
TCGPlayer price
  × basePercentage / 100
  × conditionRules[condition].percentage / 100
  × languageRules[language].multiplier
  × finishRules[finish].multiplier
  → if rarityRanges match → override with range percentage instead
  → apply max(result, conditionMinPrice, globalMinPrice)
  → round to roundTo
= Final adjusted price
```

---

## Scanner pipeline

```
Video frame
  → detectCardInFrame()     — aspect ratio + largest rect heuristic
  → extractArtRegion()      — top 45%, inner 86% width
  → dHash()                 — 64-bit perceptual fingerprint
  → extractNameRegion()     — top 9% of card
  → ocrNameRegion()         — Tesseract.js (web) / ML Kit (Expo)
  → matchCard()             — OCR name → Scryfall /cards/named, confirmed by hash distance
  → ScanResult              — { bestMatch, confidence, candidates, ocrText }
```

**Confidence thresholds:**
- ≥ 0.85 → auto-confirmed, added directly
- 0.5–0.85 → added with `needsConfirmation: true` (yellow row, Confirm button)
- < 0.5 → scanning continues

---

## Excel import — supported columns

| Field | Accepted column names |
|---|---|
| Name* | name, card name, card, title |
| Set code | set code, set, edition code |
| Set name | set name, edition |
| Collector # | collector number, #, no |
| Foil | foil, is foil |
| Finish | finish, printing, treatment |
| Condition | condition, cond, grade |
| Language | language, lang |
| Quantity | quantity, qty, count |
| Price | price, tcg price, market price |

*required

Condition values auto-mapped: NM, LP, MP, HP, D (and full names like "Near Mint", "Lightly Played", etc.)
Language values auto-mapped: English→en, Japanese→ja, etc.

---

## Scryfall API usage notes

- All requests include `User-Agent: MTGScanner/1.0` (required by Scryfall ToS)
- Rate limit: ~9 requests/second (110ms delay in batch resolver)
- Paper-only filter: `-is:digital` appended to all card searches
- Prices sourced from `card.prices.usd` / `usd_foil` / `usd_etched` (TCGPlayer market price)

---

## Roadmap

- [ ] OpenCV.js WASM integration for full contour/perspective detection
- [ ] Precomputed hash index from Scryfall bulk data (offline matching)
- [ ] Expo ML Kit text recognition (replaces Tesseract.js on mobile)
- [ ] Store app integration (Convention Manager)
- [ ] Bulk upload to external buylist platforms
- [ ] Multi-language OCR support
