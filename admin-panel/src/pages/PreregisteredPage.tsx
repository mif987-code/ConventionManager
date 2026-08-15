import { useState, useEffect } from 'react';
import { RefreshCw, UserCheck, Calendar, Package, Search } from 'lucide-react';
import { preregistrations } from '../api';

export default function PreregisteredPage() {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes] = await Promise.all([
        preregistrations.stats(),
        preregistrations.list(),
      ]);
      setStats(statsRes.stats);
      setUsers(usersRes.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  if (loading) return <div className="text-gray-500">Loading pre-registration data...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Preregistered</h1>
        <button onClick={load}
          className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-indigo-100 flex items-center justify-center">
            <UserCheck size={20} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Preregistered</p>
            <p className="text-2xl font-bold text-gray-800">{stats?.total_preregistered ?? 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-green-100 flex items-center justify-center">
            <UserCheck size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Already Activated</p>
            <p className="text-2xl font-bold text-gray-800">{stats?.activated ?? 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-amber-100 flex items-center justify-center">
            <Package size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Package Types Sold</p>
            <p className="text-2xl font-bold text-gray-800">{(stats?.packages || []).filter((p: any) => p.total_quantity > 0).length}</p>
          </div>
        </div>
      </div>

      {/* Per-event breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Calendar size={18} className="text-indigo-600" />
          <h2 className="font-semibold text-gray-800">Preregistrations per Event</h2>
        </div>
        <div className="p-6">
          {(!stats?.events || stats.events.length === 0) ? (
            <p className="text-sm text-gray-400">No events found for this convention.</p>
          ) : (
            <div className="space-y-3">
              {stats.events.map((ev: any) => (
                <div key={ev.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 text-sm">{ev.name}</span>
                    {!ev.preregistration_enabled && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Prereg off</span>
                    )}
                    {ev.schedule_day && (
                      <span className="text-xs text-gray-400">
                        {ev.schedule_day}{ev.start_time ? ` · ${ev.start_time.slice(0, 5)}` : ''}{ev.track ? ` · ${ev.track}` : ''}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-indigo-600">{ev.preregistered_count} preregistered</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Per-package breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Package size={18} className="text-amber-600" />
          <h2 className="font-semibold text-gray-800">Packages Selected</h2>
        </div>
        <div className="p-6">
          {(!stats?.packages || stats.packages.length === 0) ? (
            <p className="text-sm text-gray-400">No packages configured for this convention.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.packages.map((p: any) => (
                <div key={p.id} className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-800 text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{p.user_count} player(s) &middot; {p.total_quantity} total unit(s)</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preregistered users table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Preregistered Players ({filteredUsers.length})</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email..."
              className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Packages</th>
                <th className="px-6 py-3 font-medium">Events</th>
                <th className="px-6 py-3 font-medium">Registered</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No preregistered players found.</td></tr>
              ) : filteredUsers.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-800">{u.name} {u.last_name}</td>
                  <td className="px-6 py-3 text-gray-600">{u.email}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {u.is_active ? 'Activated' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {u.packages.length === 0 ? '—' : u.packages.map((p: any) => `${p.name}${p.quantity > 1 ? ` x${p.quantity}` : ''}`).join(', ')}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {u.preregistered_events.length === 0 ? '—' : u.preregistered_events.map((e: any) => e.name).join(', ')}
                  </td>
                  <td className="px-6 py-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
