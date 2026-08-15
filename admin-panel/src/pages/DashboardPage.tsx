import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Calendar, CreditCard, ScanLine, Trash2, AlertTriangle, Lock, Download, Save, QrCode, Shield, UserPlus, X, Search, Check, Loader2, ChevronDown, ChevronUp, Key, Eye, EyeOff, Settings } from 'lucide-react';
import { users, events, conventions, permissions } from '../api';

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

export default function DashboardPage() {
  const [stats, setStats] = useState({ userCount: 0, openEvents: 0, totalEvents: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [convention, setConvention] = useState<any>(null);
  const [ending, setEnding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scanMode, setScanMode] = useState<'nfc' | 'qr'>('qr');
  const [updatingMode, setUpdatingMode] = useState(false);
  const [scanModeLocked, setScanModeLocked] = useState(false);

  // Admin & Settings state
  const [activeTab, setActiveTab] = useState<'overview' | 'permissions' | 'settings'>('overview');
  const [admins, setAdmins] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [promotePerms, setPromotePerms] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settings state
  const [qrSecretKey, setQrSecretKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const conventionId = localStorage.getItem('cm_convention_id');
        if (conventionId) {
          const convRes = await conventions.get(parseInt(conventionId));
          setConvention(convRes.convention);
          if (convRes.convention.scan_mode) {
            setScanMode(convRes.convention.scan_mode);
          }
        }

        const [usersRes, eventsRes] = await Promise.all([
          users.list(),
          events.list(),
        ]);
        const userCount = usersRes.users?.length || 0;
        const eventCount = eventsRes.events?.length || 0;
        setStats({
          userCount,
          openEvents: eventsRes.events?.filter((e: any) => e.status === 'open').length || 0,
          totalEvents: eventCount,
        });
        // Lock scan mode if convention has users or events
        setScanModeLocked(userCount > 0 || eventCount > 0);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleUpdateScanMode(mode: 'nfc' | 'qr') {
    if (!convention) return;
    setUpdatingMode(true);
    try {
      // Update the convention with new scan mode
      await conventions.update(convention.id, { scan_mode: mode });
      setScanMode(mode);
      setConvention({ ...convention, scan_mode: mode });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingMode(false);
    }
  }

  async function handleEndConvention() {
    if (!convention) return;
    if (!confirm('End this convention? This will:\n- Lock all events (no new events can be created)\n- Lock the store (no new items can be added)\n- Prevent any further data modifications\n\nThis action CANNOT be undone. Continue?')) {
      return;
    }
    
    setEnding(true);
    try {
      const result = await conventions.end(convention.id);
      setConvention(result.convention);
      alert('Convention has been ended. All data is now locked.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnding(false);
    }
  }

  async function handleExportConvention() {
    if (!convention) return;
    setExporting(true);
    try {
      const result = await conventions.export(convention.id);
      const dataStr = JSON.stringify(result.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `convention_${convention.name}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      alert('Convention data exported successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteConvention() {
    if (!convention) return;
    if (convention.status !== 'ended') {
      alert('You must end the convention before deleting it.');
      return;
    }
    if (!confirm('DELETE this convention and ALL its data?\n\nThis includes:\n- All events and participants\n- All store items and orders\n- All transactions\n- All users\n\nThis action CANNOT be undone. Continue?')) {
      return;
    }
    
    setDeleting(true);
    try {
      await conventions.delete(convention.id);
      localStorage.removeItem('cm_convention_id');
      localStorage.removeItem('cm_convention_name');
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  // Permissions functions
  async function loadPermissions() {
    try {
      const [adminsRes, catsRes] = await Promise.all([
        permissions.admins(),
        permissions.categories(),
      ]);
      setAdmins(adminsRes.admins || []);
      setCategories(catsRes.categories || []);
    } catch (err: any) {
      setError(err.message);
    }
  }

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
      loadPermissions();
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
      loadPermissions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function togglePerm(perms: Set<string>, perm: string): Set<string> {
    const next = new Set(perms);
    if (next.has(perm)) next.delete(perm);
    else next.add(perm);
    return next;
  }

  // Settings functions
  async function loadSettings() {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/admin/settings/qr-secret-key', {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('cm_api_key') || '',
        },
      });
      const data = await res.json();
      if (res.ok) {
        setQrSecretKey(data.value || '');
      } else {
        throw new Error(data.error || 'Failed to load settings');
      }
    } catch (err: any) {
      setSettingsError(err.message);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleSaveSettings() {
    setSettingsLoading(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      const res = await fetch('/api/admin/settings/qr-secret-key', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('cm_api_key') || '',
        },
        body: JSON.stringify({ value: qrSecretKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setSettingsSuccess('QR Secret Key updated successfully!');
      } else {
        throw new Error(data.error || 'Failed to update settings');
      }
    } catch (err: any) {
      setSettingsError(err.message);
    } finally {
      setSettingsLoading(false);
    }
  }

  function generateNewKey() {
    const array = new Uint32Array(8);
    crypto.getRandomValues(array);
    const newKey = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    setQrSecretKey(newKey);
  }

  useEffect(() => {
    if (activeTab === 'permissions') {
      loadPermissions();
    } else if (activeTab === 'settings') {
      loadSettings();
    }
  }, [activeTab]);

  const cards = [
    { label: 'Total Users', value: stats.userCount, icon: <Users size={24} />, color: 'bg-blue-500', to: '/users' },
    { label: 'Open Events', value: stats.openEvents, icon: <Calendar size={24} />, color: 'bg-green-500', to: '/events' },
    { label: 'Total Events', value: stats.totalEvents, icon: <Calendar size={24} />, color: 'bg-purple-500', to: '/events' },
  ];

  const TabButton = ({ id, label, icon }: { id: typeof activeTab; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
        activeTab === id
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <div className="flex gap-2">
          <TabButton id="overview" label="Overview" icon={<Settings size={18} />} />
          <TabButton id="permissions" label="Permissions" icon={<Shield size={18} />} />
          <TabButton id="settings" label="Settings" icon={<Key size={18} />} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {activeTab === 'overview' && (
        loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {cards.map((card) => (
                <Link key={card.label} to={card.to} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{card.label}</p>
                      <p className="text-3xl font-bold text-gray-800 mt-1">{card.value}</p>
                    </div>
                    <div className={`${card.color} text-white p-3 rounded-lg`}>
                      {card.icon}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link to="/scan" className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white hover:shadow-lg transition">
                <div className="flex items-center gap-4">
                  {scanMode === 'qr' ? <QrCode size={32} /> : <ScanLine size={32} />}
                  <div>
                    <h3 className="text-lg font-semibold">{scanMode === 'qr' ? 'QR Scanner' : 'NFC Scanner'}</h3>
                    <p className="text-indigo-100 text-sm">Scan a {scanMode === 'qr' ? 'QR code' : 'tag'} to look up a player</p>
                  </div>
                </div>
              </Link>
              <Link to="/vouchers" className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-6 text-white hover:shadow-lg transition">
                <div className="flex items-center gap-4">
                  <CreditCard size={32} />
                  <div>
                    <h3 className="text-lg font-semibold">Voucher Top-Up</h3>
                    <p className="text-emerald-100 text-sm">Add vouchers to a player account</p>
                  </div>
                </div>
              </Link>
            </div>

            <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Convention Management</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Scan Mode {scanModeLocked && <Lock size={14} className="inline text-gray-400 ml-1" />}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateScanMode('nfc')}
                    disabled={updatingMode || scanModeLocked}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                      scanMode === 'nfc'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    <ScanLine size={16} /> NFC
                  </button>
                  <button
                    onClick={() => handleUpdateScanMode('qr')}
                    disabled={updatingMode || scanModeLocked}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                      scanMode === 'qr'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    <QrCode size={16} /> QR Code
                  </button>
                </div>
                {scanModeLocked && (
                  <p className="text-xs text-gray-500 mt-2">
                    Scan mode is locked because the convention already has users or events.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleExportConvention}
                  disabled={exporting}
                  className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50"
                >
                  {exporting ? 'Exporting...' : <><Download size={16} /> Export Data</>}
                </button>
                <button
                  onClick={handleEndConvention}
                  disabled={ending || convention?.status === 'ended'}
                  className="flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-3 rounded-lg hover:bg-amber-700 transition text-sm font-medium disabled:opacity-50"
                >
                  {ending ? 'Ending...' : <><Lock size={16} /> End Convention</>}
                </button>
                <button
                  onClick={handleDeleteConvention}
                  disabled={deleting || convention?.status !== 'ended'}
                  className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition text-sm font-medium disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : <><Trash2 size={16} /> Delete</>}
                </button>
              </div>
              {convention?.status === 'ended' && (
                <p className="text-xs text-gray-500 mt-3 text-center">
                  ⚠️ Convention is ended. Data is locked. Only export and delete are available.
                </p>
              )}
            </div>
          </>
        )
      )}

      {activeTab === 'permissions' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Admin Permissions</h2>
            <button
              onClick={() => { setShowPromote(true); setPromotePerms(new Set()); }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
            >
              <UserPlus size={16} /> Add Admin
            </button>
          </div>

          {showPromote && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-800">Promote User to Admin</h3>
                <button onClick={() => { setShowPromote(false); setSearchQuery(''); setSearchResults([]); setSelectedUser(null); }} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              {searching && <div className="text-sm text-gray-500">Searching...</div>}
              {searchResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 max-h-48 overflow-y-auto">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setSearchResults([]); }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition ${selectedUser?.id === u.id ? 'bg-indigo-50' : ''}`}
                    >
                      <span className="font-medium">{u.name}</span>
                      {u.email && <span className="text-sm text-gray-500 ml-2">{u.email}</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedUser && (
                <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-600">Selected: <span className="font-medium text-gray-800">{selectedUser.name}</span></p>
                </div>
              )}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Permissions:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(PERM_LABELS).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      onClick={() => setPromotePerms(togglePerm(promotePerms, key))}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition ${promotePerms.has(key) ? color : 'bg-gray-100 text-gray-600'}`}
                    >
                      {promotePerms.has(key) && <Check size={12} className="inline mr-1" />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handlePromote}
                disabled={!selectedUser || promotePerms.size === 0 || saving}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50"
              >
                {saving ? 'Promoting...' : 'Promote to Admin'}
              </button>
            </div>
          )}

          <div className="space-y-3">
            {admins.map((admin) => (
              <div key={admin.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{admin.name}</p>
                    <p className="text-sm text-gray-500">{admin.email || 'No email'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedId(expandedId === admin.id ? null : admin.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedId === admin.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    <button
                      onClick={() => handleDemote(admin.id)}
                      disabled={saving}
                      className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {expandedId === admin.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-700 mb-2">Permissions:</p>
                    <div className="flex flex-wrap gap-2">
                      {(admin.admin_permissions || []).map((perm: string) => (
                        <span key={perm} className={`px-2 py-1 rounded-full text-xs font-medium ${PERM_LABELS[perm]?.color || 'bg-gray-100 text-gray-600'}`}>
                          {PERM_LABELS[perm]?.label || perm}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {admins.length === 0 && (
              <p className="text-gray-500 text-center py-8">No admins yet</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Admin Settings</h2>

          {settingsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {settingsError}
            </div>
          )}
          {settingsSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
              {settingsSuccess}
            </div>
          )}

          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-100 text-indigo-600 p-3 rounded-lg">
              <Key size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">QR Secret Key</h3>
              <p className="text-sm text-gray-500">Secret key used to sign QR code tokens</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Secret Key</label>
              <div className="flex gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={qrSecretKey}
                  onChange={(e) => setQrSecretKey(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button
                  onClick={generateNewKey}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                >
                  Generate New
                </button>
              </div>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={settingsLoading}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50"
            >
              {settingsLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
