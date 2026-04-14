import { useState, useEffect } from 'react';
import { Plus, Pencil, Save, Trash2, Copy } from 'lucide-react';
import { eventTypes, prizeTemplates } from '../api';

const CATEGORIES = ['Draft', 'Sealed', 'Constructed', 'Commander'];
const FORMATS = ['Standard', 'Modern', 'Pioneer', 'PreModern'];
const TOURNAMENT_STRUCTURES = [
  { value: 'swiss', label: 'Swiss' },
  { value: 'single_elimination', label: 'Single Elimination' },
];

const CATEGORY_COLORS: Record<string, string> = {
  Draft: 'bg-blue-100 text-blue-700',
  Sealed: 'bg-purple-100 text-purple-700',
  Constructed: 'bg-amber-100 text-amber-700',
  Commander: 'bg-green-100 text-green-700',
};

function genNoTies(rounds: number) {
  const rows: { record: string; amount: string }[] = [];
  for (let w = rounds; w >= 0; w--) rows.push({ record: `${w}-${rounds - w}-0`, amount: '0' });
  return rows;
}
function genWithTies(rounds: number) {
  const rows: { record: string; amount: string }[] = [];
  for (let w = rounds; w >= 0; w--)
    for (let l = rounds - w; l >= 0; l--) rows.push({ record: `${w}-${l}-${rounds - w - l}`, amount: '0' });
  return rows;
}
function genPlacement(count: number) {
  const suffixes = ['st', 'nd', 'rd', 'th'];
  return Array.from({ length: count }, (_, i) => ({
    record: `${i + 1}${i < 3 ? suffixes[i] : 'th'}`,
    amount: '0',
  }));
}
function structToRows(struct: Record<string, number>, defaults: { record: string; amount: string }[]) {
  const map = new Map<string, string>();
  for (const d of defaults) map.set(d.record, '0');
  for (const [k, v] of Object.entries(struct)) map.set(k, String(v));
  return Array.from(map.entries()).map(([record, amount]) => ({ record, amount }));
}
function rowsToStruct(rows: { record: string; amount: string }[]) {
  const s: Record<string, number> = {};
  for (const r of rows) s[r.record] = parseInt(r.amount) || 0;
  return s;
}
function roundsForCategory(cat: string) {
  return cat === 'Commander' ? 1 : cat === 'Constructed' ? 4 : 3;
}
function isCommander(cat: string) { return cat === 'Commander'; }
function usesPlacement(cat: string, structure: string) { return cat === 'Commander' || structure === 'single_elimination'; }

