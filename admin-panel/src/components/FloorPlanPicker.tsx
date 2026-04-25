import { useState, useCallback } from 'react';
import { api } from '../api';
import FloorPlanViewer from './FloorPlanViewer';

interface Props {
  eventId: number;
  currentTableNumber?: string;
  onReserved: (tableNumber: string) => void;
  onClose: () => void;
}

export default function FloorPlanPicker({ eventId, currentTableNumber, onReserved, onClose }: Props) {
  const [selected, setSelected] = useState<{ id: number; table_number: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function reserve() {
    if (!selected) return;
    setLoading(true); setError('');
    try {
      await api.post(`/floor-plan/tables/${selected.id}/reserve`, { eventId });
      onReserved(selected.table_number);
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to reserve');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#1a1a16', border: '1px solid #2e2e28', borderRadius: 8,
        padding: 20, width: 'min(92vw, 900px)', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', gap: 12
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#c8a84b', fontSize: 14 }}>
            Select Table
          </span>
          {currentTableNumber && (
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#8a8880' }}>
              Current: {currentTableNumber}
            </span>
          )}
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#8a8880', cursor: 'pointer', fontSize: 18
          }}>✕</button>
        </div>

        {/* Floor plan — pick mode shows only free tables */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <FloorPlanViewer
            mode="pick"
            highlightTableId={selected?.id}
            onTableClick={t => setSelected({ id: t.id, table_number: t.table_number })}
          />
        </div>

        {error && (
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#e04030' }}>{error}</div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {selected && (
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#4a9e6e' }}>
              {selected.table_number} selected
            </span>
          )}
          <button onClick={onClose} style={{
            padding: '6px 14px', borderRadius: 4, border: '1px solid #2e2e28',
            background: 'transparent', color: '#8a8880', cursor: 'pointer',
            fontFamily: 'DM Mono, monospace', fontSize: 11
          }}>Cancel</button>
          <button onClick={reserve} disabled={!selected || loading} style={{
            padding: '6px 14px', borderRadius: 4, border: '1px solid #c8a84b',
            background: selected ? 'rgba(200,168,75,0.15)' : 'transparent',
            color: selected ? '#c8a84b' : '#555450', cursor: selected ? 'pointer' : 'not-allowed',
            fontFamily: 'DM Mono, monospace', fontSize: 11, opacity: loading ? 0.6 : 1
          }}>
            {loading ? 'Reserving...' : 'Reserve table'}
          </button>
        </div>
      </div>
    </div>
  );
}
