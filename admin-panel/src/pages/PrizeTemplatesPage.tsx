import { useState, useEffect } from 'react';
import { Plus, Pencil, Save, X, Trash2, ClipboardPaste } from 'lucide-react';
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

/** For 3-round: split ties by draw count */
function generateRecords3RoundByDraws(draws: number): string[] {
  const records: string[] = [];
  const rounds = 3;
  for (let w = rounds; w >= 0; w--) {
    for (let l = rounds - w; l >= 0; l--) {
      const t = rounds - w - l;
      if (t === draws) records.push(`${w}-${l}-${t}`);
    }
  }
  return records;
}

const IS_3_ROUND_SPLIT = (rounds: number) => rounds === 3;

/** Generate placement records for Commander (1st-4th) */
function generatePlacement(count: number): string[] {
  const suffixes = ['st', 'nd', 'rd', 'th'];
  return Array.from({ length: count }, (_, i) => `${i + 1}${i < 3 ? suffixes[i] : 'th'}`);
}

/** Value used by the Number of Rounds <select>: 'commander' for placement, else the round count as a string */
function roundsSelectValue(rounds: number, isPlacement: boolean): string {
  return isPlacement ? 'commander' : String(rounds);
}

function defaultRows(records: string[]): { record: string; amount: string }[] {
  return records.map((r) => ({ record: r, amount: '0' }));
}

function rowsFromStructure(structure: Record<string, number>, allRecords: string[]): { record: string; amount: string }[] {
  const map = new Map<string, string>();
  for (const r of allRecords) map.set(r, '0');
  for (const [k, v] of Object.entries(structure)) map.set(k, String(v));
  return Array.from(map.entries()).map(([record, amount]) => ({ record, amount }));
}

type TieRows3 = {
  draw1: { record: string; amount: string }[];
  draw2: { record: string; amount: string }[];
  highDraw: { record: string; amount: string }[];
};

function defaultTieRows3(): TieRows3 {
  return {
    draw1: defaultRows(generateRecords3RoundByDraws(1)),
    draw2: defaultRows(generateRecords3RoundByDraws(2)),
    highDraw: defaultRows(generateRecords3RoundByDraws(3)),
  };
}

function tieRows3FromStructure(structure: Record<string, number>): TieRows3 {
  return {
    draw1: rowsFromStructure(structure, generateRecords3RoundByDraws(1)),
    draw2: rowsFromStructure(structure, generateRecords3RoundByDraws(2)),
    highDraw: rowsFromStructure(structure, generateRecords3RoundByDraws(3)),
  };
}

function tieRows3ToStructure(tieRows: TieRows3): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of [...tieRows.draw1, ...tieRows.draw2, ...tieRows.highDraw]) {
    out[r.record] = parseInt(r.amount) || 0;
  }
  return out;
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

interface PasteImportProps {
  onImport: (rows: { record: string; amount: string }[]) => void;
  existingRecords: string[];
  label: string;
}

