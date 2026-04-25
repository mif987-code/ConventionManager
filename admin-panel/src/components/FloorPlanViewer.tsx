import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api';

interface TableStatus {
  id: number;
  table_number: string;
  x: number; y: number; w: number; h: number;
  area_id?: number; area_name?: string; area_color?: string;
  is_reserved: boolean;
  event_id?: number; event_name?: string;
  reserved_by?: number; reserved_at?: string;
}

interface FloorPlan {
  tables: any[];
  customObjects: any[];
  areas: Array<{ id: number; name: string; color: string; tableIds: number[] }>;
}

type Filter = 'all' | 'free' | 'occupied';

interface Props {
  onTableClick?: (t: TableStatus) => void;
  highlightTableId?: number;
  mode?: 'view' | 'pick'; // pick = only free tables clickable
}

const VW = 22, VH = 11;

export default function FloorPlanViewer({ onTableClick, highlightTableId, mode = 'view' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [plan, setPlan] = useState<FloorPlan | null>(null);
  const [statuses, setStatuses] = useState<TableStatus[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [tooltip, setTooltip] = useState<{ t: TableStatus; cx: number; cy: number } | null>(null);
  const [SC, setSC] = useState(1);

  const toX = (x: number) => x * SC;
  const toY = (y: number) => y * SC;
  const toM = (v: number) => v * SC;

  const fetchData = useCallback(async () => {
    try {
      const [planRes, statusRes] = await Promise.all([
        api.get('/floor-plan'),
        api.get('/floor-plan/tables'),
      ]);
      setPlan(planRes.data);
      setStatuses(statusRes.data);
    } catch { /* no plan yet */ }
  }, []);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 15000); return () => clearInterval(t); }, [fetchData]);

  // Compute scale
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const obs = new ResizeObserver(() => {
      const s = Math.min(cv.parentElement!.clientWidth / VW, (cv.parentElement!.clientHeight || 400) / VH);
      setSC(s);
      cv.width = Math.round(VW * s);
      cv.height = Math.round(VH * s);
    });
    obs.observe(cv.parentElement!);
    return () => obs.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || !plan) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111109'; ctx.fillRect(0, 0, W, H);

    const areas = plan.areas || [];

    // Area backgrounds
    for (const area of areas) {
      if (areaFilter !== 'all' && area.name !== areaFilter) continue;
      const members = statuses.filter(t => area.tableIds.includes(t.id));
      if (!members.length) continue;
      const ax = Math.min(...members.map(t => t.x));
      const ay = Math.min(...members.map(t => t.y));
      const ax2 = Math.max(...members.map(t => t.x + t.w));
      const ay2 = Math.max(...members.map(t => t.y + t.h));
      const pad = toM(0.15);
      ctx.fillStyle = area.color + '22';
      ctx.strokeStyle = area.color + '88';
      ctx.lineWidth = 1; ctx.setLineDash([toM(0.12), toM(0.08)]);
      ctx.beginPath();
      ctx.roundRect(toX(ax) - pad, toY(ay) - pad, toX(ax2) - toX(ax) + pad * 2, toY(ay2) - toY(ay) + pad * 2, 4);
      ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = area.color + 'cc';
      ctx.font = `700 ${Math.max(8, toM(0.35))}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(area.name, toX(ax) - pad + 3, toY(ay) - pad - 3);
    }

    // Custom objects
    for (const o of plan.customObjects || []) {
      ctx.fillStyle = 'rgba(160,120,40,0.2)';
      ctx.strokeStyle = '#8a6a28';
      ctx.lineWidth = 1; ctx.setLineDash([toM(0.08), toM(0.06)]);
      ctx.beginPath(); ctx.roundRect(toX(o.x), toY(o.y), toM(o.w), toM(o.h), 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(200,168,75,0.8)';
      ctx.font = `600 ${Math.max(7, toM(0.26))}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.label, toX(o.x) + toM(o.w) / 2, toY(o.y) + toM(o.h) / 2);
    }

    // Tables
    for (const t of statuses) {
      const visible = filter === 'all'
        || (filter === 'free' && !t.is_reserved)
        || (filter === 'occupied' && t.is_reserved);
      if (!visible) continue;
      if (areaFilter !== 'all' && t.area_name !== areaFilter) continue;

      const isHighlight = t.id === highlightTableId;
      const tx = toX(t.x), ty = toY(t.y), tw = toM(t.w), th = toM(t.h);

      // Fill
      let fill = t.is_reserved ? 'rgba(200,80,50,0.45)' : 'rgba(50,170,90,0.35)';
      if (mode === 'pick' && t.is_reserved) fill = 'rgba(80,80,80,0.3)';
      if (isHighlight) fill = 'rgba(200,168,75,0.6)';
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 2); ctx.fill();

      // Border
      ctx.strokeStyle = t.is_reserved ? '#cc4030' : (isHighlight ? '#c8a84b' : '#3db870');
      ctx.lineWidth = isHighlight ? 2.5 : 1;
      ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 2); ctx.stroke();

      // Seat dots
      ctx.fillStyle = t.is_reserved ? '#cc4030' : '#3db870';
      if (t.w >= t.h) {
        const n = Math.max(2, Math.floor(t.w / 0.65)), sp = tw / (n + 1);
        for (let i = 1; i <= n; i++) {
          ctx.beginPath(); ctx.arc(tx + sp * i, ty - toM(0.055), Math.max(1.5, toM(0.038)), 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(tx + sp * i, ty + th + toM(0.055), Math.max(1.5, toM(0.038)), 0, Math.PI * 2); ctx.fill();
        }
      } else {
        const n = Math.max(2, Math.floor(t.h / 0.65)), sp = th / (n + 1);
        for (let i = 1; i <= n; i++) {
          ctx.beginPath(); ctx.arc(tx - toM(0.055), ty + sp * i, Math.max(1.5, toM(0.038)), 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(tx + tw + toM(0.055), ty + sp * i, Math.max(1.5, toM(0.038)), 0, Math.PI * 2); ctx.fill();
        }
      }

      // Table number
      if (Math.min(tw, th) > 14) {
        ctx.fillStyle = 'rgba(220,215,200,0.85)';
        ctx.font = `600 ${Math.max(7, Math.min(11, Math.min(tw, th) * 0.35))}px 'DM Mono',monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t.table_number, tx + tw / 2, ty + th / 2);
      }
    }

    // Venue border
    ctx.strokeStyle = '#3c3a30'; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.strokeRect(0, 0, W, H);

    // Doors
    ([[0, 1.2, 'E1'], [10.4, 1.2, 'E2']] as [number, number, string][]).forEach(([dx, dw, lbl]) => {
      const sx = toX(dx), ex = toX(dx + dw), ey = 0, mx = (sx + ex) / 2, hw = (ex - sx) / 2;
      ctx.fillStyle = '#111109'; ctx.fillRect(sx, ey - 1, ex - sx, 3);
      ctx.strokeStyle = '#c8a84b'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(sx, ey, hw, 0, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex, ey, hw, Math.PI / 2, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, ey); ctx.lineTo(mx, ey); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(mx, ey); ctx.stroke();
      ctx.fillStyle = '#c8a84b';
      [sx, ex].forEach(p => { ctx.beginPath(); ctx.arc(p, ey, Math.max(3, toM(0.09)), 0, Math.PI * 2); ctx.fill(); });
      ctx.font = `700 ${Math.max(8, toM(0.3))}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(lbl, mx, ey + toM(0.5));
    });

  }, [plan, statuses, filter, areaFilter, highlightTableId, SC, mode]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const wx = (e.clientX - r.left) / SC, wy = (e.clientY - r.top) / SC;
    const hit = statuses.find(t =>
      wx >= t.x && wx <= t.x + t.w && wy >= t.y && wy <= t.y + t.h
    );
    if (!hit) return;
    if (mode === 'pick' && hit.is_reserved) return;
    onTableClick?.(hit);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const wx = (e.clientX - r.left) / SC, wy = (e.clientY - r.top) / SC;
    const hit = statuses.find(t =>
      wx >= t.x && wx <= t.x + t.w && wy >= t.y && wy <= t.y + t.h
    );
    setTooltip(hit ? { t: hit, cx: e.clientX - r.left, cy: e.clientY - r.top } : null);
  }

  const uniqueAreas = Array.from(new Set(statuses.map(t => t.area_name).filter(Boolean)));
  const free = statuses.filter(t => !t.is_reserved).length;
  const occupied = statuses.filter(t => t.is_reserved).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'free', 'occupied'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '4px 10px', borderRadius: 4, border: '1px solid',
            borderColor: filter === f ? '#4a9e6e' : '#2e2e28',
            background: filter === f ? 'rgba(74,158,110,0.15)' : 'transparent',
            color: filter === f ? '#4a9e6e' : '#8a8880',
            fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer'
          }}>
            {f === 'all' ? `All (${statuses.length})` : f === 'free' ? `Free (${free})` : `Occupied (${occupied})`}
          </button>
        ))}
        <div style={{ width: 1, height: 16, background: '#2e2e28' }} />
        {['all', ...uniqueAreas].map(a => (
          <button key={a} onClick={() => setAreaFilter(a as string)} style={{
            padding: '4px 10px', borderRadius: 4, border: '1px solid',
            borderColor: areaFilter === a ? '#c8a84b' : '#2e2e28',
            background: areaFilter === a ? 'rgba(200,168,75,0.12)' : 'transparent',
            color: areaFilter === a ? '#c8a84b' : '#8a8880',
            fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer'
          }}>
            {a === 'all' ? 'All areas' : a}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', background: '#0f0f0d', borderRadius: 4 }}>
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          style={{ cursor: mode === 'pick' ? 'crosshair' : 'default', display: 'block', width: '100%' }}
        />
        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute', left: tooltip.cx + 12, top: tooltip.cy - 8,
            background: '#1a1a16', border: '1px solid #2e2e28', borderRadius: 4,
            padding: '6px 10px', fontFamily: 'DM Mono, monospace', fontSize: 11,
            color: '#e8e6dc', pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap'
          }}>
            <div style={{ color: '#c8a84b', fontWeight: 600 }}>{tooltip.t.table_number}</div>
            {tooltip.t.area_name && <div style={{ color: '#8a8880' }}>{tooltip.t.area_name}</div>}
            {tooltip.t.is_reserved
              ? <><div style={{ color: '#e04030' }}>Reserved</div><div>{tooltip.t.event_name}</div></>
              : <div style={{ color: '#4a9e6e' }}>Free</div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