interface PrizeTableProps {
  label: string;
  rows: { record: string; amount: string }[];
  onChange: (rows: { record: string; amount: string }[]) => void;
  readOnly?: boolean;
  compact?: boolean;
}
function PrizeTable({ label, rows, onChange, readOnly, compact }: PrizeTableProps) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1">{label}</h4>
      <table className={`w-full text-sm border border-gray-200 rounded-lg overflow-hidden ${compact ? '' : ''}`}>
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">W-L-T</th>
            <th className="text-left px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">Tix</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-1 font-mono text-gray-700 text-xs">{row.record}</td>
              <td className="px-3 py-1">
                {readOnly ? (
                  <span className="font-semibold text-gray-800 text-xs">{row.amount}</span>
                ) : (
                  <input type="number" min="0" value={row.amount}
                    onChange={(e) => { const u = [...rows]; u[i] = { ...u[i], amount: e.target.value }; onChange(u); }}
                    className="w-20 px-2 py-0.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EventTypesPage() {
  const [types, setTypes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [form, setForm] = useState({
    name: '', category: 'Draft', format: '' as string,
    tournament_structure: 'swiss',
    entry_cost_vouchers: '', max_players: '8',
    noTiesRows: genNoTies(3), tiesRows: genWithTies(3),
  });

  async function load() {
    try {
      setLoading(true);
      const [tRes, pRes] = await Promise.all([eventTypes.list(), prizeTemplates.list()]);
      setTypes(tRes.event_types || []);
      setTemplates(pRes.templates || []);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function handleCategoryChange(cat: string, target: 'form' | 'edit') {
    const struct = target === 'form' ? form.tournament_structure : editForm.tournament_structure;
    const maxP = cat === 'Commander' ? '4' : cat === 'Constructed' ? '16' : '8';
    const r = roundsForCategory(cat);
    const placement = usesPlacement(cat, struct);
    const placementCount = cat === 'Commander' ? 4 : parseInt(maxP);
    const noTies = placement ? genPlacement(placementCount) : genNoTies(r);
    const ties = placement ? [] : genWithTies(r);
    if (target === 'form') {
      setForm({ ...form, category: cat, format: cat === 'Constructed' ? 'Standard' : '', max_players: maxP, noTiesRows: noTies, tiesRows: ties });
    } else {
      setEditForm({ ...editForm, category: cat, format: cat === 'Constructed' ? 'Standard' : '', max_players: maxP, noTiesRows: noTies, tiesRows: ties });
    }
  }

  function applyTemplate(templateId: number, target: 'form' | 'edit') {
    const tmpl = templates.find((t: any) => t.id === templateId);
    if (!tmpl) return;
    const cat = target === 'form' ? form.category : editForm.category;
    const struct = target === 'form' ? form.tournament_structure : editForm.tournament_structure;
    const placement = usesPlacement(cat, struct);
    const placementCount = cat === 'Commander' ? 4 : parseInt(target === 'form' ? form.max_players : editForm.max_players) || 8;
    const defaults = placement ? genPlacement(placementCount) : genNoTies(tmpl.rounds);
    const noTies = structToRows(tmpl.prize_structure || {}, defaults);
    const ties = placement ? [] : structToRows(tmpl.prize_structure_ties || {}, genWithTies(tmpl.rounds));
    if (target === 'form') {
      setForm({ ...form, noTiesRows: noTies, tiesRows: ties });
    } else {
      setEditForm({ ...editForm, noTiesRows: noTies, tiesRows: ties });
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await eventTypes.create({
        name: form.name, category: form.category,
        format: form.category === 'Constructed' ? form.format : null,
        tournament_structure: form.tournament_structure,
        entry_cost_vouchers: parseInt(form.entry_cost_vouchers),
        max_players: parseInt(form.max_players),
        prize_structure: rowsToStruct(form.noTiesRows),
        prize_structure_ties: rowsToStruct(form.tiesRows),
      });
      setForm({ name: '', category: 'Draft', format: '', tournament_structure: 'swiss', entry_cost_vouchers: '', max_players: '8', noTiesRows: genNoTies(3), tiesRows: genWithTies(3) });
      setShowCreate(false);
      load();
    } catch (err: any) { setError(err.message); }
  }

  function startEdit(t: any) {
    const cat = t.category || 'Draft';
    const struct = t.tournament_structure || 'swiss';
    const r = roundsForCategory(cat);
    const placement = usesPlacement(cat, struct);
    const placementCount = cat === 'Commander' ? 4 : (t.max_players || 8);
    const defaults = placement ? genPlacement(placementCount) : genNoTies(r);
    setEditingId(t.id);
    setEditForm({
      name: t.name, category: cat, format: t.format || '',
      tournament_structure: struct,
      entry_cost_vouchers: String(t.entry_cost_vouchers), max_players: String(t.max_players),
      noTiesRows: structToRows(t.prize_structure || {}, defaults),
      tiesRows: placement ? [] : structToRows(t.prize_structure_ties || {}, genWithTies(r)),
    });
  }

  async function handleSaveEdit() {
    try {
      await eventTypes.update(editingId!, {
        name: editForm.name, category: editForm.category,
        format: editForm.category === 'Constructed' ? editForm.format : null,
        tournament_structure: editForm.tournament_structure,
        entry_cost_vouchers: parseInt(editForm.entry_cost_vouchers),
        max_players: parseInt(editForm.max_players),
        prize_structure: rowsToStruct(editForm.noTiesRows),
        prize_structure_ties: rowsToStruct(editForm.tiesRows),
      });
      setEditingId(null);
      load();
    } catch (err: any) { setError(err.message); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this event type? This cannot be undone.')) return;
    try {
      await eventTypes.delete(id);
      load();
    } catch (err: any) { setError(err.message); }
  }

  async function handleDuplicate(id: number) {
    try {
      await eventTypes.duplicate(id);
      load();
    } catch (err: any) { setError(err.message); }
  }

  function renderTemplateSelector(target: 'form' | 'edit') {
    const cat = target === 'form' ? form.category : editForm.category;
    const struct = target === 'form' ? form.tournament_structure : editForm.tournament_structure;
    const placement = usesPlacement(cat, struct);
    const hasPlacementKeys = (t: any) => {
      const keys = Object.keys(t.prize_structure || {});
      return keys.some((k: string) => /^\d+(st|nd|rd|th)$/.test(k));
    };
    const matching = placement
      ? templates.filter((t: any) => t.rounds === 1 || hasPlacementKeys(t))
      : templates.filter((t: any) => t.rounds >= 2 && !hasPlacementKeys(t));
    if (matching.length === 0) return (
      <p className="text-xs text-gray-400 italic">No saved templates yet. Create one in Prize Templates.</p>
    );
    const grouped = matching.reduce((acc: Record<number, any[]>, t: any) => {
      (acc[t.rounds] = acc[t.rounds] || []).push(t);
      return acc;
    }, {} as Record<number, any[]>);
    return (
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500">Load from template:</label>
        <select
          defaultValue=""
          onChange={(e) => { if (e.target.value) applyTemplate(parseInt(e.target.value), target); }}
          className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">— Select template —</option>
          {Object.entries(grouped)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([rounds, tmpls]) => (
              <optgroup key={rounds} label={placement ? (parseInt(rounds) === 1 ? 'Commander (Placement)' : `Placement – ${rounds} rounds`) : `${rounds} rounds`}>
                {(tmpls as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            ))}
        </select>
      </div>
    );
  }

  function renderFieldsForm(target: 'form' | 'edit') {
    const f = target === 'form' ? form : editForm;
    const setF = target === 'form'
      ? (v: any) => setForm(v)
      : (v: any) => setEditForm(v);

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Category *</label>
            <select value={f.category} onChange={(e) => handleCategoryChange(e.target.value, target)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {f.category === 'Constructed' && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Format *</label>
              <select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                {FORMATS.map((fm) => <option key={fm} value={fm}>{fm}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Name *</label>
            <input placeholder="e.g. Friday Night Draft" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}
              required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Entry Cost *</label>
            <input type="number" min="0" value={f.entry_cost_vouchers} onChange={(e) => setF({ ...f, entry_cost_vouchers: e.target.value })}
              required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Max Players</label>
            <input type="number" min="2" value={f.max_players} onChange={(e) => setF({ ...f, max_players: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Structure *</label>
            <select value={f.tournament_structure} onChange={(e) => {
              const newStruct = e.target.value;
              const placement = usesPlacement(f.category, newStruct);
              const placementCount = isCommander(f.category) ? 4 : parseInt(f.max_players) || 8;
              const r = roundsForCategory(f.category);
              const noTies = placement ? genPlacement(placementCount) : genNoTies(r);
              const ties = placement ? [] : genWithTies(r);
              setF({ ...f, tournament_structure: newStruct, noTiesRows: noTies, tiesRows: ties });
            }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
              {TOURNAMENT_STRUCTURES.map(ts => <option key={ts.value} value={ts.value}>{ts.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 mb-2">{renderTemplateSelector(target)}</div>

        {usesPlacement(f.category, f.tournament_structure) ? (
          <div className="max-w-sm">
            <PrizeTable label={`Placement Prizes (1st – ${isCommander(f.category) ? '4th' : f.max_players + 'th'})`} rows={f.noTiesRows}
              onChange={(rows) => setF({ ...f, noTiesRows: rows })} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PrizeTable label="Without Ties" rows={f.noTiesRows}
              onChange={(rows) => setF({ ...f, noTiesRows: rows })} />
            <PrizeTable label="With Ties" rows={f.tiesRows}
              onChange={(rows) => setF({ ...f, tiesRows: rows })} />
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Event Types</h1>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
          <Plus size={16} /> Create Type
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Create Event Type</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {renderFieldsForm('form')}
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition font-medium">
              Create
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {types.map((t: any) => (
            <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {editingId === t.id ? (
                <div className="space-y-4">
                  {renderFieldsForm('edit')}
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSaveEdit} className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium">
                      <Save size={14} /> Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex items-center gap-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm font-medium">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[t.category] || 'bg-gray-100 text-gray-600'}`}>
                          {t.category}
                        </span>
                        {t.format && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{t.format}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.tournament_structure === 'single_elimination' ? 'bg-red-100 text-red-700' : 'bg-cyan-100 text-cyan-700'}`}>
                          {t.tournament_structure === 'single_elimination' ? 'Single Elim' : 'Swiss'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-800">{t.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Entry: {t.entry_cost_vouchers} vouchers &middot; Max {t.max_players} players
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDuplicate(t.id)} className="text-gray-400 hover:text-blue-600 transition" title="Duplicate">
                        <Copy size={16} />
                      </button>
                      <button onClick={() => startEdit(t)} className="text-gray-400 hover:text-indigo-600 transition" title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-600 transition" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {isCommander(t.category) ? (
                    <div className="max-w-sm">
                      <PrizeTable label="Placement Prizes (1st – 4th)" readOnly compact
                        rows={structToRows(t.prize_structure || {}, genPlacement(4))}
                        onChange={() => {}} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <PrizeTable label="Without Ties" readOnly compact
                        rows={structToRows(t.prize_structure || {}, genNoTies(roundsForCategory(t.category || 'Draft')))}
                        onChange={() => {}} />
                      {Object.keys(t.prize_structure_ties || {}).length > 0 && (
                        <PrizeTable label="With Ties" readOnly compact
                          rows={structToRows(t.prize_structure_ties || {}, genWithTies(roundsForCategory(t.category || 'Draft')))}
                          onChange={() => {}} />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {types.length === 0 && (
            <div className="text-center text-gray-400 py-8">No event types created yet</div>
          )}
        </div>
      )}
    </div>
  );
}
