import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit2, X, Check, Package as PackageIcon, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { packages, specialVouchers } from '../api';

export default function PackagesPage() {
  const [packageList, setPackageList] = useState<any[]>([]);
  const [availableSpecialVouchers, setAvailableSpecialVouchers] = useState<any[]>([]);
  const [selectedSpecialVoucherIds, setSelectedSpecialVoucherIds] = useState<number[]>([]);
  const [merchandiseItems, setMerchandiseItems] = useState<Array<{ item_name: string; image_url?: string | null; store_item_id?: number | null; stock: number; price_tix: number }>>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', days: 1, cost: 0, prereg_cost: '', prereg_start_date: '', prereg_end_date: '', regular_voucher_amount: 0, is_active: true, package_type: 'day_pass' });
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  async function loadPackages() {
    try {
      setLoading(true);
      const conventionId = localStorage.getItem('cm_convention_id');
      if (conventionId) {
        const svRes = await specialVouchers.list(parseInt(conventionId));
        setAvailableSpecialVouchers(svRes.special_vouchers || []);
      }
      const res = await packages.list();
      setPackageList(res.packages || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPackageDetails(packageId: number, conventionId: number) {
    try {
      const [svRes, pkgSvRes, merchRes] = await Promise.all([
        specialVouchers.list(conventionId),
        packages.getSpecialVouchers(packageId),
        packages.getMerchandise(packageId)
      ]);
      setAvailableSpecialVouchers(svRes.special_vouchers || []);
      setSelectedSpecialVoucherIds(pkgSvRes.special_voucher_ids || []);
      setMerchandiseItems((merchRes.merchandise || []).map((m: any) => ({
        item_name: m.item_name,
        image_url: m.image_url || null,
        store_item_id: m.store_item_id || null,
        stock: Number(m.stock) || 0,
        price_tix: Number(m.price_tix) || 0,
      })));
    } catch (err: any) {
      console.error('Failed to load package details:', err);
    }
  }

  useEffect(() => { loadPackages(); }, []);

  async function handleImageUpload(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIndex(index);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await packages.uploadMerchandiseImage(fd);
      if (res.success && res.image_url) {
        const updated = [...merchandiseItems];
        updated[index].image_url = res.image_url;
        setMerchandiseItems(updated);
      } else {
        setError(res.error || 'Failed to upload image');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingIndex(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const preregCost = form.prereg_cost ? parseFloat(form.prereg_cost) : null;
      let targetPackageId: number;

      if (editingPackage) {
        await packages.update(editingPackage.id, form.name, form.description || null, form.days, form.cost, preregCost, form.prereg_start_date || null, form.prereg_end_date || null, form.regular_voucher_amount, form.is_active, form.package_type);
        targetPackageId = editingPackage.id;
      } else {
        const createRes = await packages.create(form.name, form.description || null, form.days, form.cost, preregCost, form.prereg_start_date || null, form.prereg_end_date || null, form.regular_voucher_amount, form.package_type);
        targetPackageId = createRes.package.id;
      }

      // Handle special voucher associations
      const currentIds = selectedSpecialVoucherIds;
      const existingIds = await packages.getSpecialVouchers(targetPackageId);
      const existingIdList = existingIds.special_voucher_ids || [];

      // Add new associations
      for (const id of currentIds) {
        if (!existingIdList.includes(id)) {
          await packages.addSpecialVoucher(targetPackageId, id);
        }
      }

      // Remove old associations
      for (const id of existingIdList) {
        if (!currentIds.includes(id)) {
          await packages.removeSpecialVoucher(targetPackageId, id);
        }
      }

      // Handle merchandise items with images
      await packages.setMerchandise(targetPackageId, merchandiseItems.filter(m => m.item_name && m.item_name.trim().length > 0));

      resetForm();
      loadPackages();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleEdit(pkg: any) {
    setEditingPackage(pkg);
    setForm({
      name: pkg.name,
      description: pkg.description || '',
      days: pkg.days,
      cost: pkg.cost,
      prereg_cost: pkg.prereg_cost != null ? String(pkg.prereg_cost) : '',
      prereg_start_date: pkg.prereg_start_date ? String(pkg.prereg_start_date).slice(0, 10) : '',
      prereg_end_date: pkg.prereg_end_date ? String(pkg.prereg_end_date).slice(0, 10) : '',
      regular_voucher_amount: pkg.regular_voucher_amount || 0,
      is_active: pkg.is_active,
      package_type: pkg.package_type || 'day_pass'
    });
    loadPackageDetails(pkg.id, pkg.convention_id);
    setShowForm(true);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this package?')) return;
    try {
      await packages.delete(id);
      loadPackages();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function resetForm() {
    setForm({ name: '', description: '', days: 1, cost: 0, prereg_cost: '', prereg_start_date: '', prereg_end_date: '', regular_voucher_amount: 0, is_active: true, package_type: 'day_pass' });
    setSelectedSpecialVoucherIds([]);
    setMerchandiseItems([]);
    setEditingPackage(null);
    setShowForm(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Packages</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
        >
          <Plus size={16} />
          Add Package
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">×</button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">{editingPackage ? 'Edit Package' : 'Add New Package'}</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Package Name *</label>
              <input
                placeholder="e.g., Weekend Pass"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Package Type *</label>
              <select
                value={form.package_type}
                onChange={(e) => setForm({ ...form, package_type: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="day_pass">Day Pass</option>
                <option value="voucher_pack">Voucher Pack</option>
                <option value="merchandise">Merchandise</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Voucher packs and merchandise support quantity multipliers at checkout.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Days Included</label>
              <input
                type="number"
                placeholder="Number of days"
                value={form.days}
                onChange={(e) => setForm({ ...form, days: parseInt(e.target.value) || 0 })}
                required
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Use 0 for non day-pass packages (vouchers, merchandise, etc).</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Regular Cost (₡) *</label>
              <input
                type="number"
                placeholder="Price during event in CRC"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })}
                required
                min="0"
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pre-registration Cost (₡)</label>
              <input
                type="number"
                placeholder="Discounted price for early registration in CRC"
                value={form.prereg_cost}
                onChange={(e) => setForm({ ...form, prereg_cost: e.target.value })}
                min="0"
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty to use regular cost</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pre-registration Price Starts</label>
              <input
                type="date"
                value={form.prereg_start_date}
                onChange={(e) => setForm({ ...form, prereg_start_date: e.target.value })}
                disabled={!form.prereg_cost}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pre-registration Price Ends</label>
              <input
                type="date"
                value={form.prereg_end_date}
                min={form.prereg_start_date || undefined}
                onChange={(e) => setForm({ ...form, prereg_end_date: e.target.value })}
                disabled={!form.prereg_cost}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">Dates are inclusive and use Costa Rica time. Leave either date empty for no boundary.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Regular Voucher Bonus</label>
              <input
                type="number"
                placeholder="Vouchers awarded on purchase"
                value={form.regular_voucher_amount}
                onChange={(e) => setForm({ ...form, regular_voucher_amount: parseInt(e.target.value) || 0 })}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Number of regular vouchers to award</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                placeholder="Optional package description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
            </div>

            {/* Merchandise included with this package */}
            <div className="md:col-span-2 pt-3 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">Included Merchandise / Swag</label>
              <p className="text-xs text-gray-500 mb-3">Each item is published in Store immediately. Store sales and completed package purchases share this stock; claiming an assigned item does not subtract it twice.</p>
              
              {merchandiseItems.length === 0 ? (
                <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
                  <p className="text-xs text-gray-500 mb-2">No merchandise added yet. Click "+ Add Merchandise" to include t-shirts, playmats, pins, etc.</p>
                  <button
                    type="button"
                    onClick={() => setMerchandiseItems([...merchandiseItems, { item_name: '', image_url: null, store_item_id: null, stock: 0, price_tix: 0 }])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition"
                  >
                    <Plus size={14} /> Add Merchandise
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {merchandiseItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      {/* Image Thumbnail / Upload */}
                      <div className="flex items-center gap-2">
                        {item.image_url ? (
                          <div className="relative group w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-white">
                            <img src={item.image_url} alt="Item" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...merchandiseItems];
                                updated[idx].image_url = null;
                                setMerchandiseItems(updated);
                              }}
                              className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-xs"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={uploadingIndex === idx}
                            onClick={() => fileInputRefs.current[idx]?.click()}
                            className="w-12 h-12 rounded-lg border border-dashed border-gray-300 bg-white hover:bg-gray-100 flex flex-col items-center justify-center text-gray-400 hover:text-indigo-600 transition"
                            title="Upload Item Photo"
                          >
                            {uploadingIndex === idx ? (
                              <Loader2 size={16} className="animate-spin text-indigo-600" />
                            ) : (
                              <>
                                <Upload size={14} />
                                <span className="text-[9px] mt-0.5">Photo</span>
                              </>
                            )}
                          </button>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          ref={el => fileInputRefs.current[idx] = el}
                          className="hidden"
                          onChange={(e) => handleImageUpload(idx, e)}
                        />
                      </div>

                      {/* Name input */}
                      <input
                        type="text"
                        placeholder="e.g. Official Spark Fest Playmat, T-Shirt (Size L)"
                        value={item.item_name}
                        onChange={(e) => {
                          const updated = [...merchandiseItems];
                          updated[idx].item_name = e.target.value;
                          setMerchandiseItems(updated);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />

                      <label className="w-24 text-xs text-gray-500">
                        Stock
                        <input
                          type="number"
                          min="0"
                          required
                          value={item.stock}
                          onChange={(e) => {
                            const updated = [...merchandiseItems];
                            updated[idx].stock = Math.max(0, parseInt(e.target.value) || 0);
                            setMerchandiseItems(updated);
                          }}
                          className="mt-1 w-full px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </label>

                      <label className="w-24 text-xs text-gray-500">
                        Price (Tix)
                        <input
                          type="number"
                          min="0"
                          required
                          value={item.price_tix}
                          onChange={(e) => {
                            const updated = [...merchandiseItems];
                            updated[idx].price_tix = Math.max(0, parseInt(e.target.value) || 0);
                            setMerchandiseItems(updated);
                          }}
                          className="mt-1 w-full px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setMerchandiseItems(merchandiseItems.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 p-1.5"
                        title="Remove Item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setMerchandiseItems([...merchandiseItems, { item_name: '', image_url: null, store_item_id: null, stock: 0, price_tix: 0 }])}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 pt-1"
                  >
                    <Plus size={14} /> Add Another Merchandise Item
                  </button>
                </div>
              )}
            </div>

            {/* Special Vouchers */}
            <div className="md:col-span-2 pt-2 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">Special Vouchers</label>
              {availableSpecialVouchers.length === 0 ? (
                <p className="text-sm text-gray-500">No special vouchers available for this convention.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {availableSpecialVouchers.map((sv: any) => (
                    <label key={sv.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedSpecialVoucherIds.includes(sv.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSpecialVoucherIds([...selectedSpecialVoucherIds, sv.id]);
                          } else {
                            setSelectedSpecialVoucherIds(selectedSpecialVoucherIds.filter(id => id !== sv.id));
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">{sv.name}</div>
                        <div className="text-xs text-gray-500">{sv.category || 'Special'}{sv.format ? ` • ${sv.format}` : ''}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 md:col-span-2 mt-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium">
                {editingPackage ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={resetForm} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition font-medium">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Days</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Cost</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Pre-reg Cost</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Regular Vouchers</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {packageList.map((pkg: any) => (
                <tr key={pkg.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="text-sm font-medium text-gray-800">{pkg.name}</div>
                    {pkg.description && <div className="text-xs text-gray-400">{pkg.description}</div>}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium capitalize">
                      {(pkg.package_type || 'day_pass').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{pkg.days}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">₡{Number(pkg.cost).toLocaleString('es-CR')}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{pkg.prereg_cost ? `₡${Number(pkg.prereg_cost).toLocaleString('es-CR')}` : '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{pkg.regular_voucher_amount || 0}</td>
                  <td className="px-6 py-3 text-sm">
                    {pkg.is_active ? (
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">Active</span>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">Inactive</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(pkg)} className="text-indigo-600 hover:text-indigo-700">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(pkg.id)} className="text-red-500 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {packageList.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400">No packages yet. Create one to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
