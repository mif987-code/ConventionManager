# MTG Scanner — Convention Manager Integration

This module adds MTG card scanning and pricing to Convention Manager.
It is a self-contained monorepo workspace that can run standalone or be
embedded as components into the admin panel and store app.

## Structure

```
mtg-scanner/
├── packages/core/          # @mtg-scanner/core — shared logic + React components
│   └── src/
│       ├── types/          # All shared TypeScript types
│       ├── services/       # Scryfall API, Excel import
│       ├── scanner/        # CV pipeline: detect → hash → OCR → match
│       ├── pricing/        # Pricing engine matching pricing-rules.json format
│       └── components/     # CardListTable, PricingSettingsPanel (React)
├── apps/web/               # Standalone web app (Vite + React)
├── apps/expo/              # Mobile app (Expo / React Native)
└── integration/            # Drop-in files for admin-panel
```

## Quick start (standalone web app)

```bash
cd mtg-scanner
npm install
npm run dev:web     # → http://localhost:5174
```

## Embed in the admin panel

1. Install the package:
   ```bash
   cd admin-panel
   npm install ../mtg-scanner/packages/core
   ```

2. Copy the integration page:
   ```bash
   cp mtg-scanner/integration/AdminPanelIntegration.tsx admin-panel/src/pages/MTGScannerPage.tsx
   ```

3. Add to `admin-panel/src/App.tsx`:
   ```tsx
   import { MTGScannerPage } from './pages/MTGScannerPage';
   // Inside <Routes>:
   <Route path="/mtg-scanner" element={<MTGScannerPage />} />
   ```

4. Add nav link in the `navItems` array in App.tsx:
   ```tsx
   { to: '/mtg-scanner', icon: <ShoppingBag size={20} />, label: 'MTG Scanner' }
   ```

## Pricing rules

The pricing engine reads `pricing-rules.json` format directly.
Default rules (from your existing file):

| Price range | Buy %  | Trade offset |
|------------|--------|-------------|
| $0 – $1    | 10%    | +0%         |
| $1 – $3    | 25%    | +10%        |
| $3 – $5    | 40%    | +15%        |
| $5+        | 50%    | +20%        |

Condition and language multipliers are fully configurable in the Pricing Rules tab.

## Scryfall API

All card data and TCGPlayer prices come from Scryfall's free API.
Rate limit: 9 req/s (respected automatically by the batch resolver).