function PasteImport({ onImport, existingRecords, label }: PasteImportProps) {
  const [records, setRecords] = useState('');
  const [payouts, setPayouts] = useState('');
  const [importError, setImportError] = useState('');

  function handleImport() {
    setImportError('');
    const recLines = records.split('\n').map(l => l.trim()).filter(Boolean);
    const payLines = payouts.split('\n').map(l => l.trim()).filter(Boolean);

    if (recLines.length === 0 && payLines.length === 0) {
      setImportError('Paste at least one column.');
      return;
    }

    // If only payouts pasted, map to existing records in order
    if (recLines.length === 0 && payLines.length > 0) {
      const mapped = existingRecords.map((rec, i) => ({
        record: rec,
        amount: payLines[i] ?? '0',
      }));
      onImport(mapped);
      setRecords('');
      setPayouts('');
      return;
    }

    if (recLines.length !== payLines.length) {
      setImportError(`Records (${recLines.length} lines) and Payouts (${payLines.length} lines) must have the same number of rows, or paste only Payouts.`);
      return;
    }

    const mapped = recLines.map((rec, i) => ({
      record: rec,
      amount: payLines[i],
    }));
    onImport(mapped);
    setRecords('');
    setPayouts('');
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardPaste size={15} className="text-indigo-600" />
        <span className="text-sm font-medium text-indigo-700">Paste Import — {label}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Records (Breakdown) — optional if pasting payouts only</label>
          <textarea
            rows={5}
            value={records}
            onChange={e => setRecords(e.target.value)}
            placeholder={"3-0-0\n2-1-0\n1-2-0\n0-3-0"}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Payouts (Tix per Player)</label>
          <textarea
            rows={5}
            value={payouts}
            onChange={e => setPayouts(e.target.value)}
            placeholder={"30\n20\n10\n4"}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
          />
        </div>
      </div>
      {importError && <p className="text-red-600 text-xs mb-2">{importError}</p>}
      <button
        type="button"
        onClick={handleImport}
        className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700 transition font-medium"
      >
        Import
      </button>
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
    is_placement: false,
    noTiesRows: defaultRows(generateRecordsNoTies(3)),
    tiesRows: defaultRows(generateRecordsWithTies(3)),
    tieRows3: defaultTieRows3(),
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

  function handleRoundsSelectChange(value: string) {
    if (value === 'commander') {
      setCreateForm({
        ...createForm,
        rounds: 1,
        is_placement: true,
        noTiesRows: defaultRows(generatePlacement(4)),
        tiesRows: [],
        tieRows3: defaultTieRows3(),
      });
    } else {
      const rounds = parseInt(value);
      setCreateForm({
        ...createForm,
        rounds,
        is_placement: false,
        noTiesRows: defaultRows(generateRecordsNoTies(rounds)),
        tiesRows: defaultRows(generateRecordsWithTies(rounds)),
        tieRows3: defaultTieRows3(),
      });
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const prizeStructure: Record<string, number> = {};
      for (const r of createForm.noTiesRows) prizeStructure[r.record] = parseInt(r.amount) || 0;

      const prizeStructureTies: Record<string, number> = IS_3_ROUND_SPLIT(createForm.rounds)
        ? tieRows3ToStructure(createForm.tieRows3)
        : Object.fromEntries(createForm.tiesRows.map(r => [r.record, parseInt(r.amount) || 0]));

      await prizeTemplates.create({
        name: createForm.name,
        rounds: createForm.rounds,
        is_placement: createForm.is_placement,
        prize_structure: prizeStructure,
        prize_structure_ties: prizeStructureTies,
      });

      setCreateForm({
        name: '',
        rounds: 3,
        is_placement: false,
        noTiesRows: defaultRows(generateRecordsNoTies(3)),
        tiesRows: defaultRows(generateRecordsWithTies(3)),
        tieRows3: defaultTieRows3(),
      });
      setShowCreate(false);
      loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(t: any) {
    const placement = !!t.is_placement;
    const defaultRecords = placement ? generatePlacement(4) : generateRecordsNoTies(t.rounds);
    setEditingId(t.id);
    setEditForm({
      name: t.name,
      rounds: t.rounds,
      is_placement: placement,
      noTiesRows: rowsFromStructure(t.prize_structure || {}, defaultRecords),
      tiesRows: placement ? [] : rowsFromStructure(t.prize_structure_ties || {}, generateRecordsWithTies(t.rounds)),
      tieRows3: !placement && IS_3_ROUND_SPLIT(t.rounds) ? tieRows3FromStructure(t.prize_structure_ties || {}) : defaultTieRows3(),
    });
  }

  async function handleSaveEdit() {
    try {
      const prizeStructure: Record<string, number> = {};
      for (const r of editForm.noTiesRows) prizeStructure[r.record] = parseInt(r.amount) || 0;

      const prizeStructureTies: Record<string, number> = IS_3_ROUND_SPLIT(editForm.rounds)
        ? tieRows3ToStructure(editForm.tieRows3)
        : Object.fromEntries((editForm.tiesRows || []).map((r: any) => [r.record, parseInt(r.amount) || 0]));

      await prizeTemplates.update(editingId!, {
        name: editForm.name,
        rounds: editForm.rounds,
        is_placement: editForm.is_placement,
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

  // Group templates by rounds, keeping Commander/placement templates separate from a
  // plain "1 round, win/loss only" template even though both use rounds = 1.
  const groupKey = (t: any) => (t.is_placement ? 'commander' : String(t.rounds));
  const groupOrder = (key: string) => (key === 'commander' ? -1 : parseInt(key));
  const groupLabel = (key: string) =>
    key === 'commander' ? 'Commander (Placement)' : key === '1' ? '1 Round (Win/Loss only)' : `${key} rounds`;
  const grouped = templates.reduce((acc: Record<string, any[]>, t: any) => {
    const key = groupKey(t);
    (acc[key] = acc[key] || []).push(t);
    return acc;
  }, {} as Record<string, any[]>);

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
                  value={roundsSelectValue(createForm.rounds, createForm.is_placement)}
                  onChange={(e) => handleRoundsSelectChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="commander">Commander (Placement 1st–4th)</option>
                  <option value="1">1 Round (Win/Loss only)</option>
                  {[2, 3, 4, 5, 6].map((r) => (
                    <option key={r} value={r}>{r} rounds</option>
                  ))}
                </select>
              </div>
            </div>

            {createForm.is_placement ? (
              <div className="max-w-sm">
                <PasteImport
                  label="Placement"
                  existingRecords={createForm.noTiesRows.map(r => r.record)}
                  onImport={(rows) => setCreateForm({ ...createForm, noTiesRows: rows })}
                />
                <PrizeTable
                  label="Placement Prizes (1st – 4th)"
                  rows={createForm.noTiesRows}
                  onChange={(rows) => setCreateForm({ ...createForm, noTiesRows: rows })}
                />
              </div>
            ) : IS_3_ROUND_SPLIT(createForm.rounds) ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <PasteImport label="Without Ties" existingRecords={createForm.noTiesRows.map(r => r.record)} onImport={(rows) => setCreateForm({ ...createForm, noTiesRows: rows })} />
                  <PrizeTable label="Without Ties" rows={createForm.noTiesRows} onChange={(rows) => setCreateForm({ ...createForm, noTiesRows: rows })} />
                </div>
                <div className="space-y-6">
                  <div>
                    <PasteImport label="With Ties — 1 Draw" existingRecords={createForm.tieRows3.draw1.map(r => r.record)} onImport={(rows) => setCreateForm({ ...createForm, tieRows3: { ...createForm.tieRows3, draw1: rows } })} />
                    <PrizeTable label="With Ties — 1 Draw" rows={createForm.tieRows3.draw1} onChange={(rows) => setCreateForm({ ...createForm, tieRows3: { ...createForm.tieRows3, draw1: rows } })} />
                  </div>
                  <div>
                    <PasteImport label="With Ties — 2 Draws" existingRecords={createForm.tieRows3.draw2.map(r => r.record)} onImport={(rows) => setCreateForm({ ...createForm, tieRows3: { ...createForm.tieRows3, draw2: rows } })} />
                    <PrizeTable label="With Ties — 2 Draws" rows={createForm.tieRows3.draw2} onChange={(rows) => setCreateForm({ ...createForm, tieRows3: { ...createForm.tieRows3, draw2: rows } })} />
                  </div>
                  <div>
                    <PasteImport label="High-Draw (3 Draws)" existingRecords={createForm.tieRows3.highDraw.map(r => r.record)} onImport={(rows) => setCreateForm({ ...createForm, tieRows3: { ...createForm.tieRows3, highDraw: rows } })} />
                    <PrizeTable label="High-Draw (3 Draws)" rows={createForm.tieRows3.highDraw} onChange={(rows) => setCreateForm({ ...createForm, tieRows3: { ...createForm.tieRows3, highDraw: rows } })} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <PasteImport label="Without Ties" existingRecords={createForm.noTiesRows.map(r => r.record)} onImport={(rows) => setCreateForm({ ...createForm, noTiesRows: rows })} />
                  <PrizeTable label="Without Ties" rows={createForm.noTiesRows} onChange={(rows) => setCreateForm({ ...createForm, noTiesRows: rows })} />
                </div>
                <div>
                  <PasteImport label="With Ties" existingRecords={createForm.tiesRows.map(r => r.record)} onImport={(rows) => setCreateForm({ ...createForm, tiesRows: rows })} />
                  <PrizeTable label="With Ties" rows={createForm.tiesRows} onChange={(rows) => setCreateForm({ ...createForm, tiesRows: rows })} />
                </div>
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
            .sort(([a], [b]) => groupOrder(a) - groupOrder(b))
            .map(([key, tmpls]) => (
              <div key={key}>
                <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
                    {groupLabel(key)}
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

                          {editForm.is_placement ? (
                            <div className="max-w-sm">
                              <PasteImport label="Placement" existingRecords={(editForm.noTiesRows || []).map((r: any) => r.record)} onImport={(rows) => setEditForm({ ...editForm, noTiesRows: rows })} />
                              <PrizeTable label="Placement Prizes (1st – 4th)" rows={editForm.noTiesRows} onChange={(rows) => setEditForm({ ...editForm, noTiesRows: rows })} />
                            </div>
                          ) : IS_3_ROUND_SPLIT(editForm.rounds) ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div>
                                <PasteImport label="Without Ties" existingRecords={(editForm.noTiesRows || []).map((r: any) => r.record)} onImport={(rows) => setEditForm({ ...editForm, noTiesRows: rows })} />
                                <PrizeTable label="Without Ties" rows={editForm.noTiesRows} onChange={(rows) => setEditForm({ ...editForm, noTiesRows: rows })} />
                              </div>
                              <div className="space-y-6">
                                <div>
                                  <PasteImport label="With Ties — 1 Draw" existingRecords={(editForm.tieRows3?.draw1 || []).map((r: any) => r.record)} onImport={(rows) => setEditForm({ ...editForm, tieRows3: { ...editForm.tieRows3, draw1: rows } })} />
                                  <PrizeTable label="With Ties — 1 Draw" rows={editForm.tieRows3?.draw1 || []} onChange={(rows) => setEditForm({ ...editForm, tieRows3: { ...editForm.tieRows3, draw1: rows } })} />
                                </div>
                                <div>
                                  <PasteImport label="With Ties — 2 Draws" existingRecords={(editForm.tieRows3?.draw2 || []).map((r: any) => r.record)} onImport={(rows) => setEditForm({ ...editForm, tieRows3: { ...editForm.tieRows3, draw2: rows } })} />
                                  <PrizeTable label="With Ties — 2 Draws" rows={editForm.tieRows3?.draw2 || []} onChange={(rows) => setEditForm({ ...editForm, tieRows3: { ...editForm.tieRows3, draw2: rows } })} />
                                </div>
                                <div>
                                  <PasteImport label="High-Draw (3 Draws)" existingRecords={(editForm.tieRows3?.highDraw || []).map((r: any) => r.record)} onImport={(rows) => setEditForm({ ...editForm, tieRows3: { ...editForm.tieRows3, highDraw: rows } })} />
                                  <PrizeTable label="High-Draw (3 Draws)" rows={editForm.tieRows3?.highDraw || []} onChange={(rows) => setEditForm({ ...editForm, tieRows3: { ...editForm.tieRows3, highDraw: rows } })} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div>
                                <PasteImport label="Without Ties" existingRecords={(editForm.noTiesRows || []).map((r: any) => r.record)} onImport={(rows) => setEditForm({ ...editForm, noTiesRows: rows })} />
                                <PrizeTable label="Without Ties" rows={editForm.noTiesRows} onChange={(rows) => setEditForm({ ...editForm, noTiesRows: rows })} />
                              </div>
                              <div>
                                <PasteImport label="With Ties" existingRecords={(editForm.tiesRows || []).map((r: any) => r.record)} onImport={(rows) => setEditForm({ ...editForm, tiesRows: rows })} />
                                <PrizeTable label="With Ties" rows={editForm.tiesRows} onChange={(rows) => setEditForm({ ...editForm, tiesRows: rows })} />
                              </div>
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
                          {t.is_placement ? (
                            <div className="max-w-sm">
                              <PrizeTable label="Placement Prizes (1st – 4th)" rows={rowsFromStructure(t.prize_structure || {}, generatePlacement(4))} onChange={() => {}} readOnly />
                            </div>
                          ) : IS_3_ROUND_SPLIT(t.rounds) ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <PrizeTable label="Without Ties" rows={rowsFromStructure(t.prize_structure || {}, generateRecordsNoTies(t.rounds))} onChange={() => {}} readOnly />
                              <div className="space-y-4">
                                <PrizeTable label="With Ties — 1 Draw" rows={rowsFromStructure(t.prize_structure_ties || {}, generateRecords3RoundByDraws(1))} onChange={() => {}} readOnly />
                                <PrizeTable label="With Ties — 2 Draws" rows={rowsFromStructure(t.prize_structure_ties || {}, generateRecords3RoundByDraws(2))} onChange={() => {}} readOnly />
                                <PrizeTable label="High-Draw (3 Draws)" rows={rowsFromStructure(t.prize_structure_ties || {}, generateRecords3RoundByDraws(3))} onChange={() => {}} readOnly />
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <PrizeTable label="Without Ties" rows={rowsFromStructure(t.prize_structure || {}, generateRecordsNoTies(t.rounds))} onChange={() => {}} readOnly />
                              <PrizeTable label="With Ties" rows={rowsFromStructure(t.prize_structure_ties || {}, generateRecordsWithTies(t.rounds))} onChange={() => {}} readOnly />
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
