import React, { useState } from 'react';
import type { PricingSettings, PriceRange, CardCondition, CardLanguage } from '../types';
import { CONDITION_LABELS, LANGUAGE_LABELS } from '../types';
import { createDefaultPricingSettings, exportSettingsToJson, importSettingsFromJson } from '../pricing/engine';

interface Props {
  presets: PricingSettings[];
  activePresetId: string;
  onPresetsChange: (presets: PricingSettings[]) => void;
  onActiveChange: (id: string) => void;
}

type Tab = 'ranges' | 'conditions' | 'languages' | 'advanced';

const CONDITIONS: CardCondition[] = ['NM', 'LP', 'MP', 'HP', 'D'];
const LANGUAGES: CardLanguage[] = ['EN', 'JA', 'KO', 'ES', 'FR', 'DE', 'IT', 'PT', 'RU', 'ZHS', 'ZHT', 'PH'];

export function PricingSettingsPanel({ presets, activePresetId, onPresetsChange, onActiveChange }: Props) {
  const [tab, setTab] = useState<Tab>('ranges');
  const [importError, setImportError] = useState('');

  const active = presets.find((p) => p.id === activePresetId) ?? presets[0];

  function updateActive(patch: Partial<PricingSettings>) {
    onPresetsChange(
      presets.map((p) =>
        p.id === active.id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
      )
    );
  }

  function addPreset(mode: 'buylist' | 'trade') {
    const p = createDefaultPricingSettings(mode);
    onPresetsChange([...presets, p]);
    onActiveChange(p.id);
  }

  function duplicatePreset() {
    const copy: PricingSettings = {
      ...active,
      id: crypto.randomUUID(),
      name: active.name + ' (copy)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onPresetsChange([...presets, copy]);
    onActiveChange(copy.id);
  }

  function deletePreset() {
    if (presets.length <= 1) return;
    const rest = presets.filter((p) => p.id !== active.id);
    onPresetsChange(rest);
    onActiveChange(rest[0].id);
  }

  function handleExportJson() {
    const json = exportSettingsToJson(active);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pricing-rules-${active.name.replace(/\s+/g, '-')}.json`;
    a.click();
  }

  function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = importSettingsFromJson(ev.target?.result as string, file.name.replace('.json', ''));
        onPresetsChange([...presets, imported]);
        onActiveChange(imported.id);
        setImportError('');
      } catch (err) {
        setImportError('Invalid JSON file: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── Price example helper ────────────────────────────────────────────────────
  function examplePrice(tcg: number): string {
    const range = active.priceRanges.find((r) => tcg >= r.min && tcg < r.max);
    if (!range) return '—';
    const pct = active.mode === 'trade' ? range.buyPercent + range.tradeOffset : range.buyPercent;
    return `$${(tcg * pct).toFixed(2)}`;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ranges',     label: 'Price ranges' },
    { key: 'conditions', label: 'Conditions' },
    { key: 'languages',  label: 'Languages' },
    { key: 'advanced',   label: 'Advanced' },
  ];

  return (
    <div style={{ fontSize: 14, fontFamily: 'inherit' }}>

      {/* ── Preset bar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={active.id} onChange={(e) => onActiveChange(e.target.value)} style={sel}>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>[{p.mode === 'buylist' ? 'BUY' : 'TRD'}] {p.name}</option>
          ))}
        </select>
        <button onClick={() => addPreset('buylist')} style={ghost}>+ Buylist</button>
        <button onClick={() => addPreset('trade')} style={ghost}>+ Trade</button>
        <button onClick={duplicatePreset} style={ghost}>Duplicate</button>
        <button onClick={deletePreset} disabled={presets.length <= 1} style={{ ...ghost, color: '#dc2626', borderColor: '#fca5a5' }}>Delete</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={handleExportJson} style={ghost}>↓ Export JSON</button>
          <label style={{ ...ghost, cursor: 'pointer' }}>
            ↑ Import JSON
            <input type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {importError && (
        <div style={{ background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
          {importError}
        </div>
      )}

      {/* ── Preset name + mode ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 2 }}>
          <label style={lbl}>Preset name</label>
          <input value={active.name} onChange={(e) => updateActive({ name: e.target.value })} style={inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Mode</label>
          <select value={active.mode} onChange={(e) => updateActive({ mode: e.target.value as any })} style={inp}>
            <option value="buylist">Buylist — we buy from customers</option>
            <option value="trade">Trade — we give store credit</option>
          </select>
        </div>
      </div>

      {/* ── Mode info pill ── */}
      <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 6, background: active.mode === 'buylist' ? '#eff6ff' : '#f0fdf4', border: `1px solid ${active.mode === 'buylist' ? '#bfdbfe' : '#bbf7d0'}`, fontSize: 12, color: active.mode === 'buylist' ? '#1d4ed8' : '#15803d' }}>
        {active.mode === 'buylist'
          ? 'Buylist mode: prices shown are what you pay the customer (buy percent only).'
          : 'Trade mode: prices shown are store credit offered (buy percent + trade offset).'}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 0 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === t.key ? '2px solid #6366f1' : '2px solid transparent',
            color: tab === t.key ? '#6366f1' : '#6b7280',
            fontWeight: tab === t.key ? 600 : 400, marginBottom: -2,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '20px 0' }}>

        {/* ════ PRICE RANGES tab ════ */}
        {tab === 'ranges' && (
          <div>
            <p style={hint}>
              Each row is a price bracket. <strong>Buy %</strong> is what you pay.{' '}
              <strong>Trade offset</strong> is the extra percentage added on top in trade mode
              (e.g. buy 25% + trade +10% = 35% store credit). "0" means trade = buy.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['TCG price ≥ $', 'TCG price < $', 'Buy %', 'Trade offset', 'Trade % total', `Example ($2 card)`, `Example ($10 card)`, ''].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.priceRanges.map((r, i) => {
                  const totalTrade = r.buyPercent + r.tradeOffset;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={td}>
                        <input type="number" min={0} step={0.01} value={r.min}
                          onChange={(e) => updateRanges(i, 'min', parseFloat(e.target.value) || 0)}
                          style={{ ...inp, width: 72 }} />
                      </td>
                      <td style={td}>
                        <input type="number" min={0} step={0.01} value={r.max === 1000 ? '' : r.max}
                          placeholder="∞"
                          onChange={(e) => updateRanges(i, 'max', e.target.value === '' ? 1000 : parseFloat(e.target.value) || 1000)}
                          style={{ ...inp, width: 72 }} />
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" min={0} max={1} step={0.01} value={r.buyPercent}
                            onChange={(e) => updateRanges(i, 'buyPercent', parseFloat(e.target.value) || 0)}
                            style={{ ...inp, width: 68 }} />
                          <span style={{ color: '#9ca3af', fontSize: 12 }}>{(r.buyPercent * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" min={0} max={1} step={0.01} value={r.tradeOffset}
                            onChange={(e) => updateRanges(i, 'tradeOffset', parseFloat(e.target.value) || 0)}
                            style={{ ...inp, width: 68 }} />
                          <span style={{ color: '#9ca3af', fontSize: 12 }}>+{(r.tradeOffset * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={{ ...td, fontFamily: 'monospace', color: '#4b5563' }}>
                        {active.mode === 'trade' ? `${(totalTrade * 100).toFixed(0)}%` : `${(r.buyPercent * 100).toFixed(0)}%`}
                      </td>
                      <td style={{ ...td, fontFamily: 'monospace' }}>
                        {2 >= r.min && 2 < r.max ? `$${(2 * (active.mode === 'trade' ? totalTrade : r.buyPercent)).toFixed(2)}` : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ ...td, fontFamily: 'monospace' }}>
                        {10 >= r.min && 10 < r.max ? `$${(10 * (active.mode === 'trade' ? totalTrade : r.buyPercent)).toFixed(2)}` : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={td}>
                        <button onClick={() => removeRange(i)} style={{ ...ghost, color: '#dc2626', borderColor: '#fca5a5', padding: '2px 8px' }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button onClick={addRange} style={{ ...ghost, marginTop: 10 }}>+ Add bracket</button>

            {/* Live preview table */}
            <div style={{ marginTop: 24, padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 13 }}>Live preview — NM / EN prices</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[0.25, 0.50, 1.00, 2.00, 4.00, 8.00, 15.00, 30.00, 50.00].map((price) => (
                  <div key={price} style={{ textAlign: 'center', padding: '6px 12px', background: 'white', borderRadius: 6, border: '1px solid #e5e7eb', minWidth: 80 }}>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>TCG ${price.toFixed(2)}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: '#111' }}>{examplePrice(price)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ CONDITIONS tab ════ */}
        {tab === 'conditions' && (
          <div>
            <p style={hint}>
              Multiplier applied after the price-range percentage. 1.0 = no change, 0.9 = 90% of the range price.
              The "Example" column shows the final price for a $10 NM card adjusted by each condition.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Condition', 'Multiplier', '% of range price', 'Example ($10 NM, first range ≥$5)'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CONDITIONS.map((cond) => {
                  const rule = active.conditionMultipliers.find((c) => c.condition === cond) ?? { condition: cond, multiplier: 1 };
                  const range = active.priceRanges.find((r) => 10 >= r.min && 10 < r.max);
                  const rangePct = range ? (active.mode === 'trade' ? range.buyPercent + range.tradeOffset : range.buyPercent) : 0.5;
                  const example = 10 * rangePct * rule.multiplier;
                  const effPct = rangePct * rule.multiplier * 100;

                  return (
                    <tr key={cond} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={td}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{cond}</span>
                        <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 12 }}>{CONDITION_LABELS[cond]}</span>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" min={0} max={2} step={0.01} value={rule.multiplier}
                            onChange={(e) => updateCondition(cond, parseFloat(e.target.value) || 0)}
                            style={{ ...inp, width: 72 }} />
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>×</span>
                        </div>
                      </td>
                      <td style={{ ...td, color: '#6b7280' }}>{effPct.toFixed(1)}%</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>
                        ${Math.max(example, active.globalMinPrice).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ════ LANGUAGES tab ════ */}
        {tab === 'languages' && (
          <div>
            <p style={hint}>
              Multiplier applied after condition. Values above 1.0 mean the language commands a premium (e.g. Japanese foils), below 1.0 means a discount.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Language', 'Multiplier', 'Effect', 'Example ($10 NM, first range)'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LANGUAGES.map((lang) => {
                  const rule = active.languageMultipliers.find((l) => l.language === lang) ?? { language: lang, multiplier: 1 };
                  const range = active.priceRanges.find((r) => 10 >= r.min && 10 < r.max);
                  const rangePct = range ? (active.mode === 'trade' ? range.buyPercent + range.tradeOffset : range.buyPercent) : 0.5;
                  const nmMult = active.conditionMultipliers.find((c) => c.condition === 'NM')?.multiplier ?? 1;
                  const example = Math.max(10 * rangePct * nmMult * rule.multiplier, active.globalMinPrice);

                  return (
                    <tr key={lang} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={td}>
                        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>{lang}</span>
                        <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 12 }}>{LANGUAGE_LABELS[lang]}</span>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" min={0} max={3} step={0.05} value={rule.multiplier}
                            onChange={(e) => updateLanguage(lang, parseFloat(e.target.value) || 0)}
                            style={{ ...inp, width: 72 }} />
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>×</span>
                        </div>
                      </td>
                      <td style={{ ...td, fontSize: 12, color: rule.multiplier > 1 ? '#16a34a' : rule.multiplier < 1 ? '#dc2626' : '#9ca3af' }}>
                        {rule.multiplier > 1 ? `+${((rule.multiplier - 1) * 100).toFixed(0)}% premium` : rule.multiplier < 1 ? `-${((1 - rule.multiplier) * 100).toFixed(0)}% discount` : 'no change'}
                      </td>
                      <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>${example.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ════ ADVANCED tab ════ */}
        {tab === 'advanced' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={lbl}>Global minimum price ($)</label>
              <input type="number" min={0} step={0.01} value={active.globalMinPrice}
                onChange={(e) => updateActive({ globalMinPrice: parseFloat(e.target.value) || 0 })}
                style={inp} />
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>No card will be priced below this, regardless of percentages.</p>
            </div>
            <div>
              <label style={lbl}>Round final price to nearest ($)</label>
              <select value={active.roundTo} onChange={(e) => updateActive({ roundTo: parseFloat(e.target.value) })} style={inp}>
                {[0.01, 0.05, 0.10, 0.25, 0.50, 1.00].map((v) => (
                  <option key={v} value={v}>${v.toFixed(2)}</option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Rounds after all multipliers are applied.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Helper functions (defined inside component for updateActive closure) ── */}
    </div>
  );

  // ── Range editors ───────────────────────────────────────────────────────────
  function updateRanges(i: number, field: keyof PriceRange, val: number) {
    const next = active.priceRanges.map((r, j) => j === i ? { ...r, [field]: val } : r);
    updateActive({ priceRanges: next });
  }
  function addRange() {
    const last = active.priceRanges[active.priceRanges.length - 1];
    const newMin = last ? last.max : 0;
    updateActive({ priceRanges: [...active.priceRanges, { min: newMin, max: 1000, buyPercent: 0.5, tradeOffset: 0.2 }] });
  }
  function removeRange(i: number) {
    updateActive({ priceRanges: active.priceRanges.filter((_, j) => j !== i) });
  }

  // ── Condition multiplier editors ────────────────────────────────────────────
  function updateCondition(cond: CardCondition, val: number) {
    const exists = active.conditionMultipliers.some((c) => c.condition === cond);
    updateActive({
      conditionMultipliers: exists
        ? active.conditionMultipliers.map((c) => c.condition === cond ? { ...c, multiplier: val } : c)
        : [...active.conditionMultipliers, { condition: cond, multiplier: val }],
    });
  }

  // ── Language multiplier editors ─────────────────────────────────────────────
  function updateLanguage(lang: CardLanguage, val: number) {
    const exists = active.languageMultipliers.some((l) => l.language === lang);
    updateActive({
      languageMultipliers: exists
        ? active.languageMultipliers.map((l) => l.language === lang ? { ...l, multiplier: val } : l)
        : [...active.languageMultipliers, { language: lang, multiplier: val }],
    });
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 13,
  border: '1px solid #e5e7eb', borderRadius: 6,
  background: 'transparent', boxSizing: 'border-box',
};
const sel: React.CSSProperties = { ...inp, width: 'auto', minWidth: 220 };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const ghost: React.CSSProperties = {
  padding: '5px 12px', fontSize: 12, borderRadius: 6,
  border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', color: '#374151',
};
const th: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 11,
  fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #f3f4f6', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'middle' };
const hint: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 };
