import { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, UserPlus, X, Search, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { permissions, users } from '../api';

const PERM_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  super:     { label: 'Super Admin', desc: 'Can manage other admins\' permissions', color: 'bg-red-100 text-red-700' },
  users:     { label: 'Users',       desc: 'Can manage users',                      color: 'bg-blue-100 text-blue-700' },
  events:    { label: 'Events',      desc: 'Can manage events, rounds, matches',    color: 'bg-green-100 text-green-700' },
  vouchers:  { label: 'Vouchers',    desc: 'Can manage voucher top-ups',            color: 'bg-purple-100 text-purple-700' },
  tix:       { label: 'Tix',         desc: 'Can manage tix adjustments',            color: 'bg-yellow-100 text-yellow-700' },
  store:     { label: 'Store',       desc: 'Can manage store items & orders',       color: 'bg-pink-100 text-pink-700' },
  stats:     { label: 'Stats',       desc: 'Can view statistics',                   color: 'bg-teal-100 text-teal-700' },
  register:  { label: 'Register',    desc: 'Can register players at events via NFC', color: 'bg-indigo-100 text-indigo-700' },
};

export default function PermissionsPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Promote user modal
  const [showPromote, setShowPromote] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [promotePerms, setPromotePerms] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [adminsRes, catsRes] = await Promise.all([
        permissions.admins(),
        permissions.categories(),
      ]);
      setAdmins(adminsRes.admins || []);
      setCategories(catsRes.categories || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 1) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await users.search(q.trim());
      const adminIds = new Set(admins.map((a: any) => a.id));
      setSearchResults((res.users || []).filter((u: any) => !adminIds.has(u.id)));
    } catch (err: any) { setError(err.message); }
    finally { setSearching(false); }
  }, [admins]);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  async function handlePromote() {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await permissions.promote(selectedUser.id, Array.from(promotePerms));
      setShowPromote(false);
      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      setPromotePerms(new Set());
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDemote(userId: number) {
    if (!confirm('Remove admin status from this user?')) return;
    setSaving(true);
    try {
      await permissions.demote(userId);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function togglePerm(perms: Set<string>, perm: string): Set<string> {
    const next = new Set(perms);
    if (next.has(perm)) next.delete(perm); else next.add(perm);
    return next;
  }

  async function handleSavePerms(userId: number, perms: string[]) {
    setSaving(true);
    try {
      await permissions.set(userId, perms);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage who can do what in the system</p>
        </div>
        <button onClick={() => { setShowPromote(true); setSelectedUser(null); setPromotePerms(new Set()); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
          <UserPlus size={16} /> Promote User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Promote Modal */}
      {showPromote && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Promote User to Admin</h2>
            <button onClick={() => setShowPromote(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          {!selectedUser ? (
            <>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input placeholder="Search by name, email, or NFC UID..."
                  value={searchQuery} onChange={e => handleSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />}
              </div>
              {searchResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {searchResults.map((u: any) => (
                    <button key={u.id} onClick={() => setSelectedUser(u)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-800">{u.name} {u.last_name || ''}</span>
                        {u.email && <span className="text-xs text-gray-400 ml-2">{u.email}</span>}
                      </div>
                      <span className="text-xs text-gray-400 font-mono">{u.nfc_uid || 'No NFC'}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="bg-indigo-50 rounded-lg p-3 mb-4 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-800">{selectedUser.name} {selectedUser.last_name || ''}</span>
                  <span className="text-xs text-gray-500 ml-2">{selectedUser.email}</span>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-xs text-indigo-600 hover:text-indigo-700">Change</button>
              </div>
              <p className="text-sm font-medium text-gray-700 mb-2">Select Permissions:</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {categories.map(cat => {
                  const info = PERM_LABELS[cat] || { label: cat, desc: '', color: 'bg-gray-100 text-gray-700' };
                  const checked = promotePerms.has(cat);
                  return (
                    <button key={cat} onClick={() => setPromotePerms(togglePerm(promotePerms, cat))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition ${
                        checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                        {checked && <Check size={10} className="text-white" />}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">{info.label}</span>
                        <p className="text-xs text-gray-400">{info.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={handlePromote} disabled={saving}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                Promote to Admin
              </button>
            </>
          )}
        </div>
      )}

      {/* Admins List */}
      <div className="space-y-3">
        {admins.map((admin: any) => {
          const perms: string[] = admin.admin_permissions || [];
          const isExpanded = expandedId === admin.id;
          return (
            <div key={admin.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : admin.id)}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${perms.includes('super') ? 'bg-red-500' : 'bg-indigo-500'}`}>
                    {(admin.name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{admin.name} {admin.last_name || ''}</div>
                    <div className="text-xs text-gray-400">{admin.email || 'No email'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-wrap gap-1">
                    {perms.slice(0, 4).map((p: string) => {
                      const info = PERM_LABELS[p] || { label: p, color: 'bg-gray-100 text-gray-700' };
                      return <span key={p} className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>{info.label}</span>;
                    })}
                    {perms.length > 4 && <span className="text-xs text-gray-400">+{perms.length - 4}</span>}
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </div>
              {isExpanded && (
                <div className="px-6 pb-4 border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Permissions:</p>
                  <AdminPermEditor
                    categories={categories}
                    currentPerms={perms}
                    saving={saving}
                    onSave={(newPerms) => handleSavePerms(admin.id, newPerms)}
                    onDemote={() => handleDemote(admin.id)}
                  />
                </div>
              )}
            </div>
          );
        })}
        {admins.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-400">
            No admin users found. Promote a user to get started.
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPermEditor({ categories, currentPerms, saving, onSave, onDemote }: {
  categories: string[];
  currentPerms: string[];
  saving: boolean;
  onSave: (perms: string[]) => void;
  onDemote: () => void;
}) {
  const [perms, setPerms] = useState<Set<string>>(new Set(currentPerms));
  const changed = JSON.stringify([...perms].sort()) !== JSON.stringify([...currentPerms].sort());

  function toggle(perm: string) {
    setPerms(prev => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm); else next.add(perm);
      return next;
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {categories.map(cat => {
          const info = PERM_LABELS[cat] || { label: cat, desc: '', color: 'bg-gray-100 text-gray-700' };
          const checked = perms.has(cat);
          return (
            <button key={cat} onClick={() => toggle(cat)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition ${
                checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                {checked && <Check size={10} className="text-white" />}
              </div>
              <span className="font-medium text-gray-800 text-xs">{info.label}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        {changed && (
          <button onClick={() => onSave(Array.from(perms))} disabled={saving}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save Changes
          </button>
        )}
        <button onClick={onDemote} disabled={saving}
          className="text-sm text-red-500 hover:text-red-700 transition font-medium disabled:opacity-50">
          Remove Admin
        </button>
      </div>
    </>
  );
}
