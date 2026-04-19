/**
 * MTG Scanner — Admin Panel Integration
 * Drop this file into your ConventionManager admin-panel/src/pages/ directory.
 * Then add a route and nav link pointing to it.
 *
 * INSTALL:
 *   cd admin-panel
 *   npm install @mtg-scanner/core
 *
 * USAGE IN YOUR ROUTER (e.g. App.tsx):
 *   import { MTGScannerPage } from './pages/MTGScannerPage';
 *   <Route path="/mtg-scanner" element={<MTGScannerPage />} />
 *
 * NAV LINK:
 *   <NavLink to="/mtg-scanner">🃏 MTG Scanner</NavLink>
 */
import React, { useState, useEffect } from 'react';
import type { CardEntry, PricingSettings, PricingSummary } from '@mtg-scanner/core';
import {
  priceList,
  loadPricingPresets,
  savePricingPresets,
  exportToCsv,
} from '@mtg-scanner/core';
import { CardListTable } from '@mtg-scanner/core/components';
import { PricingSettingsPanel } from '@mtg-scanner/core/components';

type Tab = 'list' | 'manual' | 'excel' | 'pricing' | 'results';

/**
 * Self-contained MTG scanner page for the admin panel.
 * No props required — manages its own state internally.
 * Styling uses your admin panel's existing Tailwind classes where possible,
 * and falls back to inline styles for component isolation.
 */
