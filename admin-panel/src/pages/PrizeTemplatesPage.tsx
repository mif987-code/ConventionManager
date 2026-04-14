import { useState, useEffect } from 'react';
import { Plus, Pencil, Save, X, Trash2 } from 'lucide-react';
import { prizeTemplates } from '../api';

/** Generate all W-L records for a given number of rounds (no ties) */
function generateRecordsNoTies(rounds: number): string[] {
  const records: string[] = [];
  for (let w = rounds; w >= 0; w--) {
    records.push(`${w}-${rounds - w}-0`);
  }
  return records;
}

/** Generate all W-L-T records for a given number of rounds (with ties) */
function generateRecordsWithTies(rounds: number): string[] {
  const records: string[] = [];
  for (let w = rounds; w >= 0; w--) {
    for (let l = rounds - w; l >= 0; l--) {
      const t = rounds - w - l;
      records.push(`${w}-${l}-${t}`);
    }
  }
  return records;
}

/** Generate placement records for Commander (1st-4th) */
function generatePlacement(count: number): string[] {
  const suffixes = ['st', 'nd', 'rd', 'th'];
  return Array.from({ length: count }, (_, i) => `${i + 1}${i < 3 ? suffixes[i] : 'th'}`);
}

function isPlacementRounds(rounds: number) { return rounds === 1; }

function defaultRows(records: string[]): { record: string; amount: string }[] {
  return records.map((r) => ({ record: r, amount: '0' }));
}

function rowsFromStructure(structure: Record<string, number>, allRecords: string[]): { record: string; amount: string }[] {
  // Merge existing values with all possible records
  const map = new Map<string, string>();
  for (const r of allRecords) map.set(r, '0');
  for (const [k, v] of Object.entries(structure)) map.set(k, String(v));
  return Array.from(map.entries()).map(([record, amount]) => ({ record, amount }));
}

interface PrizeTableProps {
  label: string;
  rows: { record: string; amount: string }[];
  onChange: (rows: { record: string; amount: string }[]) => void;
  readOnly?: boolean;
}

