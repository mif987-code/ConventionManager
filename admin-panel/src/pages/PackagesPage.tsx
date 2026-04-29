import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { packages, specialVouchers } from '../api';

export default function PackagesPage() {
  const [packageList, setPackageList] = useState<any[]>([]);
  const [availableSpecialVouchers, setAvailableSpecialVouchers] = useState<any[]>([]);
  const [selectedSpecialVoucherIds, setSelectedSpecialVoucherIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', days: 1, cost: 0, prereg_cost: '', regular_voucher_amount: 0, is_active: true });

  async function loadPackages() {
    try {
      setLoading(true);
      const res = await packages.list();
      setPackageList(res.packages || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPackageSpecialVouchers(packageId: number, conventionId: number) {
    try {
      const [svRes, pkgSvRes] = await Promise.all([
        specialVouchers.list(conventionId),
        packages.getSpecialVouchers(packageId)
      ]);
      setAvailableSpecialVouchers(svRes.special_vouchers || []);
      setSelectedSpecialVoucherIds(pkgSvRes.special_voucher_ids || []);
    } catch (err: any) {
      console.error('Failed to load special vouchers:', err);
    }
  }

  useEffect(() => { loadPackages(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const preregCost = form.prereg_cost ? parseFloat(form.prereg_cost) : null;
      let savedPackage;
      if (editingPackage) {
        savedPackage = await packages.update(editingPackage.id, form.name, form.description || null, form.days, form.cost, preregCost, form.regular_voucher_amount, form.is_active);
      } else {
        savedPackage = await packages.create(form.name, form.description || null, form.days, form.cost, preregCost, form.regular_voucher_amount);
      }

      // Handle special voucher associations
      if (editingPackage) {
        const currentIds = selectedSpecialVoucherIds;
        const existingIds = await packages.getSpecialVouchers(editingPackage.id);
        const existingIdList = existingIds.special_voucher_ids || [];

        // Add new associations
        for (const id of currentIds) {
          if (!existingIdList.includes(id)) {
            await packages.addSpecialVoucher(editingPackage.id, id);
          }
        }

        // Remove old associations
        for (const id of existingIdList) {
          if (!currentIds.includes(id)) {
            await packages.removeSpecialVoucher(editingPackage.id, id);
          }
        }
      }

      setForm({ name: '', description: '', days: 1, cost: 0, prereg_cost: '', regular_voucher_amount: 0, is_active: true });
      setSelectedSpecialVoucherIds([]);
      setEditingPackage(null);
      setShowForm(false);
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
      prereg_cost: pkg.prereg_cost ? String(pkg.prereg_cost) : '',
      regular_voucher_amount: pkg.regular_voucher_amount || 0,
      is_active: pkg.is_active
    });
    loadPackageSpecialVouchers(pkg.id, pkg.convention_id);
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
    setForm({ name: '', description: '', days: 1, cost: 0, prereg_cost: '', regular_voucher_amount: 0, is_active: true });
    setSelectedSpecialVoucherIds([]);
    setEditingPackage(null);
    setShowForm(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Packages</h1>
        <button
          onClick={() => setShowForm(true)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Days Included *</label>
              <input
                type="number"
                placeholder="Number of days"
                value={form.days}
                onChange={(e) => setForm({ ...form, days: parseInt(e.target.value) || 0 })}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Regular Cost ($) *</label>
              <input
                type="number"
                placeholder="Price during event"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pre-registration Cost ($)</label>
              <input
                type="number"
                placeholder="Discounted price for early registration"
                value={form.prereg_cost}
                onChange={(e) => setForm({ ...form, prereg_cost: e.target.value })}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty to use regular cost</p>
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
            {editingPackage && (
              <div className="md:col-span-2">
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
                          <div className="text-xs text-gray-500">{sv.amount} vouchers</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 md:col-span-2">
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
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Days</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Cost</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Pre-reg Cost</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Regular Vouchers</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Special Vouchers</th>
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
                  <td className="px-6 py-3 text-sm text-gray-600">{pkg.days}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">${pkg.cost}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{pkg.prereg_cost ? `$${pkg.prereg_cost}` : '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{pkg.regular_voucher_amount || 0}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    <span className="text-xs text-gray-500">Edit to view</span>
                  </td>
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