export function MTGScannerPage() {
  const [tab, setTab] = useState<Tab>('list');
  const [entries, setEntries] = useState<CardEntry[]>([]);
  const [presets, setPresets] = useState<PricingSettings[]>(loadPricingPresets);
  const [activePresetId, setActivePresetId] = useState(presets[0]?.id ?? '');
  const [summary, setSummary] = useState<PricingSummary | null>(null);

  useEffect(() => { savePricingPresets(presets); }, [presets]);

  useEffect(() => {
    const active = presets.find((p) => p.id === activePresetId);
    if (active && entries.length > 0) setSummary(priceList(entries, active));
    else setSummary(null);
  }, [entries, presets, activePresetId]);

  const adjustedMap = summary
    ? Object.fromEntries(summary.entries.map((e) => [e.id, e.adjustedPrice ?? 0]))
    : {};

  function handleExport() {
    if (!summary) return;
    const csv = exportToCsv(summary);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mtg-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'list',    label: `Card list${entries.length ? ` (${entries.length})` : ''}` },
    { key: 'manual',  label: 'Add manually' },
    { key: 'excel',   label: 'Import Excel' },
    { key: 'pricing', label: 'Pricing rules' },
    { key: 'results', label: 'Price results' },
  ];

  return (
    <div className="p-6">
      {/* Header — uses your admin panel's typical heading style */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🃏 MTG Card Scanner</h1>
        <p className="text-sm text-gray-500 mt-1">
          Scan, import, and price Magic: The Gathering cards for buylist or trade
        </p>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Cards', value: summary.cardCount },
            { label: 'Raw TCG value', value: `$${summary.totalRawPrice.toFixed(2)}` },
            { label: 'Adjusted total', value: `$${summary.totalAdjustedPrice.toFixed(2)}` },
            { label: 'Unresolved', value: summary.unresolved },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar — matches your admin panel's tab style */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tabs */}
      {tab === 'list' && (
        <div>
          <CardListTable entries={entries} onChange={setEntries} adjustedPrices={adjustedMap} />
          {entries.length > 0 && (
            <div className="flex gap-3 mt-4">
              <button onClick={() => setTab('results')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                View adjusted prices →
              </button>
              <button onClick={handleExport} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                Export CSV
              </button>
              <button onClick={() => setEntries([])} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 ml-auto">
                Clear list
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <ManualAddInline onAdd={(e) => { setEntries((prev) => [...prev, e]); setTab('list'); }} />
      )}

      {tab === 'excel' && (
        <ExcelImportInline onAdd={(es) => { setEntries((prev) => [...prev, ...es]); setTab('list'); }} />
      )}

      {tab === 'pricing' && (
        <PricingSettingsPanel
          presets={presets}
          activePresetId={activePresetId}
          onPresetsChange={setPresets}
          onActiveChange={setActivePresetId}
        />
      )}

      {tab === 'results' && summary && (
        <ResultsInline summary={summary} onExport={handleExport} presetName={presets.find((p) => p.id === activePresetId)?.name} />
      )}
    </div>
  );
}

// ─── Inline Manual Add ────────────────────────────────────────────────────────

function ManualAddInline({ onAdd }: { onAdd: (e: CardEntry) => void }) {
  // Minimal version — uses CardListTable with a single empty row for simplicity
  const [entries, setEntries] = useState<CardEntry[]>([{
    id: crypto.randomUUID(), name: '', setCode: '', setName: '',
    collectorNumber: '', finish: 'nonfoil', condition: 'NM', language: 'EN',
    quantity: 1, tcgPrice: null, scryfallId: null, needsConfirmation: false, source: 'manual',
  }]);

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Type a card name to search via Scryfall. Select the printing from the set dropdown.
      </p>
      <CardListTable entries={entries} onChange={setEntries} />
      <div className="flex gap-3 mt-4">
        {entries.filter((e) => e.name).map((e) => (
          <button key={e.id} onClick={() => onAdd(e)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
            Add "{e.name}" to list
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Inline Excel Import ──────────────────────────────────────────────────────

function ExcelImportInline({ onAdd }: { onAdd: (es: CardEntry[]) => void }) {
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<CardEntry[]>([]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('Parsing...');
    try {
      const { parseExcelFile, resolveCardBatch, getTcgPrice, getCardImageUrl } = await import('@mtg-scanner/core');
      const { entries } = await parseExcelFile(file);
      setStatus(`Resolving ${entries.length} cards via Scryfall...`);
      const resolved = await resolveCardBatch(entries.map((e) => ({ name: e.name, setCode: e.setCode || undefined })));
      const final: CardEntry[] = entries.map((e, i) => {
        const card = resolved[i];
        return {
          ...e,
          scryfallId: card?.id ?? null,
          setCode: card?.set ?? e.setCode,
          setName: card?.set_name ?? e.setName,
          collectorNumber: card?.collector_number ?? e.collectorNumber,
          tcgPrice: card ? getTcgPrice(card, e.finish) : null,
          imageUrl: card ? (getCardImageUrl(card, 'normal') ?? undefined) : undefined,
          needsConfirmation: !card,
        };
      });
      setPreview(final);
      setStatus(`Ready: ${final.length} cards (${final.filter((e) => e.needsConfirmation).length} need confirmation)`);
    } catch (err) {
      setStatus('Error: ' + (err instanceof Error ? err.message : String(err)));
    }
    e.target.value = '';
  }

  return (
    <div>
      <label className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-indigo-700">
        Choose Excel file
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
      </label>
      {status && <p className="text-sm text-gray-600 mt-3">{status}</p>}
      {preview.length > 0 && (
        <div className="mt-4">
          <CardListTable entries={preview} onChange={setPreview} />
          <button onClick={() => onAdd(preview)} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
            Add {preview.length} cards to list →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inline Results ───────────────────────────────────────────────────────────

function ResultsInline({ summary, onExport, presetName }: { summary: PricingSummary; onExport: () => void; presetName?: string }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Preset: <strong>{presetName}</strong></p>
        <button onClick={onExport} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Card','Set','Cond','Lang','Finish','Qty','TCG $','Range%','Adj $','Line total'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.entries.map((e) => (
              <tr key={e.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium">{e.name}</td>
                <td className="px-3 py-2 text-gray-500">{e.setCode.toUpperCase()}</td>
                <td className="px-3 py-2">{e.condition}</td>
                <td className="px-3 py-2">{e.language}</td>
                <td className="px-3 py-2">{e.finish}</td>
                <td className="px-3 py-2">{e.quantity}</td>
                <td className="px-3 py-2 font-mono">{e.tcgPrice != null ? `$${e.tcgPrice.toFixed(2)}` : '—'}</td>
                <td className="px-3 py-2 text-amber-600">{e.breakdown ? `${(e.breakdown.rangePercent*100).toFixed(0)}%` : '—'}</td>
                <td className="px-3 py-2 font-mono font-bold text-green-600">{e.adjustedPrice != null ? `$${e.adjustedPrice.toFixed(2)}` : '—'}</td>
                <td className="px-3 py-2 font-mono font-bold text-indigo-600">
                  {e.adjustedPrice != null ? `$${(e.adjustedPrice * e.quantity).toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-bold">
            <tr className="border-t-2 border-gray-200">
              <td colSpan={6} className="px-3 py-2">Totals</td>
              <td className="px-3 py-2 font-mono">${summary.totalRawPrice.toFixed(2)}</td>
              <td />
              <td />
              <td className="px-3 py-2 font-mono text-green-700 text-base">${summary.totalAdjustedPrice.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