function PrizeTable({ label, rows, onChange, readOnly }: PrizeTableProps) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">{label}</h4>
      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase w-32">Record (W-L-T)</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Tix Payout</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-2 font-mono text-gray-700">{row.record}</td>
              <td className="px-4 py-2">
                {readOnly ? (
                  <span className="font-semibold text-gray-800">{row.amount}</span>
                ) : (
                  <input
                    type="number"
                    min="0"
                    value={row.amount}
                    onChange={(e) => {
                      const updated = [...rows];
                      updated[i] = { ...updated[i], amount: e.target.value };
                      onChange(updated);
                    }}
                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrizeTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    rounds: 3,
    noTiesRows: defaultRows(generateRecordsNoTies(3)),
    tiesRows: defaultRows(generateRecordsWithTies(3)),
  });

  // Edit form state
  const [editForm, setEditForm] = useState<any>({});

  async function loadTemplates() {
    try {
      setLoading(true);
      const res = await prizeTemplates.list();
      setTemplates(res.templates || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTemplates(); }, []);

  function handleRoundsChange(rounds: number) {
    if (isPlacementRounds(rounds)) {
      setCreateForm({
        ...createForm,
        rounds,
        noTiesRows: defaultRows(generatePlacement(4)),
        tiesRows: [],
      });
    } else {
      setCreateForm({
        ...createForm,
        rounds,
        noTiesRows: defaultRows(generateRecordsNoTies(rounds)),
        tiesRows: defaultRows(generateRecordsWithTies(rounds)),
      });
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const prizeStructure: Record<string, number> = {};
      for (const r of createForm.noTiesRows) prizeStructure[r.record] = parseInt(r.amount) || 0;

      const prizeStructureTies: Record<string, number> = {};
      for (const r of createForm.tiesRows) prizeStructureTies[r.record] = parseInt(r.amount) || 0;

      await prizeTemplates.create({
        name: createForm.name,
        rounds: createForm.rounds,
        prize_structure: prizeStructure,
        prize_structure_ties: prizeStructureTies,
      });

      setCreateForm({
        name: '',
        rounds: 3,
        noTiesRows: defaultRows(generateRecordsNoTies(3)),
        tiesRows: defaultRows(generateRecordsWithTies(3)),
      });
      setShowCreate(false);
      loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(t: any) {
    const placement = isPlacementRounds(t.rounds);
    const defaultRecords = placement ? generatePlacement(4) : generateRecordsNoTies(t.rounds);
    setEditingId(t.id);
    setEditForm({
      name: t.name,
      rounds: t.rounds,
      noTiesRows: rowsFromStructure(t.prize_structure || {}, defaultRecords),
      tiesRows: placement ? [] : rowsFromStructure(t.prize_structure_ties || {}, generateRecordsWithTies(t.rounds)),
    });
  }

  async function handleSaveEdit() {
    try {
      const prizeStructure: Record<string, number> = {};
      for (const r of editForm.noTiesRows) prizeStructure[r.record] = parseInt(r.amount) || 0;

      const prizeStructureTies: Record<string, number> = {};
      for (const r of editForm.tiesRows) prizeStructureTies[r.record] = parseInt(r.amount) || 0;

      await prizeTemplates.update(editingId!, {
        name: editForm.name,
        rounds: editForm.rounds,
        prize_structure: prizeStructure,
        prize_structure_ties: prizeStructureTies,
      });
      setEditingId(null);
      loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this prize template?')) return;
    try {
      await prizeTemplates.delete(id);
      loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Group templates by rounds
  const grouped = templates.reduce((acc: Record<number, any[]>, t: any) => {
    (acc[t.rounds] = acc[t.rounds] || []).push(t);
    return acc;
  }, {} as Record<number, any[]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Prize Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Pre-saved prize structures grouped by round count. Each has a no-ties and with-ties variant.</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
        >
          <Plus size={16} /> Create Template
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Create Prize Template</h2>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Template Name *</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Standard 3-Round Draft"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Number of Rounds *</label>
                <select
                  value={createForm.rounds}
                  onChange={(e) => handleRoundsChange(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value={1}>Commander (Placement 1st–4th)</option>
                  {[2, 3, 4, 5, 6].map((r) => (
                    <option key={r} value={r}>{r} rounds</option>
                  ))}
                </select>
              </div>
            </div>

            {isPlacementRounds(createForm.rounds) ? (
              <div className="max-w-sm">
                <PrizeTable
                  label="Placement Prizes (1st – 4th)"
                  rows={createForm.noTiesRows}
                  onChange={(rows) => setCreateForm({ ...createForm, noTiesRows: rows })}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PrizeTable
                  label="Without Ties"
                  rows={createForm.noTiesRows}
                  onChange={(rows) => setCreateForm({ ...createForm, noTiesRows: rows })}
                />
                <PrizeTable
                  label="With Ties"
                  rows={createForm.tiesRows}
                  onChange={(rows) => setCreateForm({ ...createForm, tiesRows: rows })}
                />
              </div>
            )}

            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition font-medium">
              Create Template
            </button>
          </form>
        </div>
      )}

      {/* Templates List grouped by rounds */}
      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-400">
          No prize templates created yet. Click "Create Template" to add one.
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([rounds, tmpls]) => (
              <div key={rounds}>
                <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
                    {parseInt(rounds as string) === 1 ? 'Commander (Placement)' : `${rounds} rounds`}
                  </span>
                </h2>
                <div className="grid gap-4">
                  {(tmpls as any[]).map((t: any) => (
                    <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      {editingId === t.id ? (
                        /* --- Edit mode --- */
                        <div className="space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-medium text-gray-500 mb-1 block">Name</label>
                              <input
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 mb-1 block">Rounds</label>
                              <input
                                type="number"
                                value={editForm.rounds}
                                disabled
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                              />
                            </div>
                          </div>

                          {isPlacementRounds(editForm.rounds) ? (
                            <div className="max-w-sm">
                              <PrizeTable
                                label="Placement Prizes (1st – 4th)"
                                rows={editForm.noTiesRows}
                                onChange={(rows) => setEditForm({ ...editForm, noTiesRows: rows })}
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <PrizeTable
                                label="Without Ties"
                                rows={editForm.noTiesRows}
                                onChange={(rows) => setEditForm({ ...editForm, noTiesRows: rows })}
                              />
                              <PrizeTable
                                label="With Ties"
                                rows={editForm.tiesRows}
                                onChange={(rows) => setEditForm({ ...editForm, tiesRows: rows })}
                              />
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button onClick={handleSaveEdit} className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium">
                              <Save size={14} /> Save
                            </button>
                            <button onClick={() => setEditingId(null)} className="flex items-center gap-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm font-medium">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* --- Read mode --- */
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-800">{t.name}</h3>
                            <div className="flex items-center gap-2">
                              <button onClick={() => startEdit(t)} className="text-gray-400 hover:text-indigo-600 transition">
                                <Pencil size={16} />
                              </button>
                              <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-600 transition">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          {isPlacementRounds(t.rounds) ? (
                            <div className="max-w-sm">
                              <PrizeTable
                                label="Placement Prizes (1st – 4th)"
                                rows={rowsFromStructure(t.prize_structure || {}, generatePlacement(4))}
                                onChange={() => {}}
                                readOnly
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <PrizeTable
                                label="Without Ties"
                                rows={rowsFromStructure(t.prize_structure || {}, generateRecordsNoTies(t.rounds))}
                                onChange={() => {}}
                                readOnly
                              />
                              <PrizeTable
                                label="With Ties"
                                rows={rowsFromStructure(t.prize_structure_ties || {}, generateRecordsWithTies(t.rounds))}
                                onChange={() => {}}
                                readOnly
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
