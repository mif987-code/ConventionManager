import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Save, X, Package, Image, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { collectibles, eventTypes } from '../api';

const UNLOCK_TYPES = [
  { value: 'event_type_single', label: 'Play a Specific Event (once)' },
  { value: 'event_type', label: 'Play X of a Specific Event Type' },
  { value: 'category', label: 'Play X of a Category' },
  { value: 'manual', label: 'Manual Award Only' },
];

const CATEGORIES = ['Draft', 'Sealed', 'Constructed', 'Commander'];

const BLANK_COLLECTIBLE = {
  name: '', description: '', image_url: '', image_file: null as File | null,
  unlock_type: 'event_type_single', unlock_value: '', unlock_threshold: 1, bonus_tix: 0,
};

const BLANK_SET = { name: '', description: '', bonus_tix: 0, collectible_ids: [] as number[] };

type Tab = 'collectibles' | 'sets';

export default function CollectionPage() {
  const [tab, setTab] = useState<Tab>('collectibles');
  const [items, setItems] = useState<any[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ ...BLANK_COLLECTIBLE });
  const [createPreview, setCreatePreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editPreview, setEditPreview] = useState<string | null>(null);

  const [showCreateSet, setShowCreateSet] = useState(false);
  const [createSetForm, setCreateSetForm] = useState({ ...BLANK_SET });
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [editSetForm, setEditSetForm] = useState<any>({});
  const [expandedSets, setExpandedSets] = useState<Set<number>>(new Set());

  async function load() {
    try {
      setLoading(true);
      const [cRes, sRes, tRes] = await Promise.all([
        collectibles.list(),
        collectibles.listSets(),
        eventTypes.list(),
      ]);
      setItems(cRes.collectibles || []);
      setSets(sRes.sets || []);
      setTypes(tRes.event_types || []);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', createForm.name);
      formData.append('description', createForm.description);
      formData.append('unlock_type', createForm.unlock_type);
      formData.append('unlock_value', createForm.unlock_value);
      formData.append('unlock_threshold', String(parseInt(String(createForm.unlock_threshold)) || 1));
      formData.append('bonus_tix', String(parseInt(String(createForm.bonus_tix)) || 0));
      if (createForm.image_file) formData.append('image', createForm.image_file);

      await collectibles.createFormData(formData);
      setCreateForm({ ...BLANK_COLLECTIBLE });
      setCreatePreview(null);
      setShowCreate(false);
      load();
    } catch (err: any) { setError(err.message); }
  }

  async function handleSaveEdit() {
    try {
      const formData = new FormData();
      formData.append('name', editForm.name);
      formData.append('description', editForm.description || '');
      formData.append('unlock_type', editForm.unlock_type);
      formData.append('unlock_value', editForm.unlock_value || '');
      formData.append('unlock_threshold', String(parseInt(String(editForm.unlock_threshold)) || 1));
      formData.append('bonus_tix', String(parseInt(String(editForm.bonus_tix)) || 0));
      if (editForm.image_file) formData.append('image', editForm.image_file);

      await collectibles.updateFormData(editingId!, formData);
      setEditingId(null);
      setEditPreview(null);
      load();
    } catch (err: any) { setError(err.message); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this collectible? Players who earned it will keep it.')) return;
    try { await collectibles.delete(id); load(); } catch (err: any) { setError(err.message); }
  }

  async function handleCreateSet(e: React.FormEvent) {
    e.preventDefault();
    try {
      await collectibles.createSet({ ...createSetForm, bonus_tix: parseInt(String(createSetForm.bonus_tix)) || 0 });
      setCreateSetForm({ ...BLANK_SET });
      setShowCreateSet(false);
      load();
    } catch (err: any) { setError(err.message); }
  }

  async function handleSaveEditSet() {
    try {
      await collectibles.updateSet(editingSetId!, { ...editSetForm, bonus_tix: parseInt(String(editSetForm.bonus_tix)) || 0 });
      setEditingSetId(null);
      load();
    } catch (err: any) { setError(err.message); }
  }

  async function handleDeleteSet(id: number) {
    if (!confirm('Delete this collection set?')) return;
    try { await collectibles.deleteSet(id); load(); } catch (err: any) { setError(err.message); }
  }

  function toggleSetCollectible(form: any, setForm: (v: any) => void, cid: number) {
    const ids: number[] = form.collectible_ids || [];
    setForm({ ...form, collectible_ids: ids.includes(cid) ? ids.filter((x: number) => x !== cid) : [...ids, cid] });
  }

  function renderUnlockLabel(item: any) {
    if (item.unlock_type === 'manual') return 'Manual Award Only';
    if (item.unlock_type === 'event_type_single') {
      const t = types.find((x: any) => String(x.id) === String(item.unlock_value));
      return `Play ${t?.name || 'Specific Event'}`;
    }
    if (item.unlock_type === 'event_type') {
      const t = types.find((x: any) => String(x.id) === String(item.unlock_value));
      return `Play ${item.unlock_threshold}× ${t?.name || 'Specific Event'}`;
    }
    if (item.unlock_type === 'category') return `Play ${item.unlock_threshold}× ${item.unlock_value}`;
    return item.unlock_type;
  }

  function CollectibleForm({ form, setForm, onSubmit, onCancel, submitLabel, isEdit = false }: any) {
    const preview = isEdit ? editPreview : createPreview;
    const setPreview = isEdit ? setEditPreview : setCreatePreview;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setForm({ ...form, image_file: file });
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
      }
    };

    const handleRemoveImage = () => {
      setForm({ ...form, image_url: '', image_file: null });
      setPreview(null);
    };

    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Draft Champion" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Image</label>
            <div className="flex gap-2">
              <input type="file" accept="image/*" onChange={handleImageChange}
                className="flex-1 text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              {(preview || form.image_url) && (
                <button type="button" onClick={handleRemoveImage} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">
                  Remove
                </button>
              )}
            </div>
            {(preview || form.image_url) && (
              <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                <img src={preview || form.image_url} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2} placeholder="Short description shown to players..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Unlock Condition</label>
            <select value={form.unlock_type} onChange={(e) => setForm({ ...form, unlock_type: e.target.value, unlock_value: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
              {UNLOCK_TYPES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          {(form.unlock_type === 'event_type' || form.unlock_type === 'event_type_single' || form.unlock_type === 'category') && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Required Count</label>
              <input type="number" min="1" value={form.unlock_threshold}
                onChange={(e) => setForm({ ...form, unlock_threshold: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
            </div>
          )}
          {(form.unlock_type === 'event_type' || form.unlock_type === 'event_type_single') && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Event Type</label>
              <select value={form.unlock_value} onChange={(e) => setForm({ ...form, unlock_value: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                <option value="">— Select —</option>
                {types.map((t: any) => <option key={t.id} value={String(t.id)}>{t.name} ({t.category})</option>)}
              </select>
            </div>
          )}
          {form.unlock_type === 'category' && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
              <select value={form.unlock_value} onChange={(e) => setForm({ ...form, unlock_value: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                <option value="">— Select —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Bonus Tix on Earn</label>
            <input type="number" min="0" value={form.bonus_tix}
              onChange={(e) => setForm({ ...form, bonus_tix: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium">
            <Save size={14} /> {submitLabel}
          </button>
          <button type="button" onClick={onCancel} className="flex items-center gap-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">
            <X size={14} /> Cancel
          </button>
        </div>
      </form>
    );
  }

  function SetForm({ form, setForm, onSubmit, onCancel, submitLabel }: any) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Set Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Summer 2025 Collection" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Complete Set Bonus Tix</label>
            <input type="number" min="0" value={form.bonus_tix} onChange={(e) => setForm({ ...form, bonus_tix: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2} placeholder="Describe this set..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">Collectibles in this Set</label>
          {items.length === 0 ? (
            <p className="text-xs text-gray-400">No collectibles created yet. Create some first.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {items.map((c: any) => {
                const selected = (form.collectible_ids || []).includes(c.id);
                return (
                  <button key={c.id} type="button"
                    onClick={() => toggleSetCollectible(form, setForm, c.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition ${
                      selected ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'
                    }`}>
                    {c.image_url ? (
                      <img src={c.image_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <Star size={12} className="text-gray-400" />
                      </div>
                    )}
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium">
            <Save size={14} /> {submitLabel}
          </button>
          <button type="button" onClick={onCancel} className="flex items-center gap-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">
            <X size={14} /> Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Collection</h1>
        <button
          onClick={() => tab === 'collectibles' ? setShowCreate(!showCreate) : setShowCreateSet(!showCreateSet)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
          <Plus size={16} /> {tab === 'collectibles' ? 'New Collectible' : 'New Set'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="font-bold ml-2"><X size={14} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['collectibles', 'sets'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition capitalize ${
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'collectibles' ? `Collectibles (${items.length})` : `Sets (${sets.length})`}
          </button>
        ))}
      </div>

      {/* ===== COLLECTIBLES TAB ===== */}
      {tab === 'collectibles' && (
        <div className="space-y-4">
          {showCreate && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Create Collectible</h2>
              <CollectibleForm form={createForm} setForm={setCreateForm}
                onSubmit={handleCreate} onCancel={() => { setShowCreate(false); setCreatePreview(null); }} submitLabel="Create" />
            </div>
          )}

          {loading ? <div className="text-gray-400">Loading...</div> : (
            <>
              {items.map((item: any) => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  {editingId === item.id ? (
                    <>
                      <h3 className="font-semibold text-gray-700 mb-4">Edit: {item.name}</h3>
                      <CollectibleForm form={editForm} setForm={setEditForm}
                        onSubmit={(e: React.FormEvent) => { e.preventDefault(); handleSaveEdit(); }}
                        onCancel={() => { setEditingId(null); setEditPreview(null); }} submitLabel="Save" isEdit />
                    </>
                  ) : (
                    <div className="flex items-start gap-4">
                      {/* Image / Icon */}
                      <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Image size={24} className="text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-800">{item.name}</h3>
                          {item.bonus_tix > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                              +{item.bonus_tix} tix
                            </span>
                          )}
                        </div>
                        {item.description && <p className="text-sm text-gray-500 mb-1">{item.description}</p>}
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                            {renderUnlockLabel(item)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => { setEditingId(item.id); setEditForm({ ...item }); }}
                          className="text-gray-400 hover:text-indigo-600 transition" title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id)}
                          className="text-gray-400 hover:text-red-600 transition" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {items.length === 0 && !showCreate && (
                <div className="text-center text-gray-400 py-12">
                  <Star size={32} className="mx-auto mb-3 opacity-30" />
                  <p>No collectibles yet. Create one to get started.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===== SETS TAB ===== */}
      {tab === 'sets' && (
        <div className="space-y-4">
          {showCreateSet && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Create Collection Set</h2>
              <SetForm form={createSetForm} setForm={setCreateSetForm}
                onSubmit={handleCreateSet} onCancel={() => setShowCreateSet(false)} submitLabel="Create Set" />
            </div>
          )}

          {loading ? <div className="text-gray-400">Loading...</div> : (
            <>
              {sets.map((s: any) => {
                const expanded = expandedSets.has(s.id);
                const setCollectibles: any[] = Array.isArray(s.collectibles) ? s.collectibles : [];
                return (
                  <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                    {editingSetId === s.id ? (
                      <div className="p-5">
                        <h3 className="font-semibold text-gray-700 mb-4">Edit Set: {s.name}</h3>
                        <SetForm form={editSetForm} setForm={setEditSetForm}
                          onSubmit={(e: React.FormEvent) => { e.preventDefault(); handleSaveEditSet(); }}
                          onCancel={() => setEditingSetId(null)} submitLabel="Save" />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between p-5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Package size={16} className="text-indigo-500 flex-shrink-0" />
                              <h3 className="font-semibold text-gray-800">{s.name}</h3>
                              {s.bonus_tix > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                                  Complete: +{s.bonus_tix} tix
                                </span>
                              )}
                              <span className="text-xs text-gray-400">{setCollectibles.length} items</span>
                            </div>
                            {s.description && <p className="text-sm text-gray-500">{s.description}</p>}
                          </div>
                          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                            <button onClick={() => {
                              setEditingSetId(s.id);
                              setEditSetForm({ ...s, collectible_ids: setCollectibles.map((c: any) => c.id) });
                            }} className="text-gray-400 hover:text-indigo-600 transition" title="Edit">
                              <Pencil size={16} />
                            </button>
                            <button onClick={() => handleDeleteSet(s.id)}
                              className="text-gray-400 hover:text-red-600 transition" title="Delete">
                              <Trash2 size={16} />
                            </button>
                            <button onClick={() => setExpandedSets(prev => {
                              const n = new Set(prev);
                              n.has(s.id) ? n.delete(s.id) : n.add(s.id);
                              return n;
                            })} className="text-gray-400 hover:text-gray-600 transition">
                              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                            {setCollectibles.length === 0 ? (
                              <p className="text-sm text-gray-400">No collectibles assigned to this set.</p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {setCollectibles.map((c: any) => (
                                  <div key={c.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
                                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                      {c.image_url ? (
                                        <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <Star size={14} className="text-gray-300" />
                                      )}
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 truncate">{c.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {sets.length === 0 && !showCreateSet && (
                <div className="text-center text-gray-400 py-12">
                  <Package size={32} className="mx-auto mb-3 opacity-30" />
                  <p>No collection sets yet. Group collectibles into sets to award completion bonuses.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
