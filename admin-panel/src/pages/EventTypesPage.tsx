import { useState, useEffect, Fragment } from 'react';
import { Plus, Pencil, Save, Trash2, Copy, Table, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { eventTypes, prizeTemplates, specialVouchers as specialVouchersApi } from '../api';

const CATEGORIES = ['Draft', 'Sealed', 'Constructed', 'Commander', 'On Demand'];
const FORMATS = ['Standard', 'Modern', 'Pioneer', 'PreModern', 'Pauper', 'Special Event'];
const TOURNAMENT_STRUCTURES = [
  { value: 'swiss', label: 'Swiss' },
  { value: 'single_elimination', label: 'Single Elimination' },
];

const STRUCTURE_ALIASES: Record<string, string> = {
  swiss: 'swiss',
  'single elimination': 'single_elimination',
  single_elimination: 'single_elimination',
  singleelim: 'single_elimination',
  elim: 'single_elimination',
  elimination: 'single_elimination',
};
const TEAM_MODE_ALIASES: Record<string, string> = {
  single: 'single',
  'single player': 'single',
  singleplayer: 'single',
  '1v1': 'single',
  individual: 'single',
  '2hg': '2hg',
  '2-hg': '2hg',
  'two-headed giant': '2hg',
  'two headed giant': '2hg',
  twoheadedgiant: '2hg',
  team: '2hg',
  pairs: '2hg',
  pair: '2hg',
};

interface BulkTypeRow {
  key: number;
  name: string;
  category: string;
  entryCost: number | null;
  structure: string;
  teamMode: string;
  rawCategory: string;
  rawStructure: string;
  rawTeamMode: string;
  parseError: string;
  format: string;
  max_players: string;
  tix_per_player: string;
  templateId: number | null;
  createStatus: 'pending' | 'creating' | 'success' | 'error';
  createError: string;
}

let bulkTypeRowKeySeq = 1;

function normalizeCategoryValue(raw: string): string {
  const found = CATEGORIES.find((c) => c.toLowerCase() === raw.trim().toLowerCase());
  return found || '';
}
function normalizeStructureValue(raw: string): string {
  return STRUCTURE_ALIASES[raw.trim().toLowerCase()] || '';
}
function normalizeTeamModeValue(raw: string): string {
  return TEAM_MODE_ALIASES[raw.trim().toLowerCase()] || '';
}

function defaultMaxPlayersFor(cat: string): string {
  return cat === 'Commander' ? '4' : cat === 'Constructed' ? '16' : '8';
}

function parseBulkTypePaste(text: string): BulkTypeRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  let rows = lines.map((l) => l.split('\t').map((c) => c.trim()));
  if (rows.every((r) => r.length === 1)) {
    rows = lines.map((l) => l.split(',').map((c) => c.trim()));
  }

  const first = rows[0];
  if (
    first.length >= 5 &&
    /name/i.test(first[0]) &&
    /categor/i.test(first[1]) &&
    /cost/i.test(first[2])
  ) {
    rows = rows.slice(1);
  }

  return rows
    .filter((r) => r.some((c) => c.length > 0))
    .map((cols) => {
      const [nameRaw = '', categoryRaw = '', entryCostRaw = '', structureRaw = '', teamModeRaw = ''] = cols;
      const category = normalizeCategoryValue(categoryRaw);
      const structure = normalizeStructureValue(structureRaw);
      const teamMode = normalizeTeamModeValue(teamModeRaw);
      const entryCost = entryCostRaw.trim() === '' ? null : parseFloat(entryCostRaw.trim());

      const errors: string[] = [];
      if (!nameRaw.trim()) errors.push('Missing name');
      if (!category) errors.push(`Unknown category "${categoryRaw}"`);
      if (entryCost === null || Number.isNaN(entryCost)) errors.push(`Invalid entry cost "${entryCostRaw}"`);
      if (!structure) errors.push(`Unknown structure "${structureRaw}"`);
      if (!teamMode) errors.push(`Unknown team mode "${teamModeRaw}"`);

      return {
        key: bulkTypeRowKeySeq++,
        name: nameRaw.trim(),
        category,
        entryCost,
        structure,
        teamMode,
        rawCategory: categoryRaw,
        rawStructure: structureRaw,
        rawTeamMode: teamModeRaw,
        parseError: errors.join('; '),
        format: category === 'Constructed' ? 'Standard' : '',
        max_players: category ? defaultMaxPlayersFor(category) : '8',
        tix_per_player: '',
        templateId: null,
        createStatus: 'pending' as const,
        createError: '',
      };
    });
}

