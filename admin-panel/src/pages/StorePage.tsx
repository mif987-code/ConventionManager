import { useState, useEffect, useRef } from 'react';
import { Package, Plus, Edit2, Trash2, Check, X, ShoppingCart, Loader2, Upload, Download } from 'lucide-react';
import { store } from '../api';
import BulkImportVerification from '../components/BulkImportVerification';

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  reserved: 'bg-yellow-100 text-yellow-700',
  fulfilled: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-gray-100 text-gray-600',
};

export default function StorePage() {
  const [items, setItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'items' | 'orders' | 'transactions'>('items');
  const [orderFilter, setOrderFilter] = useState('');

  // Add/Edit item form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', price_tix: 0, stock: 0, set_name: '', card_number: '', language: 'English', condition: 'NM', foil: false, cost: 0, category: 'cards', image_url: '' });
  const [saving, setSaving] = useState(false);
  
  // Bulk import
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; imported: number; errors: string[]; warnings: string[] } | null>(null);
  
  // Verification mode
  const [showVerification, setShowVerification] = useState(false);
  const [parsedImportItems, setParsedImportItems] = useState<any[]>([]);

  // Autocomplete state
  const [cardSuggestions, setCardSuggestions] = useState<string[]>([]);
  const [setSuggestions, setSetSuggestions] = useState<{name:string;code:string}[]>([]);
  const [showCardDrop, setShowCardDrop] = useState(false);
  const [showSetDrop, setShowSetDrop] = useState(false);
  const cardDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function loadItems() {
    try {
      const res = await store.listItems();
      setItems(res.items || []);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function loadOrders() {
    try {
      const res = await store.listOrders(orderFilter || undefined);
      setOrders(res.orders || []);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([loadItems(), loadOrders()]);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => { loadOrders(); }, [orderFilter]);

  function openAddForm() {
    setEditingId(null);
    setFormData({ name: '', description: '', price_tix: 0, stock: 0, set_name: '', card_number: '', language: 'English', condition: 'NM', foil: false, cost: 0, category: 'cards', image_url: '' });
    setImageFile(null); setImagePreview('');
    setShowForm(true);
  }

  function openEditForm(item: any) {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      description: item.description || '',
      price_tix: item.price_tix,
      stock: item.stock,
      set_name: item.set_name || '',
      card_number: item.card_number || '',
      language: item.language || 'English',
      condition: item.condition || 'NM',
      foil: item.foil || false,
      cost: item.cost || 0,
      category: item.category || 'cards',
      image_url: item.image_url || '',
    });
    setImageFile(null); setImagePreview(item.image_url ? item.image_url : '');
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      let finalImageUrl = formData.image_url;
      if (imageFile) {
        finalImageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
      }
      const payload = { ...formData, image_url: finalImageUrl };
      if (editingId) {
        await store.updateItem(editingId, payload);
      } else {
        await store.createItem(payload);
      }
      setShowForm(false);
      setImageFile(null); setImagePreview('');
      loadItems();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCardNameChange(val: string) {
    setFormData(f => ({ ...f, name: val }));
    setShowCardDrop(true);
    if (cardDebounce.current) clearTimeout(cardDebounce.current);
    if (val.trim().length < 2) { setCardSuggestions([]); return; }
    cardDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cards/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        const names = Array.from(new Set((data.cards || []).map((c: any) => c.name))) as string[];
        setCardSuggestions(names.slice(0, 8));
      } catch { setCardSuggestions([]); }
    }, 300);
  }

  function handleSetNameChange(val: string) {
    setFormData(f => ({ ...f, set_name: val }));
    setShowSetDrop(true);
    if (setDebounce.current) clearTimeout(setDebounce.current);
    if (val.trim().length < 2) { setSetSuggestions([]); return; }
    setDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sets?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setSetSuggestions((data.sets || []).slice(0, 8));
      } catch { setSetSuggestions([]); }
    }, 300);
  }

  function handleImageFile(file: File | null) {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setFormData(f => ({ ...f, image_url: '' }));
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this item?')) return;
    try {
      await store.deleteItem(id);
      loadItems();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleFulfill(orderId: number) {
    try {
      await store.fulfillOrder(orderId);
      loadOrders();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCancelOrder(orderId: number) {
    try {
      await store.cancelOrder(orderId);
      loadOrders();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleBulkImport() {
    if (!uploadFile) {
      setError('Please select a file to import');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('validate_scryfall', 'true');
      formData.append('dry_run', 'true'); // Use dry-run mode for verification
      
      const conventionId = localStorage.getItem('cm_convention_id');
      const response = await fetch('/api/store/bulk-import', {
        method: 'POST',
        headers: {
          'x-api-key': localStorage.getItem('cm_api_key') || '',
          ...(conventionId && { 'x-convention-id': conventionId }),
        },
        body: formData,
      });
      const result = await response.json();
      
      // Show verification UI
      setParsedImportItems(result.items || []);
      setShowVerification(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function handleVerifiedUpload(items: any[]) {
    try {
      const conventionId = localStorage.getItem('cm_convention_id');
      const response = await fetch('/api/store/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('cm_api_key') || '',
          ...(conventionId && { 'x-convention-id': conventionId }),
        },
        body: JSON.stringify({ items, validate_scryfall: false }), // Skip validation since already validated
      });
      const result = await response.json();
      
      if (result.success) {
        setShowVerification(false);
        loadItems();
        setImportResult(result);
      } else {
        setError(result.errors?.join(', ') || 'Import failed');
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  function downloadTemplate() {
    // Create CSV template
    const csvContent = `Quantity,Card Name,Set Name,Card Number,Language,Condition,Foil,Cost,Tix Price
1,Lightning Bolt,Double Masters 2022,361,English,NM,No,2.50,5
`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'store_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Store</h1>
        {tab === 'items' && (
          <div className="flex gap-2">
            <button onClick={openAddForm}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
              <Plus size={16} /> Add Item
            </button>
            <button onClick={() => setShowBulkImport(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium">
              <Upload size={16} /> Bulk Import
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button onClick={() => setTab('items')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'items' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Items ({items.length})
        </button>
        <button onClick={() => setTab('orders')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'orders' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Orders ({orders.length})
        </button>
        <button onClick={() => setTab('transactions')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'transactions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Transactions
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">{editingId ? 'Edit Item' : 'Add New Item'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                <option value="cards">Cards</option>
                <option value="sealed">Sealed Product</option>
                <option value="merchandise">Merchandise</option>
              </select>
            </div>
            <div className="md:col-span-3 relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">{formData.category === 'cards' ? 'Card Name' : 'Name'}</label>
              <input value={formData.name}
                onChange={e => formData.category === 'cards' ? handleCardNameChange(e.target.value) : setFormData(f => ({ ...f, name: e.target.value }))}
                onBlur={() => setTimeout(() => setShowCardDrop(false), 150)}
                placeholder={formData.category === 'cards' ? 'Type card name...' : ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
              {formData.category === 'cards' && showCardDrop && cardSuggestions.length > 0 && (
                <ul className="absolute z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 w-full max-h-48 overflow-y-auto">
                  {cardSuggestions.map((name: string) => (
                    <li key={name} className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer"
                      onMouseDown={() => { setFormData(f => ({ ...f, name })); setShowCardDrop(false); setCardSuggestions([]); }}>
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Card-specific fields */}
            {formData.category === 'cards' && (
              <>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Set Name</label>
                  <input value={formData.set_name} onChange={e => handleSetNameChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowSetDrop(false), 150)}
                    onFocus={() => setSuggestions.length > 0 && setShowSetDrop(true)}
                    placeholder="Type to search sets..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  {showSetDrop && setSuggestions.length > 0 && (
                    <ul className="absolute z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 w-full max-h-48 overflow-y-auto">
                      {setSuggestions.map((s: any) => (
                        <li key={s.code} className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer"
                          onMouseDown={() => { setFormData(f => ({ ...f, set_name: s.name })); setShowSetDrop(false); setSetSuggestions([]); }}>
                          {s.name} <span className="text-gray-400 text-xs ml-1">{s.code}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                  <input value={formData.card_number} onChange={e => setFormData({ ...formData, card_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  <select value={formData.language} onChange={e => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                    <option value="English">English</option>
                    <option value="Japanese">Japanese</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Italian">Italian</option>
                    <option value="Portuguese">Portuguese</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Korean">Korean</option>
                    <option value="Russian">Russian</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select value={formData.condition} onChange={e => setFormData({ ...formData, condition: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                    <option value="NM">Near Mint (NM)</option>
                    <option value="LP">Lightly Played (LP)</option>
                    <option value="MP">Moderately Played (MP)</option>
                    <option value="HP">Heavily Played (HP)</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Foil</label>
                  <label className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={formData.foil} onChange={e => setFormData({ ...formData, foil: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                    <span className="text-sm text-gray-700">Yes</span>
                  </label>
                </div>
              </>
            )}

            {/* Image upload for Sealed and Merchandise */}
            {formData.category !== 'cards' && (
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <button type="button" onClick={() => imageInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
                      <Upload size={14} /> Upload file (JPEG/PNG/TIFF/WEBP)
                    </button>
                    <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/tiff,image/webp,.jpg,.jpeg,.tif,.tiff,.png,.webp"
                      className="hidden" onChange={e => handleImageFile(e.target.files?.[0] || null)} />
                    <input value={imageFile ? '' : formData.image_url} onChange={e => { setFormData(f => ({ ...f, image_url: e.target.value })); setImageFile(null); setImagePreview(''); }}
                      placeholder="Or paste image URL..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  {(imagePreview || formData.image_url) && (
                    <img src={imagePreview || formData.image_url} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-gray-200" onError={e => (e.currentTarget.style.display='none')} />
                  )}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost ($)</label>
              <input type="number" min="0" step="0.01" value={formData.cost} onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (Tix)</label>
              <input type="number" min="0" value={formData.price_tix} onChange={e => setFormData({ ...formData, price_tix: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
              <input type="number" min="0" value={formData.stock} onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving || !formData.name}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {editingId ? 'Update' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bulk Import Form */}
      {showBulkImport && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Bulk Import Items</h2>
            <button onClick={() => { setShowBulkImport(false); setUploadFile(null); setImportResult(null); }} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <div className="mb-4">
            <button onClick={downloadTemplate} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium">
              <Download size={14} /> Download CSV Template
            </button>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload Excel (.xlsx) or CSV file</label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setUploadFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          {importResult && (
            <div className={`p-4 rounded-lg mb-4 ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className={`font-medium mb-2 ${importResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {importResult.success ? 'Import completed!' : 'Import failed'}
              </div>
              <div className="text-sm text-gray-700 mb-1">Imported: {importResult.imported} items</div>
              {importResult.warnings.length > 0 && (
                <div className="text-sm text-yellow-700 mt-2">
                  <div className="font-medium">Warnings:</div>
                  {importResult.warnings.slice(0, 5).map((w, i) => <div key={i}>• {w}</div>)}
                  {importResult.warnings.length > 5 && <div>... and {importResult.warnings.length - 5} more</div>}
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div className="text-sm text-red-700 mt-2">
                  <div className="font-medium">Errors:</div>
                  {importResult.errors.slice(0, 5).map((e, i) => <div key={i}>• {e}</div>)}
                  {importResult.errors.length > 5 && <div>... and {importResult.errors.length - 5} more</div>}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleBulkImport} disabled={!uploadFile || importing}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Import
            </button>
            <button onClick={() => { setShowBulkImport(false); setUploadFile(null); setImportResult(null); }}
              className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Verification UI */}
      {showVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <BulkImportVerification
              items={parsedImportItems}
              onUpload={handleVerifiedUpload}
              onCancel={() => setShowVerification(false)}
            />
          </div>
        </div>
      )}

      {/* Items Tab */}
      {tab === 'items' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Card</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Set / CN</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cond / Lang</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cost</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tix</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-800">{item.name}</div>
                      {item.foil && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Foil</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-600">{item.set_name || '—'}</div>
                    <div className="text-xs text-gray-400">#{item.card_number || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="text-xs text-gray-600">{item.condition || 'NM'}</div>
                    <div className="text-xs text-gray-400">{item.language || 'English'}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-700">${item.cost || '0'}</td>
                  <td className="px-4 py-3 text-sm text-center font-semibold text-gray-700">{item.price_tix} tix</td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className={item.stock > 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                      {item.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEditForm(item)} className="text-gray-400 hover:text-indigo-600 transition">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-600 transition">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No store items yet</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div>
          <div className="flex gap-2 mb-4">
            {['', 'confirmed', 'reserved', 'fulfilled', 'cancelled'].map(f => (
              <button key={f} onClick={() => setOrderFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${orderFilter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {f || 'All'}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Player</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div className="text-sm font-medium text-gray-800">{order.item_name || `Item #${order.item_id}`}</div>
                      <div className="text-xs text-gray-400">#{order.id} &middot; {order.order_type}</div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">{order.user_name || `User #${order.user_id}`}</td>
                    <td className="px-6 py-3 text-sm text-center">{order.quantity}</td>
                    <td className="px-6 py-3 text-sm text-center font-semibold">{order.total_tix} tix</td>
                    <td className="px-6 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] || ''}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {(order.status === 'confirmed' || order.status === 'reserved') && (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleFulfill(order.id)}
                            className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-md hover:bg-blue-700 transition">
                            Fulfill
                          </button>
                          <button onClick={() => handleCancelOrder(order.id)}
                            className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-md hover:bg-red-200 transition">
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No orders found</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {tab === 'transactions' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Player</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Total Tix</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order: any) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600">{new Date(order.created_at).toLocaleString()}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">{order.user_name || `User #${order.user_id}`}</td>
                  <td className="px-6 py-3">
                    <div className="text-sm font-medium text-gray-800">{order.item_name || `Item #${order.item_id}`}</div>
                  </td>
                  <td className="px-6 py-3 text-sm text-center">{order.quantity}</td>
                  <td className="px-6 py-3 text-sm text-center font-semibold text-indigo-600">{order.total_tix} tix</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] || ''}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600 capitalize">{order.order_type}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">No transactions found</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
