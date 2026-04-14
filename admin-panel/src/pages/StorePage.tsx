import { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2, Check, X, ShoppingCart, Loader2 } from 'lucide-react';
import { store } from '../api';

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
  const [tab, setTab] = useState<'items' | 'orders'>('items');
  const [orderFilter, setOrderFilter] = useState('');

  // Add/Edit item form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', price_tix: 0, stock: 0 });
  const [saving, setSaving] = useState(false);

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
    setFormData({ name: '', description: '', price_tix: 0, stock: 0 });
    setShowForm(true);
  }

  function openEditForm(item: any) {
    setEditingId(item.id);
    setFormData({ name: item.name, description: item.description || '', price_tix: item.price_tix, stock: item.stock });
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        await store.updateItem(editingId, formData);
      } else {
        await store.createItem(formData);
      }
      setShowForm(false);
      loadItems();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Store</h1>
        {tab === 'items' && (
          <button onClick={openAddForm}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
            <Plus size={16} /> Add Item
          </button>
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
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">{editingId ? 'Edit Item' : 'Add New Item'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
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

      {/* Items Tab */}
      {tab === 'items' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="text-sm font-medium text-gray-800">{item.name}</div>
                    {item.description && <div className="text-xs text-gray-400">{item.description}</div>}
                  </td>
                  <td className="px-6 py-3 text-sm text-center font-semibold text-gray-700">{item.price_tix} tix</td>
                  <td className="px-6 py-3 text-sm text-center">
                    <span className={item.stock > 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                      {item.stock}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
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
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No store items yet</td></tr>
              )}
            </tbody>
          </table>
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
            <table className="w-full">
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
      )}
    </div>
  );
}
