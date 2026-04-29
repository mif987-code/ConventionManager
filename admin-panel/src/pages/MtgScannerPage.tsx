import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  CardEntry,
  PricingSettings,
  PricingSummary,
} from '../lib/mtg-scanner';
import {
  priceList,
  loadPricingPresets,
  savePricingPresets,
  createDefaultPricingSettings,
  exportToCsv,
  parseExcelFile,
  resolveCardBatch,
  autocompleteCardName,
  getCardByName,
  getCardPrintings,
  getTcgPrice,
  getCardImageUrl,
  runScanPipeline,
} from '../lib/mtg-scanner';
import { CardListTable } from '../lib/mtg-scanner/components';
import { PricingSettingsPanel } from '../lib/mtg-scanner/components';

type Tab = 'scanner' | 'list' | 'manual' | 'excel' | 'pricing' | 'results';

const TABS: { key: Tab; label: string }[] = [
  { key: 'pricing',  label: 'Pricing Rules' },
  { key: 'scanner',  label: 'Scanner' },
  { key: 'manual',   label: 'Add Manually' },
  { key: 'excel',    label: 'Import Excel' },
  { key: 'list',     label: 'Card List' },
  { key: 'results',  label: 'Price Results' },
];

export default function MtgScannerPage() {
  const [tab, setTab] = useState<Tab>('pricing');
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
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">MTG Card Scanner</h1>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto pb-0 scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 font-medium transition whitespace-nowrap flex-shrink-0 ${
              tab === t.key
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.key === 'list' && entries.length > 0 && (
              <span className="ml-2 bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded text-xs">
                {entries.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'scanner' && (
        <ScannerTab entries={entries} onAddEntry={(e) => setEntries((prev) => [...prev, e])} onGoToList={() => setTab('list')} />
      )}

      {tab === 'list' && (
        <div>
          <CardListTable entries={entries} onChange={setEntries} adjustedPrices={adjustedPricesMap} />
          {entries.length > 0 && (
            <div className="mt-4 flex gap-3">
              <button onClick={() => setTab('results')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                View adjusted prices →
              </button>
              <button onClick={handleExport} className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">
                Export CSV
              </button>
              <button onClick={() => setEntries([])} className="border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50">
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
        <PricingSettingsPanel
          presets={presets}
          activePresetId={activePresetId}
          onPresetsChange={setPresets}
          onActiveChange={setActivePresetId}
        />
      )}

      {tab === 'results' && (
        <ResultsTab summary={summary} onExport={handleExport} activePreset={presets.find((p) => p.id === activePresetId)} />
      )}
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
  const [scanStatus, setScanStatus] = useState('');
  const [lastResult, setLastResult] = useState<CardEntry | null>(null);
  const scanInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanStatus('Camera not available. Open via HTTPS (https://YOUR_IP:5173).');
      return;
    }
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
    setScanStatus('Scanning — hold card steady...');

    scanInterval.current = setInterval(async () => {
      const result = await runScanPipeline(videoRef.current!, canvasRef.current!);
      if (result.status === 'error') {
        setScanStatus(`Error: ${result.error}`);
        return;
      }
      // 'confirming' = set+number hit (high confidence) — add and stop
      if ((result.status === 'confirming' || result.status === 'confirmed') && result.bestMatch) {
        const card = result.bestMatch;
        const price = getTcgPrice(card, 'nonfoil');
        const method = result.debugInfo?.method ?? 'ocr';
        const entry: CardEntry = {
          id: crypto.randomUUID(),
          name: card.name,
          setCode: card.set,
          setName: card.set_name,
          collectorNumber: card.collector_number,
          finish: 'nonfoil',
          condition: 'NM',
          language: 'EN',
          quantity: 1,
          tcgPrice: price,
          scryfallId: card.id,
          imageUrl: getCardImageUrl(card, 'normal') ?? undefined,
          needsConfirmation: true,
          source: 'scan',
        };
        setScanStatus(`✓ ${card.name} · ${card.set.toUpperCase()} #${card.collector_number} [${method}]`);
        setLastResult(entry);
        onAddEntry(entry);
        if (scanInterval.current) clearInterval(scanInterval.current);
        setScanning(false);
      } else if (result.status === 'matching' && result.bestMatch) {
        const d = result.debugInfo;
        setScanStatus(`~ ${result.bestMatch.name} · bottom: "${d?.bottomOcrText ?? '—'}" (${Math.round(result.confidence * 100)}%)`);
      } else {
        const d = result.debugInfo;
        setScanStatus(d?.bottomOcrText ? `Reading... "${d.bottomOcrText}"` : 'Scanning — hold card steady...');
      }
    }, 1200);
  }, [onAddEntry]);

  useEffect(() => () => { if (scanInterval.current) clearInterval(scanInterval.current); }, []);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Card scanner</h2>
      <p className="text-gray-600 mb-6">Point your camera at a Magic card to identify and add it to your list</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera view */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl overflow-hidden aspect-video relative">
          <video ref={videoRef} className="w-full h-full object-cover" style={{ display: cameraActive ? 'block' : 'none' }} playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="text-6xl">📷</div>
              <p className="text-gray-400">Camera not active</p>
              <button onClick={startCamera} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">Start camera</button>
            </div>
          )}

          {cameraActive && scanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[55%] aspect-[5/7] border-2 border-purple-400 rounded-lg opacity-70" />
            </div>
          )}

          {scanStatus && (
            <div className="absolute bottom-3 left-3 right-3 bg-black/75 rounded-lg p-3 text-sm text-white">
              {scanStatus}
            </div>
          )}
        </div>

        {/* Controls + recent */}
        <div className="flex flex-col gap-4">
          <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-purple-400">Controls</h3>
            {!cameraActive ? (
              <button onClick={startCamera} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">▶ Start camera</button>
            ) : (
              <>
                {!scanning ? (
                  <button onClick={startScan} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">🔍 Scan card</button>
                ) : (
                  <button onClick={() => { setScanning(false); if (scanInterval.current) clearInterval(scanInterval.current); }} className="border border-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-800">⏹ Stop</button>
                )}
                <button onClick={stopCamera} className="border border-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-800">Stop camera</button>
              </>
            )}
          </div>

          {lastResult && (
            <div className="bg-gray-900 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-3">Last scanned</h3>
              {lastResult.imageUrl && (
                <img src={lastResult.imageUrl} alt={lastResult.name} className="w-full rounded-lg mb-2" />
              )}
              <p className="font-semibold">{lastResult.name}</p>
              <p className="text-xs text-gray-400">{lastResult.setName} · {lastResult.collectorNumber}</p>
              {lastResult.tcgPrice !== null && (
                <p className="text-green-400">${lastResult.tcgPrice.toFixed(2)} TCG</p>
              )}
            </div>
          )}

          {entries.length > 0 && (
            <button onClick={onGoToList} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              View list ({entries.length} cards) →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manual Add Tab ───────────────────────────────────────────────────────────

function ManualAddTab({ onAddEntry, onGoToList }: { onAddEntry: (e: CardEntry) => void; onGoToList: () => void }) {
  const [searchName, setSearchName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [printings, setPrintings] = useState<any[]>([]);
  const [selectedPrintingId, setSelectedPrintingId] = useState('');
  const [finish, setFinish] = useState<'nonfoil' | 'foil' | 'etched'>('nonfoil');
  const [condition, setCondition] = useState<any>('NM');
  const [language, setLanguage] = useState<any>('EN');
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Card name</label>
          <input
            value={searchName}
            onChange={(e) => handleNameInput(e.target.value)}
            placeholder="e.g. Lightning Bolt"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-10">
              {suggestions.slice(0, 10).map((s) => (
                <div key={s} onMouseDown={() => handleSelectName(s)} className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {printings.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Printing / set</label>
            <select value={selectedPrintingId} onChange={(e) => setSelectedPrintingId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              {printings.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.set_name} ({p.set.toUpperCase()}) #{p.collector_number} — {p.rarity}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Finish</label>
            <select value={finish} onChange={(e) => setFinish(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="nonfoil">Nonfoil</option>
              <option value="foil">Foil</option>
              <option value="etched">Etched</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              {['NM','LP','MP','HP','D'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              {['EN','ES','FR','DE','IT','PT','JA','KO','RU','ZHS','ZHT','PH'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-24">
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>

        <button onClick={handleAdd} disabled={!selectedCard || loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Loading...' : '+ Add to list'}
        </button>
        <button onClick={onGoToList} className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">
          View card list →
        </button>
      </div>

      <div>
        {currentImg ? (
          <img src={currentImg} alt={currentCard?.name} className="w-full rounded-lg shadow-lg" />
        ) : (
          <div className="w-full aspect-[5/7] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
            Card preview
          </div>
        )}
        {currentPrice !== null && (
          <p className="text-center mt-2 text-green-600 font-semibold">
            ${currentPrice.toFixed(2)} TCGPlayer
          </p>
        )}
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
      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <h3 className="text-sm font-semibold text-indigo-600 mb-2">Expected columns</h3>
        <p className="text-sm text-gray-600 mb-4">
          Column names are flexible. At minimum you need a "Name" column. Optional: Set, Set Code, Collector #, Foil, Finish, Condition, Language, Quantity, Price.
        </p>
        <label className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer font-semibold hover:bg-indigo-700">
          Choose Excel file (.xlsx / .xls)
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
        </label>
      </div>

      {status !== 'idle' && (
        <div className={`rounded-lg p-4 mb-4 text-sm ${status === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-gray-50 border border-gray-200'}`}>
          {status === 'parsing' || status === 'resolving' ? '⟳ ' : status === 'done' ? '✓ ' : '✕ '}{message}
        </div>
      )}

      {preview.length > 0 && (
        <>
          <div className="mb-3 flex gap-3">
            <button onClick={() => { onAddEntries(preview); setPreview([]); setStatus('idle'); onGoToList(); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
              Add {preview.length} cards to list →
            </button>
            <button onClick={() => { setPreview([]); setStatus('idle'); }} className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
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
      <div className="text-center py-16 text-gray-500">
        <div className="text-5xl mb-4">💰</div>
        <p>Add cards to your list and configure pricing rules to see adjusted prices here.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Adjusted price results
        <span className="text-sm font-normal text-gray-500 ml-2">Using preset: {activePreset?.name ?? '—'} · {activePreset?.mode ?? ''}</span>
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total cards', value: summary.cardCount.toString(), color: 'text-indigo-600' },
          { label: 'Raw TCG value', value: `$${summary.totalRawPrice.toFixed(2)}`, color: 'text-blue-500' },
          { label: 'Adjusted total', value: `$${summary.totalAdjustedPrice.toFixed(2)}`, color: 'text-green-500' },
          { label: 'Effective %', value: `${summary.totalRawPrice > 0 ? ((summary.totalAdjustedPrice / summary.totalRawPrice) * 100).toFixed(1) : '—'}%`, color: 'text-orange-500' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <button onClick={onExport} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          Export CSV
        </button>
      </div>

      {/* Price table */}
      <div className="bg-gray-50 rounded-lg overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              {['Card', 'Set', 'Finish', 'Cond', 'Lang', 'Qty', 'TCG $', 'Applied %', 'Adj $', 'Line total'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.entries.map((e) => (
              <tr key={e.id} className="border-b border-gray-200">
                <td className="px-3 py-2 font-medium">{e.name}</td>
                <td className="px-3 py-2 text-gray-500">{e.setCode.toUpperCase()}</td>
                <td className="px-3 py-2 text-gray-500">{e.finish}</td>
                <td className="px-3 py-2">{e.condition}</td>
                <td className="px-3 py-2 text-gray-500">{e.language.toUpperCase()}</td>
                <td className="px-3 py-2">{e.quantity}</td>
                <td className="px-3 py-2 font-mono">{e.tcgPrice !== null ? `$${e.tcgPrice.toFixed(2)}` : '—'}</td>
                <td className="px-3 py-2 text-orange-500">{e.effectivePercent !== null ? `${(e.effectivePercent * 100).toFixed(1)}%` : '—'}</td>
                <td className="px-3 py-2 font-mono font-semibold text-green-500">
                  {e.adjustedPrice !== null ? `$${e.adjustedPrice.toFixed(2)}` : <span className="text-red-500">?</span>}
                </td>
                <td className="px-3 py-2 font-mono font-bold text-indigo-600">
                  {e.adjustedPrice !== null ? `$${(e.adjustedPrice * e.quantity).toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-100">
              <td colSpan={6} className="px-3 py-2 font-semibold">Totals</td>
              <td className="px-3 py-2 font-mono font-semibold">${summary.totalRawPrice.toFixed(2)}</td>
              <td />
              <td />
              <td className="px-3 py-2 font-mono font-bold text-green-500 text-base">
                ${summary.totalAdjustedPrice.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