const CATEGORY_COLORS: Record<string, string> = {
  Draft: 'bg-blue-100 text-blue-700',
  Sealed: 'bg-purple-100 text-purple-700',
  Constructed: 'bg-amber-100 text-amber-700',
  Commander: 'bg-green-100 text-green-700',
};

type PrizeRow = { record: string; amount: string; specialVoucherId?: string };

function genNoTies(rounds: number): PrizeRow[] {
  const rows: PrizeRow[] = [];
  for (let w = rounds; w >= 0; w--) rows.push({ record: `${w}-${rounds - w}-0`, amount: '0', specialVoucherId: '' });
  return rows;
}
function genWithTies(rounds: number): PrizeRow[] {
  const rows: PrizeRow[] = [];
  for (let w = rounds; w >= 0; w--)
    for (let l = rounds - w; l >= 0; l--) rows.push({ record: `${w}-${l}-${rounds - w - l}`, amount: '0', specialVoucherId: '' });
  return rows;
}
function genByDraws(draws: number): PrizeRow[] {
  const rows: PrizeRow[] = [];
  const rounds = 3;
  for (let w = rounds; w >= 0; w--)
    for (let l = rounds - w; l >= 0; l--) {
      const t = rounds - w - l;
      if (t === draws) rows.push({ record: `${w}-${l}-${t}`, amount: '0', specialVoucherId: '' });
    }
  return rows;
}
const IS_3_ROUND = (cat: string) => cat !== 'Commander' && roundsForCategory(cat) === 3;
type TieRows3 = { draw1: PrizeRow[]; draw2: PrizeRow[]; highDraw: PrizeRow[] };
function defaultTieRows3(): TieRows3 { return { draw1: genByDraws(1), draw2: genByDraws(2), highDraw: genByDraws(3) }; }
function tieRows3FromStruct(s: Record<string, any>): TieRows3 {
  return {
    draw1: structToRows(s, genByDraws(1)),
    draw2: structToRows(s, genByDraws(2)),
    highDraw: structToRows(s, genByDraws(3)),
  };
}
function tieRows3ToStruct(tr: TieRows3): Record<string, any> {
  const out: Record<string, any> = {};
  for (const r of [...tr.draw1, ...tr.draw2, ...tr.highDraw]) out[r.record] = rowToPrizeEntry(r);
  return out;
}
function genPlacement(count: number): PrizeRow[] {
  const suffixes = ['st', 'nd', 'rd', 'th'];
  return Array.from({ length: count }, (_, i) => ({
    record: `${i + 1}${i < 3 ? suffixes[i] : 'th'}`,
    amount: '0',
    specialVoucherId: '',
  }));
}
/** A stored prize_structure value is either a plain Tix number (legacy) or
 *  { tix, special_voucher_id } once a Special Voucher is attached to that tier. */
function structToRows(struct: Record<string, any>, defaults: PrizeRow[]): PrizeRow[] {
  const map = new Map<string, PrizeRow>();
  for (const d of defaults) map.set(d.record, { record: d.record, amount: '0', specialVoucherId: '' });
  for (const [k, v] of Object.entries(struct)) {
    if (v !== null && typeof v === 'object') {
      map.set(k, { record: k, amount: String((v as any).tix ?? 0), specialVoucherId: (v as any).special_voucher_id ? String((v as any).special_voucher_id) : '' });
    } else {
      map.set(k, { record: k, amount: String(v), specialVoucherId: '' });
    }
  }
  return Array.from(map.values());
}
function rowToPrizeEntry(r: PrizeRow): any {
  const tix = parseInt(r.amount) || 0;
  if (r.specialVoucherId) return { tix, special_voucher_id: parseInt(r.specialVoucherId) };
  return tix;
}
function rowsToStruct(rows: PrizeRow[]): Record<string, any> {
  const s: Record<string, any> = {};
  for (const r of rows) s[r.record] = rowToPrizeEntry(r);
  return s;
}
function roundsForCategory(cat: string) {
  return cat === 'Commander' ? 1 : cat === 'Constructed' ? 4 : 3;
}
function isCommander(cat: string) { return cat === 'Commander'; }
function usesPlacement(cat: string, structure: string) { return cat === 'Commander' || structure === 'single_elimination'; }

