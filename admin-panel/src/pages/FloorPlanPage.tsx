import { useRef, useState } from 'react';
import { api } from '../api';
import FloorPlanViewer from '../components/FloorPlanViewer';

export default function FloorPlanPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function uploadPlan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      setSaving(true); setMsg('');
      await api.post('/floor-plan', data);
      setMsg('Plan saved — refresh to see changes');
    } catch (err: any) {
      setMsg(err.response?.data?.error || 'Failed to save plan');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#e8e6dc', margin: 0 }}>
          Floor Plan
        </h2>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={saving}
          style={{
            padding: '5px 12px', borderRadius: 4, border: '1px solid #c8a84b',
            background: 'rgba(200,168,75,0.1)', color: '#c8a84b',
            fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer'
          }}
        >
          {saving ? 'Saving...' : 'Upload plan JSON'}
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={uploadPlan} />
        {msg && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: msg.includes('saved') ? '#4a9e6e' : '#e04030' }}>{msg}</span>}
      </div>

      <FloorPlanViewer />
    </div>
  );
}
