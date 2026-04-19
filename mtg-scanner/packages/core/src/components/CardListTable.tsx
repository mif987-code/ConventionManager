import React, { useState, useCallback, useRef } from 'react';
import type { CardEntry, CardCondition, CardFinish, CardLanguage, ScryfallCard } from '../types';
import {
  CONDITION_LABELS,
  LANGUAGE_LABELS,
} from '../types';
import {
  autocompleteCardName,
  getCardByName,
  getCardPrintings,
  getTcgPrice,
  getCardImageUrl,
} from '../services/scryfall';

interface CardListTableProps {
  entries: CardEntry[];
  onChange: (entries: CardEntry[]) => void;
  /** If true, show adjusted price column (pass from pricing summary) */
  adjustedPrices?: Record<string, number>;
  className?: string;
}

const CONDITIONS: CardCondition[] = ['M', 'NM', 'LP', 'MP', 'HP', 'D'];
const FINISHES: CardFinish[] = ['nonfoil', 'foil', 'etched'];
const LANGUAGES: CardLanguage[] = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'ru', 'zhs', 'zht', 'ph'];

export function CardListTable({ entries, onChange, adjustedPrices, className }: CardListTableProps) {
  const [loadingRows, setLoadingRows] = useState<Set<string>>(new Set());
  const [nameOptions, setNameOptions] = useState<Record<string, string[]>>({});
  const [printings, setPrintings] = useState<Record<string, ScryfallCard[]>>({});
  const [hoveredImage, setHoveredImage] = useState<{ id: string; url: string; x: number; y: number } | null>(null);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const updateEntry = useCallback(
    (id: string, patch: Partial<CardEntry>) => {
      onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    },
    [entries, onChange]
  );

  const removeEntry = useCallback(
    (id: string) => onChange(entries.filter((e) => e.id !== id)),
    [entries, onChange]
  );

  const confirmEntry = useCallback(
    async (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      setLoadingRows((s) => new Set(s).add(id));
      try {
        const card = await getCardByName(entry.name, entry.setCode || undefined);
        if (card) {
          const price = getTcgPrice(card, entry.finish);
          updateEntry(id, {
            scryfallId: card.id,
            setCode: card.set,
            setName: card.set_name,
            collectorNumber: card.collector_number,
            tcgPrice: price,
            imageUrl: getCardImageUrl(card, 'normal') ?? undefined,
            needsConfirmation: false,
          });
        }
      } finally {
        setLoadingRows((s) => { const n = new Set(s); n.delete(id); return n; });
      }
    },
    [entries, updateEntry]
  );

  const handleNameChange = useCallback(
    async (id: string, value: string) => {
      updateEntry(id, { name: value, needsConfirmation: true });
      clearTimeout(debounceRef.current[id]);
      debounceRef.current[id] = setTimeout(async () => {
        const opts = await autocompleteCardName(value);
        setNameOptions((prev) => ({ ...prev, [id]: opts }));
      }, 300);
    },
    [updateEntry]
  );

  const handleNameSelect = useCallback(
    async (id: string, name: string) => {
      setNameOptions((prev) => ({ ...prev, [id]: [] }));
      updateEntry(id, { name, needsConfirmation: true });
      // Load printings for this card
      setLoadingRows((s) => new Set(s).add(id));
      try {
        const card = await getCardByName(name);
        if (card) {
          const prints = await getCardPrintings(card.oracle_id);
          setPrintings((prev) => ({ ...prev, [id]: prints }));
          // Auto-fill with most recent printing
          const price = getTcgPrice(card, 'nonfoil');
          updateEntry(id, {
            scryfallId: card.id,
            setCode: card.set,
            setName: card.set_name,
            collectorNumber: card.collector_number,
            tcgPrice: price,
            imageUrl: getCardImageUrl(card, 'normal') ?? undefined,
            needsConfirmation: false,
          });
        }
      } finally {
        setLoadingRows((s) => { const n = new Set(s); n.delete(id); return n; });
      }
    },
    [updateEntry]
  );

  const handlePrintingSelect = useCallback(
    async (id: string, scryfallId: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      const options = printings[id] ?? [];
      const card = options.find((c) => c.id === scryfallId);
      if (!card) return;
      const price = getTcgPrice(card, entry.finish);
      updateEntry(id, {
        scryfallId: card.id,
        setCode: card.set,
        setName: card.set_name,
        collectorNumber: card.collector_number,
        tcgPrice: price,
        imageUrl: getCardImageUrl(card, 'normal') ?? undefined,
        needsConfirmation: false,
      });
    },
    [entries, printings, updateEntry]
  );

  const addEmptyRow = useCallback(() => {
    const newEntry: CardEntry = {
      id: crypto.randomUUID(),
      name: '',
      setCode: '',
      setName: '',
      collectorNumber: '',
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      quantity: 1,
      tcgPrice: null,
      scryfallId: null,
      needsConfirmation: false,
      source: 'manual',
    };
    onChange([...entries, newEntry]);
  }, [entries, onChange]);

  return (
    <div className={`mtg-card-list ${className ?? ''}`} style={{ position: 'relative' }}>
      {/* Card image hover preview */}
      {hoveredImage && (
        <img
          src={hoveredImage.url}
          alt="Card preview"
          style={{
            position: 'fixed',
            left: hoveredImage.x + 16,
            top: hoveredImage.y - 60,
            width: 200,
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border-primary, #ddd)' }}>
              {['', 'Card Name', 'Set', '#', 'Finish', 'Cond', 'Lang', 'Qty', 'TCG $', 'Adj $', ''].map((h, i) => (
                <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isLoading = loadingRows.has(entry.id);
              const opts = nameOptions[entry.id] ?? [];
              const prints = printings[entry.id] ?? [];
              const adjPrice = adjustedPrices?.[entry.id];
              const rowStyle: React.CSSProperties = {
                borderBottom: '1px solid var(--color-border-tertiary, #eee)',
                background: entry.needsConfirmation
                  ? 'var(--color-background-warning, #fffbeb)'
                  : undefined,
                opacity: isLoading ? 0.6 : 1,
              };

              return (
                <tr key={entry.id} style={rowStyle}>
                  {/* Image indicator */}
                  <td style={{ padding: '6px 8px', width: 28 }}>
                    {entry.imageUrl && (
                      <div
                        style={{ width: 20, height: 28, background: '#888', borderRadius: 2, cursor: 'pointer', overflow: 'hidden' }}
                        onMouseEnter={(e) => setHoveredImage({ id: entry.id, url: entry.imageUrl!, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setHoveredImage(null)}
                      >
                        <img src={entry.imageUrl} alt="" style={{ width: '100%' }} />
                      </div>
                    )}
                  </td>

                  {/* Card name with autocomplete */}
                  <td style={{ padding: '4px 8px', minWidth: 200, position: 'relative' }}>
                    <input
                      value={entry.name}
                      onChange={(e) => handleNameChange(entry.id, e.target.value)}
                      placeholder="Card name..."
                      style={inputStyle}
                    />
                    {opts.length > 0 && (
                      <div style={dropdownStyle}>
                        {opts.slice(0, 8).map((opt) => (
                          <div
                            key={opt}
                            style={dropdownItemStyle}
                            onMouseDown={() => handleNameSelect(entry.id, opt)}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Set selector */}
                  <td style={{ padding: '4px 8px', minWidth: 160 }}>
                    {prints.length > 0 ? (
                      <select
                        value={entry.scryfallId ?? ''}
                        onChange={(e) => handlePrintingSelect(entry.id, e.target.value)}
                        style={inputStyle}
                      >
                        {prints.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.set_name} ({p.set.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={entry.setName || entry.setCode}
                        readOnly={!!entry.scryfallId}
                        onChange={(e) => updateEntry(entry.id, { setCode: e.target.value })}
                        placeholder="Set..."
                        style={{ ...inputStyle, color: entry.setCode ? undefined : '#999' }}
                      />
                    )}
                  </td>

                  {/* Collector number */}
                  <td style={{ padding: '4px 8px', width: 60 }}>
                    <input
                      value={entry.collectorNumber}
                      onChange={(e) => updateEntry(entry.id, { collectorNumber: e.target.value })}
                      placeholder="#"
                      style={{ ...inputStyle, textAlign: 'center' }}
                    />
                  </td>

                  {/* Finish */}
                  <td style={{ padding: '4px 8px', width: 90 }}>
                    <select
                      value={entry.finish}
                      onChange={(e) => updateEntry(entry.id, { finish: e.target.value as CardFinish })}
                      style={inputStyle}
                    >
                      {FINISHES.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </td>

                  {/* Condition */}
                  <td style={{ padding: '4px 8px', width: 80 }}>
                    <select
                      value={entry.condition}
                      onChange={(e) => updateEntry(entry.id, { condition: e.target.value as CardCondition })}
                      style={inputStyle}
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>

                  {/* Language */}
                  <td style={{ padding: '4px 8px', width: 90 }}>
                    <select
                      value={entry.language}
                      onChange={(e) => updateEntry(entry.id, { language: e.target.value as CardLanguage })}
                      style={inputStyle}
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l} value={l}>{l.toUpperCase()}</option>
                      ))}
                    </select>
                  </td>

                  {/* Quantity */}
                  <td style={{ padding: '4px 8px', width: 60 }}>
                    <input
                      type="number"
                      min={1}
                      value={entry.quantity}
                      onChange={(e) => updateEntry(entry.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      style={{ ...inputStyle, textAlign: 'center' }}
                    />
                  </td>

                  {/* TCG price */}
                  <td style={{ padding: '4px 12px', width: 70, textAlign: 'right', fontFamily: 'monospace' }}>
                    {entry.tcgPrice !== null ? `$${entry.tcgPrice.toFixed(2)}` : <span style={{ color: '#bbb' }}>—</span>}
                  </td>

                  {/* Adjusted price */}
                  <td style={{ padding: '4px 12px', width: 70, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                    {adjPrice !== undefined ? (
                      <span style={{ color: adjPrice < (entry.tcgPrice ?? 0) ? '#d97706' : '#16a34a' }}>
                        ${adjPrice.toFixed(2)}
                      </span>
                    ) : <span style={{ color: '#bbb' }}>—</span>}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '4px 8px', width: 80, whiteSpace: 'nowrap' }}>
                    {entry.needsConfirmation && (
                      <button
                        onClick={() => confirmEntry(entry.id)}
                        disabled={isLoading}
                        style={confirmBtnStyle}
                        title="Confirm this card match"
                      >
                        {isLoading ? '…' : '✓ Confirm'}
                      </button>
                    )}
                    <button
                      onClick={() => removeEntry(entry.id)}
                      style={removeBtnStyle}
                      title="Remove row"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '0 4px' }}>
        <button onClick={addEmptyRow} style={addBtnStyle}>
          + Add row
        </button>
        <div style={{ fontSize: 12, color: '#888' }}>
          {entries.length} card{entries.length !== 1 ? 's' : ''}
          {entries.some((e) => e.needsConfirmation) && (
            <span style={{ marginLeft: 8, color: '#d97706' }}>
              ⚠ {entries.filter((e) => e.needsConfirmation).length} need confirmation
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  fontSize: 13,
  border: '1px solid #ddd',
  borderRadius: 4,
  background: 'transparent',
  boxSizing: 'border-box',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: 'white',
  border: '1px solid #ddd',
  borderRadius: 4,
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
  zIndex: 1000,
  maxHeight: 200,
  overflowY: 'auto',
};

const dropdownItemStyle: React.CSSProperties = {
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: 13,
};

const confirmBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 11,
  borderRadius: 4,
  border: '1px solid #d97706',
  background: '#fffbeb',
  color: '#d97706',
  cursor: 'pointer',
  marginRight: 4,
};

const removeBtnStyle: React.CSSProperties = {
  padding: '2px 6px',
  fontSize: 11,
  borderRadius: 4,
  border: '1px solid #fca5a5',
  background: '#fff1f2',
  color: '#dc2626',
  cursor: 'pointer',
};

const addBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#f9fafb',
  cursor: 'pointer',
  fontWeight: 500,
};