interface PrizeTableProps {
  label: string;
  rows: PrizeRow[];
  onChange: (rows: PrizeRow[]) => void;
  readOnly?: boolean;
  compact?: boolean;
  specialVouchers?: { id: number; name: string }[];
}
function PrizeTable({ label, rows, onChange, readOnly, compact, specialVouchers }: PrizeTableProps) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1">{label}</h4>
      <table className={`w-full text-sm border border-gray-200 rounded-lg overflow-hidden ${compact ? '' : ''}`}>
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">W-L-T</th>
            <th className="text-left px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">Tix</th>
            {specialVouchers && <th className="text-left px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">Special Voucher</th>}
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
              {specialVouchers && (
                <td className="px-3 py-1">
                  {readOnly ? (
                    <span className="text-xs text-gray-800">
                      {row.specialVoucherId ? (specialVouchers.find(v => String(v.id) === row.specialVoucherId)?.name ?? `#${row.specialVoucherId}`) : '—'}
                    </span>
                  ) : (
                    <select value={row.specialVoucherId || ''}
                      onChange={(e) => { const u = [...rows]; u[i] = { ...u[i], specialVoucherId: e.target.value }; onChange(u); }}
                      className="px-2 py-0.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="">— None —</option>
                      {specialVouchers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  )}
                </td>
              )}
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
  const [specialVouchersList, setSpecialVouchersList] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [form, setForm] = useState({
    name: '', category: 'Draft', format: '' as string,
    tournament_structure: 'swiss',
    team_mode: 'single',
    entry_cost_vouchers: '', max_players: '8',
    tix_per_player: '',
    noTiesRows: genNoTies(3), tiesRows: genWithTies(3),
    tieRows3: defaultTieRows3(),
  });
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [bulkRows, setBulkRows] = useState<BulkTypeRow[]>([]);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const conventionId = parseInt(localStorage.getItem('cm_convention_id') || '');
      const [tRes, pRes, svRes] = await Promise.all([
        eventTypes.list(),
        prizeTemplates.list(),
        conventionId ? specialVouchersApi.list(conventionId) : Promise.resolve({ special_vouchers: [] }),
      ]);
      setTypes(tRes.event_types || []);
      setTemplates(pRes.templates || []);
      setSpecialVouchersList(svRes.special_vouchers || []);
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
      setForm({ ...form, category: cat, format: cat === 'Constructed' ? 'Standard' : '', max_players: maxP, noTiesRows: noTies, tiesRows: ties, tieRows3: defaultTieRows3() });
    } else {
      setEditForm({ ...editForm, category: cat, format: cat === 'Constructed' ? 'Standard' : '', max_players: maxP, noTiesRows: noTies, tiesRows: ties, tieRows3: defaultTieRows3() });
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
    const tieRows3 = IS_3_ROUND(cat) ? tieRows3FromStruct(tmpl.prize_structure_ties || {}) : defaultTieRows3();
    if (target === 'form') {
      setForm({ ...form, noTiesRows: noTies, tiesRows: ties, tieRows3 });
    } else {
      setEditForm({ ...editForm, noTiesRows: noTies, tiesRows: ties, tieRows3 });
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const is3Round = IS_3_ROUND(form.category) && !usesPlacement(form.category, form.tournament_structure);
      await eventTypes.create({
        name: form.name, category: form.category,
        format: form.category === 'Constructed' ? form.format : null,
        tournament_structure: form.tournament_structure,
        team_mode: form.team_mode,
        entry_cost_vouchers: parseFloat(form.entry_cost_vouchers),
        max_players: parseInt(form.max_players),
        tix_per_player: form.tix_per_player ? parseInt(form.tix_per_player) : null,
        prize_structure: rowsToStruct(form.noTiesRows),
        prize_structure_ties: is3Round ? tieRows3ToStruct(form.tieRows3) : rowsToStruct(form.tiesRows),
      });
      setForm({ name: '', category: 'Draft', format: '', tournament_structure: 'swiss', team_mode: 'single', entry_cost_vouchers: '', max_players: '8', tix_per_player: '', noTiesRows: genNoTies(3), tiesRows: genWithTies(3), tieRows3: defaultTieRows3() });
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
      team_mode: t.team_mode || 'single',
      entry_cost_vouchers: String(t.entry_cost_vouchers), max_players: String(t.max_players),
      tix_per_player: t.tix_per_player != null ? String(t.tix_per_player) : '',
      noTiesRows: structToRows(t.prize_structure || {}, defaults),
      tiesRows: placement ? [] : structToRows(t.prize_structure_ties || {}, genWithTies(r)),
      tieRows3: IS_3_ROUND(cat) ? tieRows3FromStruct(t.prize_structure_ties || {}) : defaultTieRows3(),
    });
  }

  async function handleSaveEdit() {
    try {
      const is3Round = IS_3_ROUND(editForm.category) && !usesPlacement(editForm.category, editForm.tournament_structure);
      await eventTypes.update(editingId!, {
        name: editForm.name, category: editForm.category,
        format: editForm.category === 'Constructed' ? editForm.format : null,
        tournament_structure: editForm.tournament_structure,
        team_mode: editForm.team_mode,
        entry_cost_vouchers: parseFloat(editForm.entry_cost_vouchers),
        max_players: parseInt(editForm.max_players),
        tix_per_player: editForm.tix_per_player ? parseInt(editForm.tix_per_player) : null,
        prize_structure: rowsToStruct(editForm.noTiesRows),
        prize_structure_ties: is3Round ? tieRows3ToStruct(editForm.tieRows3) : rowsToStruct(editForm.tiesRows),
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

  function matchingTemplatesFor(cat: string, structure: string) {
    if (!cat || !structure) return [];
    const placement = usesPlacement(cat, structure);
    return placement
      ? templates.filter((t: any) => t.is_placement)
      : templates.filter((t: any) => !t.is_placement && t.rounds >= 1);
  }

  function handleParseBulkPaste() {
    const parsed = parseBulkTypePaste(bulkPasteText);
    setBulkRows(parsed);
    setBulkDone(false);
  }

  function updateBulkRow(key: number, patch: Partial<BulkTypeRow>) {
    setBulkRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeBulkRow(key: number) {
    setBulkRows((prev) => prev.filter((r) => r.key !== key));
  }

  function closeBulkCreate() {
    setShowBulkCreate(false);
    setBulkPasteText('');
    setBulkRows([]);
    setBulkDone(false);
  }

  async function handleBulkCreate() {
    setBulkCreating(true);
    for (const row of bulkRows) {
      if (row.parseError) continue;
      updateBulkRow(row.key, { createStatus: 'creating' });
      try {
        const placement = usesPlacement(row.category, row.structure);
        const maxPlayers = parseInt(row.max_players) || parseInt(defaultMaxPlayersFor(row.category));
        const rounds = roundsForCategory(row.category);
        const placementCount = row.category === 'Commander' ? 4 : maxPlayers;
        const tmpl = row.templateId ? templates.find((t: any) => t.id === row.templateId) : null;

        let noTiesRows, tiesRows, tieRows3;
        if (tmpl) {
          const defaults = placement ? genPlacement(placementCount) : genNoTies(tmpl.rounds);
          noTiesRows = structToRows(tmpl.prize_structure || {}, defaults);
          tiesRows = placement ? [] : structToRows(tmpl.prize_structure_ties || {}, genWithTies(tmpl.rounds));
          tieRows3 = IS_3_ROUND(row.category) ? tieRows3FromStruct(tmpl.prize_structure_ties || {}) : defaultTieRows3();
        } else {
          noTiesRows = placement ? genPlacement(placementCount) : genNoTies(rounds);
          tiesRows = placement ? [] : genWithTies(rounds);
          tieRows3 = defaultTieRows3();
        }
        const is3Round = IS_3_ROUND(row.category) && !placement;

        await eventTypes.create({
          name: row.name,
          category: row.category,
          format: row.category === 'Constructed' ? (row.format || 'Standard') : null,
          tournament_structure: row.structure,
          team_mode: row.teamMode,
          entry_cost_vouchers: row.entryCost!,
          max_players: maxPlayers,
          tix_per_player: row.tix_per_player ? parseInt(row.tix_per_player) : null,
          prize_structure: rowsToStruct(noTiesRows),
          prize_structure_ties: is3Round ? tieRows3ToStruct(tieRows3) : rowsToStruct(tiesRows),
        });
        updateBulkRow(row.key, { createStatus: 'success' });
      } catch (err: any) {
        updateBulkRow(row.key, { createStatus: 'error', createError: err.message });
      }
    }
    setBulkCreating(false);
    setBulkDone(true);
    load();
  }

  function renderTemplateSelector(target: 'form' | 'edit') {
    const cat = target === 'form' ? form.category : editForm.category;
    const struct = target === 'form' ? form.tournament_structure : editForm.tournament_structure;
    const placement = usesPlacement(cat, struct);
    const matching = placement
      ? templates.filter((t: any) => t.is_placement)
      : templates.filter((t: any) => !t.is_placement && t.rounds >= 1);
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
              <optgroup key={rounds} label={placement ? 'Placement' : rounds === '1' ? '1 Round (W-L only)' : `${rounds} rounds`}>
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
            <label className="text-xs font-medium text-gray-500 mb-1 block">Entry Cost (CRC colones) *</label>
            <input type="number" min="0" step="1" value={f.entry_cost_vouchers} onChange={(e) => setF({ ...f, entry_cost_vouchers: e.target.value })}
              required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Max Players</label>
            <input type="number" min="2" value={f.max_players} onChange={(e) => setF({ ...f, max_players: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Tix Per Player</label>
            <input type="number" min="0" value={f.tix_per_player ?? ''} onChange={(e) => setF({ ...f, tix_per_player: e.target.value })}
              placeholder="e.g. 30" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
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
              setF({ ...f, tournament_structure: newStruct, noTiesRows: noTies, tiesRows: ties, tieRows3: defaultTieRows3() });
            }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
              {TOURNAMENT_STRUCTURES.map(ts => <option key={ts.value} value={ts.value}>{ts.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Team Mode *</label>
            <select value={f.team_mode} onChange={(e) => setF({ ...f, team_mode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
              <option value="single">Single Player</option>
              <option value="2hg">2-Headed Giant (Pairs)</option>
            </select>
          </div>
        </div>
        {f.team_mode === '2hg' && (
          <p className="mt-1 text-xs text-emerald-700">
            Players register individually, then get linked into 2-player teams from the event's Registration tab before starting.
          </p>
        )}
        {f.tix_per_player && parseInt(f.tix_per_player) > 0 && f.max_players && (
          <div className="mt-1 text-xs text-indigo-700 font-medium">
            Max Tix Payout: {parseInt(f.max_players) * parseInt(f.tix_per_player)} tix ({f.max_players} players × {f.tix_per_player} tix)
          </div>
        )}

        <div className="mt-4 mb-2">{renderTemplateSelector(target)}</div>

        {usesPlacement(f.category, f.tournament_structure) ? (
          <div className="max-w-xl">
            <PrizeTable label={`Placement Prizes (1st – ${isCommander(f.category) ? '4th' : f.max_players + 'th'})`} rows={f.noTiesRows}
              onChange={(rows) => setF({ ...f, noTiesRows: rows })} specialVouchers={specialVouchersList} />
          </div>
        ) : IS_3_ROUND(f.category) ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PrizeTable label="Without Ties" rows={f.noTiesRows} onChange={(rows) => setF({ ...f, noTiesRows: rows })} specialVouchers={specialVouchersList} />
            <div className="space-y-4">
              <PrizeTable label="With Ties — 1 Draw" rows={f.tieRows3?.draw1 ?? genByDraws(1)} onChange={(rows) => setF({ ...f, tieRows3: { ...f.tieRows3, draw1: rows } })} specialVouchers={specialVouchersList} />
              <PrizeTable label="With Ties — 2 Draws" rows={f.tieRows3?.draw2 ?? genByDraws(2)} onChange={(rows) => setF({ ...f, tieRows3: { ...f.tieRows3, draw2: rows } })} specialVouchers={specialVouchersList} />
              <PrizeTable label="High-Draw (3 Draws)" rows={f.tieRows3?.highDraw ?? genByDraws(3)} onChange={(rows) => setF({ ...f, tieRows3: { ...f.tieRows3, highDraw: rows } })} specialVouchers={specialVouchersList} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PrizeTable label="Without Ties" rows={f.noTiesRows}
              onChange={(rows) => setF({ ...f, noTiesRows: rows })} specialVouchers={specialVouchersList} />
            <PrizeTable label="With Ties" rows={f.tiesRows}
              onChange={(rows) => setF({ ...f, tiesRows: rows })} specialVouchers={specialVouchersList} />
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Event Types</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowBulkCreate(!showBulkCreate); setShowCreate(false); }}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
            <Table size={16} /> Bulk Create
          </button>
          <button onClick={() => { setShowCreate(!showCreate); setShowBulkCreate(false); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
            <Plus size={16} /> Create Type
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {showBulkCreate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Bulk Create Event Types</h2>
            <button onClick={closeBulkCreate} className="text-gray-400 hover:text-gray-600">&times;</button>
          </div>

          {bulkRows.length === 0 ? (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Paste rows from Excel with columns: <span className="font-mono font-medium text-gray-700">Name, Category, Entry Cost, Structure, Team Mode</span>.
                Category: {CATEGORIES.join(', ')}. Structure: Swiss or Single Elimination. Team Mode: Single Player or 2HG.
              </p>
              <textarea
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                placeholder={'Friday Draft\tDraft\t3\tSwiss\tSingle Player\nSaturday 2HG Sealed\tSealed\t5\tSwiss\t2HG'}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm mb-4"
              />
              <div className="flex gap-3">
                <button onClick={closeBulkCreate}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">
                  Cancel
                </button>
                <button onClick={handleParseBulkPaste} disabled={!bulkPasteText.trim()}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                  Parse Rows
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="overflow-x-auto -mx-6 mb-4">
                <table className="w-full text-sm min-w-[1200px]">
                  <thead className="bg-gray-50 border-y border-gray-200">
                    <tr>
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Category</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Cost</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Structure</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Team Mode</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Format</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Max Players</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Tix/Player</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Populate from Template</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bulkRows.map((row) => {
                      const candidateTemplates = matchingTemplatesFor(row.category, row.structure);
                      return (
                        <Fragment key={row.key}>
                        <tr className={row.parseError ? 'bg-red-50' : ''}>
                          <td className="px-3 py-2 align-top">
                            {row.createStatus === 'creating' && <Loader2 size={16} className="animate-spin text-indigo-500" />}
                            {row.createStatus === 'success' && <CheckCircle2 size={16} className="text-green-500" />}
                            {row.createStatus === 'error' && (
                              <span title={row.createError}><AlertCircle size={16} className="text-red-500" /></span>
                            )}
                            {row.createStatus === 'pending' && row.parseError && (
                              <span title={row.parseError}><AlertCircle size={16} className="text-red-500" /></span>
                            )}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input value={row.name} onChange={(e) => updateBulkRow(row.key, { name: e.target.value })}
                              className="w-40 px-2 py-1 border border-gray-200 rounded text-sm" />
                          </td>
                          <td className="px-3 py-2 align-top whitespace-nowrap">
                            {row.category || <span className="text-red-500 text-xs">{row.rawCategory || '—'}</span>}
                          </td>
                          <td className="px-3 py-2 align-top">{row.entryCost ?? <span className="text-red-500 text-xs">—</span>}</td>
                          <td className="px-3 py-2 align-top whitespace-nowrap">
                            {row.structure === 'single_elimination' ? 'Single Elim' : row.structure === 'swiss' ? 'Swiss' : <span className="text-red-500 text-xs">{row.rawStructure || '—'}</span>}
                          </td>
                          <td className="px-3 py-2 align-top whitespace-nowrap">
                            {row.teamMode === '2hg' ? '2HG' : row.teamMode === 'single' ? 'Single' : <span className="text-red-500 text-xs">{row.rawTeamMode || '—'}</span>}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {row.category === 'Constructed' ? (
                              <select value={row.format} onChange={(e) => updateBulkRow(row.key, { format: e.target.value })}
                                className="w-28 px-2 py-1 border border-gray-200 rounded text-sm">
                                {FORMATS.map((fm) => <option key={fm} value={fm}>{fm}</option>)}
                              </select>
                            ) : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input type="number" min="2" value={row.max_players}
                              onChange={(e) => updateBulkRow(row.key, { max_players: e.target.value })}
                              className="w-16 px-2 py-1 border border-gray-200 rounded text-sm" />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input type="number" min="0" value={row.tix_per_player}
                              onChange={(e) => updateBulkRow(row.key, { tix_per_player: e.target.value })}
                              placeholder="—"
                              className="w-16 px-2 py-1 border border-gray-200 rounded text-sm" />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <select
                              value={row.templateId ?? ''}
                              onChange={(e) => updateBulkRow(row.key, { templateId: e.target.value ? parseInt(e.target.value) : null })}
                              className="w-48 px-2 py-1 border border-gray-200 rounded text-sm"
                              disabled={!row.category || !row.structure}
                            >
                              <option value="">Default (zero prizes)</option>
                              {candidateTemplates.map((t: any) => (
                                <option key={t.id} value={t.id}>{t.name} ({t.rounds}r)</option>
                              ))}
                            </select>
                            {row.category && row.structure && candidateTemplates.length === 0 && (
                              <div className="text-xs text-gray-400 mt-0.5">No matching templates</div>
                            )}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <button onClick={() => removeBulkRow(row.key)} className="text-gray-400 hover:text-red-500">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                        {row.parseError && (
                          <tr className="bg-red-50">
                            <td></td>
                            <td colSpan={10} className="px-3 pb-2 -mt-1 text-xs text-red-600">{row.parseError}</td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                Prize amounts can be fine-tuned per event type after creation using Edit. Rows without a template are created with zero-value prize structures.
              </p>

              {bulkDone && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg mb-4 text-sm">
                  Done. {bulkRows.filter((r) => r.createStatus === 'success').length} of {bulkRows.filter((r) => !r.parseError).length} event types created successfully.
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setBulkRows([])}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">
                  Back to Paste
                </button>
                <button onClick={handleBulkCreate} disabled={bulkCreating || bulkRows.every((r) => r.parseError)}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {bulkCreating && <Loader2 size={16} className="animate-spin" />}
                  Create {bulkRows.filter((r) => !r.parseError).length} Event Types
                </button>
              </div>
              {bulkRows.some((r) => r.parseError) && (
                <p className="text-xs text-red-600 mt-2">Rows with errors will be skipped. Fix or remove them, then re-parse if needed.</p>
              )}
            </>
          )}
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
                        {t.team_mode === '2hg' && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                            2-Headed Giant
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-800">{t.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Entry: {Number(t.entry_cost_vouchers)} vouchers &middot; Max {t.max_players} players
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
                  {t.tix_per_player && (
                    <div className="mb-2 text-xs text-indigo-700 font-medium">
                      Tix Per Player: {t.tix_per_player} &middot; Max Tix Payout: {t.max_players * t.tix_per_player} tix
                    </div>
                  )}
                  {isCommander(t.category) ? (
                    <div className="max-w-xl">
                      <PrizeTable label="Placement Prizes (1st – 4th)" readOnly compact
                        rows={structToRows(t.prize_structure || {}, genPlacement(4))}
                        onChange={() => {}} specialVouchers={specialVouchersList} />
                    </div>
                  ) : IS_3_ROUND(t.category) ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <PrizeTable label="Without Ties" readOnly compact rows={structToRows(t.prize_structure || {}, genNoTies(3))} onChange={() => {}} specialVouchers={specialVouchersList} />
                      {Object.keys(t.prize_structure_ties || {}).length > 0 && (
                        <div className="space-y-3">
                          <PrizeTable label="With Ties — 1 Draw" readOnly compact rows={structToRows(t.prize_structure_ties || {}, genByDraws(1))} onChange={() => {}} specialVouchers={specialVouchersList} />
                          <PrizeTable label="With Ties — 2 Draws" readOnly compact rows={structToRows(t.prize_structure_ties || {}, genByDraws(2))} onChange={() => {}} specialVouchers={specialVouchersList} />
                          <PrizeTable label="High-Draw (3 Draws)" readOnly compact rows={structToRows(t.prize_structure_ties || {}, genByDraws(3))} onChange={() => {}} specialVouchers={specialVouchersList} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <PrizeTable label="Without Ties" readOnly compact
                        rows={structToRows(t.prize_structure || {}, genNoTies(roundsForCategory(t.category || 'Draft')))}
                        onChange={() => {}} specialVouchers={specialVouchersList} />
                      {Object.keys(t.prize_structure_ties || {}).length > 0 && (
                        <PrizeTable label="With Ties" readOnly compact
                          rows={structToRows(t.prize_structure_ties || {}, genWithTies(roundsForCategory(t.category || 'Draft')))}
                          onChange={() => {}} specialVouchers={specialVouchersList} />
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
