# Convention Manager Integration Guide

## Admin Panel (React + Vite + Tailwind)

### 1. Install the package
```bash
cd ConventionManager/admin-panel
npm install @mtg-scanner/core
```

### 2. Copy the integration file
```bash
cp integration/AdminPanelIntegration.tsx admin-panel/src/pages/MTGScannerPage.tsx
```

### 3. Add the route (in your App.tsx or router file)
```tsx
import { MTGScannerPage } from './pages/MTGScannerPage';

// Inside your <Routes>:
<Route path="/mtg-scanner" element={<MTGScannerPage />} />
```

### 4. Add the nav link (in your sidebar/nav component)
```tsx
<NavLink to="/mtg-scanner" className={({ isActive }) =>
  isActive ? 'nav-link active' : 'nav-link'
}>
  🃏 MTG Scanner
</NavLink>
```

### 5. (Optional) Configure Vite alias for local dev without publishing
In `admin-panel/vite.config.ts`:
```ts
resolve: {
  alias: {
    '@mtg-scanner/core': path.resolve(__dirname, '../../mtg-scanner/packages/core/src/index.ts'),
    '@mtg-scanner/core/components': path.resolve(__dirname, '../../mtg-scanner/packages/core/src/components.ts'),
  }
}
```

---

## Store App Integration

The store app can embed just the pricing engine (no scanner needed):

```tsx
import { priceList, loadPricingPresets } from '@mtg-scanner/core';

const presets = loadPricingPresets();
const summary = priceList(myCards, presets[0]);
console.log(summary.totalAdjustedPrice);
```

---

## Publishing @mtg-scanner/core to npm (optional)

```bash
cd mtg-scanner/packages/core
npm run build
npm publish --access public
```

Then in any project:
```bash
npm install @mtg-scanner/core
```
