import React, { useState, useRef, useCallback, useEffect } from 'react';
import type {
  CardEntry,
  PricingSettings,
  PricingSummary,
} from '@mtg-scanner/core';
import {
  priceList,
  loadPricingPresets,
  savePricingPresets,
  createDefaultPricingSettings,
  exportToCsv,
  runScanPipeline,
  getCardByName,
  getTcgPrice,
  getCardImageUrl,
  parseExcelFile,
  resolveCardBatch,
} from '@mtg-scanner/core';
import { CardListTable } from '@mtg-scanner/core/components';
import { PricingSettingsPanel } from '@mtg-scanner/core/components';

// ─── Tab definitions ──────────────────────────────────────────────────────────
type Tab = 'scanner' | 'list' | 'manual' | 'excel' | 'pricing' | 'results';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'scanner',  label: 'Scanner',       icon: '📷' },
  { key: 'list',     label: 'Card list',      icon: '📋' },
  { key: 'manual',   label: 'Add manually',   icon: '🔍' },
  { key: 'excel',    label: 'Import Excel',   icon: '📊' },
  { key: 'pricing',  label: 'Pricing rules',  icon: '⚙️' },
  { key: 'results',  label: 'Price results',  icon: '💰' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('scanner');
  const [entries, setEntries] = useState<CardEntry[]>([]);
  const [presets, setPresets] = useState<PricingSettings[]>(loadPricingPresets);
  const [activePresetId, setActivePresetId] = useState<string>(presets[0]?.id ?? '');
  const [summary, setSummary] = useState<PricingSummary | null>(null);

  // Persist pricing presets
  useEffect(() => { savePricingPresets(presets); }, [presets]);

  // Recompute pricing whenever entries or active preset changes
  useEffect(() => {
    const active = presets.find((p) => p.id === activePresetId);
    if (active && entries.length > 0) {
      setSummary(priceList(entries, active));
    } else {
      setSummary(null);
    }
  }, [entries, presets, activePresetId]);

  const adjustedPricesMap = summary
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

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f13', color: '#e8e6f0', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: '#1a1a2e', borderBottom: '1px solid #2d2d4e', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#a78bfa', letterSpacing: '-0.5px' }}>
          ⟡ MTG Scanner
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: '#7c7c9e' }}>
          {entries.length} card{entries.length !== 1 ? 's' : ''} in list
          {summary && (
            <span style={{ marginLeft: 12, color: '#a78bfa', fontWeight: 600 }}>
              · ${summary.totalAdjustedPrice.toFixed(2)} adjusted
            </span>
          )}
        </div>
      </header>

      {/* Tab bar */}
      <nav style={{ background: '#16162a', borderBottom: '1px solid #2d2d4e', padding: '0 24px', display: 'flex', gap: 2 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: tab === t.key ? '#a78bfa' : '#7c7c9e',
              borderBottom: tab === t.key ? '2px solid #a78bfa' : '2px solid transparent',
              fontWeight: tab === t.key ? 600 : 400,
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            {t.icon} {t.label}
            {t.key === 'list' && entries.length > 0 && (
              <span style={{ marginLeft: 6, background: '#a78bfa', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                {entries.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {tab === 'scanner' && (
          <ScannerTab entries={entries} onAddEntry={(e) => setEntries((prev) => [...prev, e])} onGoToList={() => setTab('list')} />
        )}
        {tab === 'list' && (
          <div>
            <SectionHeader title="Card list" subtitle="Review, edit, and manage all scanned or imported cards" />
            <CardListTable entries={entries} onChange={setEntries} adjustedPrices={adjustedPricesMap} />
            {entries.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                <button onClick={() => setTab('results')} style={primaryBtnStyle}>
                  💰 View adjusted prices →
                </button>
                <button onClick={handleExport} style={secondaryBtnStyle}>
                  ⬇ Export CSV
                </button>
                <button onClick={() => setEntries([])} style={{ ...secondaryBtnStyle, color: '#f87171', borderColor: '#f87171' }}>
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
        {tab === 'manual' && (
          <ManualAddTab onAddEntry={(e) => { setEntries((prev) => [...prev, e]); }} onGoToList={() => setTab('list')} />
        )}
        {tab === 'excel' && (
          <ExcelImportTab onAddEntries={(es) => { setEntries((prev) => [...prev, ...es]); }} onGoToList={() => setTab('list')} />
        )}
        {tab === 'pricing' && (
          <div>
            <SectionHeader title="Pricing rules" subtitle="Configure buylist and trade percentages by condition, language, finish, and rarity" />
            <PricingSettingsPanel
              presets={presets}
              activePresetId={activePresetId}
              onPresetsChange={setPresets}
              onActiveChange={setActivePresetId}
            />
          </div>
        )}
        {tab === 'results' && (
          <ResultsTab summary={summary} onExport={handleExport} activePreset={presets.find((p) => p.id === activePresetId)} />
        )}
      </main>
    </div>
  );
}

// ─── Scanner Tab ──────────────────────────────────────────────────────────────

function ScannerTab({ entries, onAddEntry, onGoToList }: {
  entries: CardEntry[];
  onAddEntry: (e: CardEntry) => void;
  onGoToList: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [lastResult, setLastResult] = useState<CardEntry | null>(null);
  const scanInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (e) {
      setScanStatus('Camera access denied. Please allow camera permission.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());
    setCameraActive(false);
    setScanning(false);
    if (scanInterval.current) clearInterval(scanInterval.current);
  }, []);

  const startScan = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanning(true);
    setScanStatus('Detecting card...');

    scanInterval.current = setInterval(async () => {
      const result = await runScanPipeline(videoRef.current!, canvasRef.current!);
      if (result.status === 'error') {
        setScanStatus(`Error: ${result.error}`);
        return;
      }
      if (result.status === 'confirmed' && result.bestMatch) {
        setScanStatus(`✓ Found: ${result.bestMatch.name}`);
        const card = result.bestMatch;
        const price = getTcgPrice(card, 'nonfoil');
        const entry: CardEntry = {
          id: crypto.randomUUID(),
          name: card.name,
          setCode: card.set,
          setName: card.set_name,
          collectorNumber: card.collector_number,
          finish: 'nonfoil',
          condition: 'NM',
          language: 'en',
          quantity: 1,
          tcgPrice: price,
          scryfallId: card.id,
          imageUrl: getCardImageUrl(card, 'normal') ?? undefined,
          needsConfirmation: result.confidence < 0.85,
          source: 'scan',
        };
        setLastResult(entry);
        onAddEntry(entry);
        if (scanInterval.current) clearInterval(scanInterval.current);
        setScanning(false);
      } else if (result.status === 'confirming' && result.bestMatch) {
        setScanStatus(`? Possible: ${result.bestMatch.name} (${Math.round(result.confidence * 100)}% confidence)`);
      } else {
        setScanStatus('Scanning...');
      }
    }, 800);
  }, [onAddEntry]);

  useEffect(() => () => { if (scanInterval.current) clearInterval(scanInterval.current); }, []);

  return (
    <div>
      <SectionHeader title="Card scanner" subtitle="Point your camera at a Magic card to identify and add it to your list" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Camera view */}
        <div style={{ background: '#1a1a2e', borderRadius: 12, overflow: 'hidden', aspectRatio: '16/9', position: 'relative' }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }} playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {!cameraActive && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
              <div style={{ fontSize: 48 }}>📷</div>
              <p style={{ color: '#7c7c9e', margin: 0 }}>Camera not active</p>
              <button onClick={startCamera} style={primaryBtnStyle}>Start camera</button>
            </div>
          )}

          {cameraActive && scanning && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              {/* Card guide overlay */}
              <div style={{ width: '55%', aspectRatio: '5/7', border: '2px solid #a78bfa', borderRadius: 8, opacity: 0.7 }} />
            </div>
          )}

          {scanStatus && (
            <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, background: 'rgba(0,0,0,0.75)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#e8e6f0' }}>
              {scanStatus}
            </div>
          )}
        </div>

        {/* Controls + recent */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: '#a78bfa' }}>Controls</h3>
            {!cameraActive ? (
              <button onClick={startCamera} style={primaryBtnStyle}>▶ Start camera</button>
            ) : (
              <>
                {!scanning ? (
                  <button onClick={startScan} style={primaryBtnStyle}>🔍 Scan card</button>
                ) : (
                  <button onClick={() => { setScanning(false); if (scanInterval.current) clearInterval(scanInterval.current); }} style={secondaryBtnStyle}>⏹ Stop</button>
                )}
                <button onClick={stopCamera} style={secondaryBtnStyle}>Stop camera</button>
              </>
            )}
          </div>

          {lastResult && (
            <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#a78bfa' }}>Last scanned</h3>
              {lastResult.imageUrl && (
                <img src={lastResult.imageUrl} alt={lastResult.name} style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />
              )}
              <p style={{ margin: '4px 0', fontWeight: 600 }}>{lastResult.name}</p>
              <p style={{ margin: '4px 0', fontSize: 12, color: '#7c7c9e' }}>{lastResult.setName} · {lastResult.collectorNumber}</p>
              {lastResult.tcgPrice !== null && (
                <p style={{ margin: '4px 0', fontSize: 13, color: '#4ade80' }}>${lastResult.tcgPrice.toFixed(2)} TCG</p>
              )}
              {lastResult.needsConfirmation && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#fbbf24' }}>⚠ Needs confirmation in card list</p>
              )}
            </div>
          )}

          <button onClick={onGoToList} style={{ ...secondaryBtnStyle, marginTop: 'auto' }}>
            View card list ({entries.length}) →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Manual Add Tab ───────────────────────────────────────────────────────────

function ManualAddTab({ onAddEntry, onGoToList }: { onAddEntry: (e: CardEntry) => void; onGoToList: () => void }) {
  const [searchName, setSearchName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<import('@mtg-scanner/core').ScryfallCard | null>(null);
  const [printings, setPrintings] = useState<import('@mtg-scanner/core').ScryfallCard[]>([]);
  const [selectedPrintingId, setSelectedPrintingId] = useState('');
  const [finish, setFinish] = useState<'nonfoil' | 'foil' | 'etched'>('nonfoil');
  const [condition, setCondition] = useState<import('@mtg-scanner/core').CardCondition>('NM');
  const [language, setLanguage] = useState<import('@mtg-scanner/core').CardLanguage>('en');
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  const { autocompleteCardName, getCardByName, getCardPrintings, getTcgPrice, getCardImageUrl } = require('@mtg-scanner/core');

  const handleNameInput = async (val: string) => {
    setSearchName(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const opts = await autocompleteCardName(val);
      setSuggestions(opts);
    }, 300);
  };

  const handleSelectName = async (name: string) => {
    setSuggestions([]);
    setSearchName(name);
    setLoading(true);
    try {
      const card = await getCardByName(name);
      if (card) {
        setSelectedCard(card);
        const prints = await getCardPrintings(card.oracle_id);
        setPrintings(prints);
        setSelectedPrintingId(card.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    const card = printings.find((p) => p.id === selectedPrintingId) ?? selectedCard;
    if (!card) return;
    const price = getTcgPrice(card, finish);
    const entry: CardEntry = {
      id: crypto.randomUUID(),
      name: card.name,
      setCode: card.set,
      setName: card.set_name,
      collectorNumber: card.collector_number,
      finish,
      condition,
      language,
      quantity: qty,
      tcgPrice: price,
      scryfallId: card.id,
      imageUrl: getCardImageUrl(card, 'normal') ?? undefined,
      needsConfirmation: false,
      source: 'manual',
    };
    onAddEntry(entry);
    setSearchName('');
    setSelectedCard(null);
    setPrintings([]);
    setQty(1);
  };

  const currentCard = printings.find((p) => p.id === selectedPrintingId) ?? selectedCard;
  const currentPrice = currentCard ? getTcgPrice(currentCard, finish) : null;
  const currentImg = currentCard ? getCardImageUrl(currentCard, 'normal') : null;

  return (
    <div>
      <SectionHeader title="Add card manually" subtitle="Search by name using Scryfall autocomplete, then select the specific printing" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name search */}
          <div style={{ position: 'relative' }}>
            <label style={fieldLabel}>Card name</label>
            <input
              value={searchName}
              onChange={(e) => handleNameInput(e.target.value)}
              placeholder="e.g. Lightning Bolt"
              style={darkInputStyle}
            />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 6, zIndex: 100, maxHeight: 240, overflowY: 'auto' }}>
                {suggestions.slice(0, 10).map((s) => (
                  <div key={s} onMouseDown={() => handleSelectName(s)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #2d2d4e' }}>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Printing selector */}
          {printings.length > 0 && (
            <div>
              <label style={fieldLabel}>Printing / set</label>
              <select value={selectedPrintingId} onChange={(e) => setSelectedPrintingId(e.target.value)} style={darkInputStyle}>
                {printings.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.set_name} ({p.set.toUpperCase()}) #{p.collector_number} — {p.rarity}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={fieldLabel}>Finish</label>
              <select value={finish} onChange={(e) => setFinish(e.target.value as any)} style={darkInputStyle}>
                <option value="nonfoil">Nonfoil</option>
                <option value="foil">Foil</option>
                <option value="etched">Etched</option>
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value as any)} style={darkInputStyle}>
                {['M','NM','LP','MP','HP','D'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value as any)} style={darkInputStyle}>
                {['en','es','fr','de','it','pt','ja','ko','ru','zhs','zht','ph'].map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ width: 100 }}>
            <label style={fieldLabel}>Quantity</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} style={darkInputStyle} />
          </div>

          <button onClick={handleAdd} disabled={!selectedCard || loading} style={primaryBtnStyle}>
            {loading ? 'Loading...' : '+ Add to list'}
          </button>
          <button onClick={onGoToList} style={secondaryBtnStyle}>View card list →</button>
        </div>

        {/* Card preview */}
        <div>
          {currentImg ? (
            <img src={currentImg} alt={currentCard?.name} style={{ width: '100%', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '5/7', background: '#1a1a2e', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c7c9e', fontSize: 13 }}>
              Card preview
            </div>
          )}
          {currentPrice !== null && (
            <p style={{ textAlign: 'center', marginTop: 8, color: '#4ade80', fontWeight: 600 }}>
              ${currentPrice.toFixed(2)} TCGPlayer
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Excel Import Tab ─────────────────────────────────────────────────────────

function ExcelImportTab({ onAddEntries, onGoToList }: { onAddEntries: (es: CardEntry[]) => void; onGoToList: () => void }) {
  const [status, setStatus] = useState<'idle' | 'parsing' | 'resolving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<CardEntry[]>([]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('parsing');
    setMessage('Parsing Excel file...');
    try {
      const { entries, warnings } = await parseExcelFile(file);
      setStatus('resolving');
      setMessage(`Resolving ${entries.length} cards via Scryfall (this may take a moment)...`);

      const resolved = await resolveCardBatch(
        entries.map((e) => ({ name: e.name, setCode: e.setCode || undefined, collectorNumber: e.collectorNumber || undefined }))
      );

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
      setStatus('done');
      setMessage(`Parsed ${final.length} cards. ${final.filter((e) => e.needsConfirmation).length} need confirmation.`);
      if (warnings.length) setMessage((m) => m + ' Warnings: ' + warnings.join(', '));
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div>
      <SectionHeader title="Import from Excel" subtitle="Upload a spreadsheet with your card list — flexible column matching" />

      <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#a78bfa' }}>Expected columns</h3>
        <p style={{ fontSize: 13, color: '#7c7c9e', margin: '0 0 16px' }}>
          Column names are flexible. At minimum you need a "Name" column. Optional: Set, Set Code, Collector #, Foil, Finish, Condition, Language, Quantity, Price.
        </p>
        <label style={{ display: 'inline-block', padding: '10px 20px', background: '#a78bfa', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          Choose Excel file (.xlsx / .xls)
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      </div>

      {status !== 'idle' && (
        <div style={{ background: status === 'error' ? '#2d1a1a' : '#1a1a2e', border: `1px solid ${status === 'error' ? '#f87171' : '#2d2d4e'}`, borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 13 }}>
          {status === 'parsing' || status === 'resolving' ? '⟳ ' : status === 'done' ? '✓ ' : '✕ '}{message}
        </div>
      )}

      {preview.length > 0 && (
        <>
          <div style={{ marginBottom: 12, display: 'flex', gap: 12 }}>
            <button onClick={() => { onAddEntries(preview); setPreview([]); setStatus('idle'); onGoToList(); }} style={primaryBtnStyle}>
              Add {preview.length} cards to list →
            </button>
            <button onClick={() => { setPreview([]); setStatus('idle'); }} style={secondaryBtnStyle}>Cancel</button>
          </div>
          <CardListTable entries={preview} onChange={setPreview} />
        </>
      )}
    </div>
  );
}

// ─── Results Tab ──────────────────────────────────────────────────────────────

function ResultsTab({ summary, onExport, activePreset }: { summary: PricingSummary | null; onExport: () => void; activePreset?: PricingSettings }) {
  if (!summary || summary.entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: '#7c7c9e' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
        <p>Add cards to your list and configure pricing rules to see adjusted prices here.</p>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Adjusted price results" subtitle={`Using preset: ${activePreset?.name ?? '—'} · ${activePreset?.mode ?? ''}`} />

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total cards', value: summary.cardCount.toString(), color: '#a78bfa' },
          { label: 'Raw TCG value', value: `$${summary.totalRawPrice.toFixed(2)}`, color: '#60a5fa' },
          { label: 'Adjusted total', value: `$${summary.totalAdjustedPrice.toFixed(2)}`, color: '#4ade80' },
          { label: 'Effective %', value: `${summary.totalRawPrice > 0 ? ((summary.totalAdjustedPrice / summary.totalRawPrice) * 100).toFixed(1) : '—'}%`, color: '#fb923c' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#1a1a2e', borderRadius: 12, padding: 16 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#7c7c9e' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <button onClick={onExport} style={primaryBtnStyle}>⬇ Export CSV</button>
      </div>

      {/* Price table */}
      <div style={{ background: '#1a1a2e', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2d2d4e' }}>
              {['Card', 'Set', 'Finish', 'Cond', 'Lang', 'Qty', 'TCG $', 'Applied %', 'Adj $', 'Line total'].map((h) => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#7c7c9e', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.entries.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid #1e1e34' }}>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{e.name}</td>
                <td style={{ padding: '8px 12px', color: '#7c7c9e' }}>{e.setCode.toUpperCase()}</td>
                <td style={{ padding: '8px 12px', color: '#7c7c9e' }}>{e.finish}</td>
                <td style={{ padding: '8px 12px' }}>{e.condition}</td>
                <td style={{ padding: '8px 12px', color: '#7c7c9e' }}>{e.language.toUpperCase()}</td>
                <td style={{ padding: '8px 12px' }}>{e.quantity}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{e.tcgPrice !== null ? `$${e.tcgPrice.toFixed(2)}` : '—'}</td>
                <td style={{ padding: '8px 12px', color: '#fb923c' }}>{e.appliedPercentage !== null ? `${e.appliedPercentage.toFixed(1)}%` : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#4ade80' }}>
                  {e.adjustedPrice !== null ? `$${e.adjustedPrice.toFixed(2)}` : <span style={{ color: '#f87171' }}>?</span>}
                </td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#a78bfa' }}>
                  {e.adjustedPrice !== null ? `$${(e.adjustedPrice * e.quantity).toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #2d2d4e', background: '#16162a' }}>
              <td colSpan={6} style={{ padding: '10px 12px', fontWeight: 600 }}>Totals</td>
              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>${summary.totalRawPrice.toFixed(2)}</td>
              <td />
              <td />
              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#4ade80', fontSize: 15 }}>
                ${summary.totalAdjustedPrice.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#e8e6f0' }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 13, color: '#7c7c9e' }}>{subtitle}</p>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px', fontSize: 13, fontWeight: 600, border: 'none',
  borderRadius: 8, background: '#a78bfa', color: 'white', cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px', fontSize: 13, fontWeight: 500,
  border: '1px solid #2d2d4e', borderRadius: 8, background: 'transparent',
  color: '#a8a8c8', cursor: 'pointer',
};

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#7c7c9e', marginBottom: 4,
};

const darkInputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #2d2d4e', borderRadius: 6,
  background: '#16162a', color: '#e8e6f0', boxSizing: 'border-box',
};
