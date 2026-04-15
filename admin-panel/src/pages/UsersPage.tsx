import { useState, useEffect } from 'react';
import { UserPlus, Search, Link, X, Wifi, QrCode, X as CloseIcon } from 'lucide-react';
import { users } from '../api';

export default function UsersPage() {
  const [userList, setUserList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState({ name: '', nfc_uid: '', email: '' });
  const [linkingUserId, setLinkingUserId] = useState<number | null>(null);
  const [linkNfcUid, setLinkNfcUid] = useState('');
  const [showingQrUser, setShowingQrUser] = useState<any>(null);

  async function loadUsers() {
    try {
      setLoading(true);
      const res = searchQuery
        ? await users.search(searchQuery)
        : await users.list();
      setUserList(res.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    try {
      await users.register(form.name, form.nfc_uid, form.email || undefined);
      setForm({ name: '', nfc_uid: '', email: '' });
      setShowRegister(false);
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadUsers();
  }

  async function handleLinkNfc(userId: number) {
    if (!linkNfcUid.trim()) return;
    try {
      await users.update(userId, { nfc_uid: linkNfcUid.trim() });
      setSuccess(`NFC tag linked successfully!`);
      setLinkingUserId(null);
      setLinkNfcUid('');
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Users</h1>
        <button
          onClick={() => setShowRegister(!showRegister)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
        >
          <UserPlus size={16} />
          Register User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">×</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {success}
          <button onClick={() => setSuccess('')} className="ml-2 font-bold">×</button>
        </div>
      )}

      {showRegister && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Register New User</h2>
          <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <input
              placeholder="NFC UID *"
              value={form.nfc_uid}
              onChange={(e) => setForm({ ...form, nfc_uid: e.target.value })}
              required
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <input
              placeholder="Email (optional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium">
              Create
            </button>
          </form>
        </div>
      )}

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search by name or NFC UID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <button type="submit" className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition font-medium">
          Search
        </button>
      </form>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">NFC UID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">QR Code</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {userList.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600">{u.id}</td>
                  <td className="px-6 py-3">
                    <div className="text-sm font-medium text-gray-800">
                      {u.name}{u.last_name ? ` ${u.last_name}` : ''}
                    </div>
                    {u.dob && <div className="text-xs text-gray-400">DOB: {u.dob?.slice(0, 10)}</div>}
                  </td>
                  <td className="px-6 py-3 text-sm font-mono">
                    {u.nfc_uid ? (
                      <span className="text-gray-600">{u.nfc_uid}</span>
                    ) : linkingUserId === u.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          placeholder="Scan or type NFC UID"
                          value={linkNfcUid}
                          onChange={(e) => setLinkNfcUid(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleLinkNfc(u.id)}
                          className="w-36 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button onClick={() => handleLinkNfc(u.id)}
                          className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 transition">
                          Link
                        </button>
                        <button onClick={() => { setLinkingUserId(null); setLinkNfcUid(''); }}
                          className="text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-orange-400 italic text-xs">No NFC</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{u.email || '—'}</td>
                  <td className="px-6 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {u.is_admin && (
                        <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">Admin</span>
                      )}
                      {u.is_preregistered && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">Pre-registered</span>
                      )}
                      {!u.nfc_uid && !u.is_preregistered && !u.is_admin && (
                        <span className="text-gray-400">—</span>
                      )}
                      {u.nfc_uid && !u.is_admin && !u.is_preregistered && (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">Active</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {u.qr_code ? (
                      <button onClick={() => setShowingQrUser(u)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                        <QrCode size={12} /> View
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {!u.nfc_uid && linkingUserId !== u.id && (
                      <button onClick={() => { setLinkingUserId(u.id); setLinkNfcUid(''); }}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                        <Link size={12} /> Link NFC
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {userList.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showingQrUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">QR Code</h3>
              <button onClick={() => setShowingQrUser(null)} className="text-gray-400 hover:text-gray-600">
                <CloseIcon size={20} />
              </button>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">{showingQrUser.name}</p>
              {showingQrUser.qr_code && (
                <img src={showingQrUser.qr_code} alt="QR Code" className="mx-auto w-48 h-48" />
              )}
              <p className="text-xs text-gray-400 mt-4">Scan this code to register to events, load Tix, etc.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
