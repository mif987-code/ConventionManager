import { useState, useEffect } from 'react';
import { RefreshCw, Users, Calendar, CreditCard, ShoppingBag, TrendingUp } from 'lucide-react';
import { stats } from '../api';

export default function StatsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await stats.get();
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-gray-500">Loading statistics...</div>;

  const cards = data ? [
    { label: 'Total Players', value: data.total_users ?? 0, icon: <Users size={24} />, color: 'bg-blue-500' },
    { label: 'Admins', value: data.total_admins ?? 0, icon: <Users size={24} />, color: 'bg-purple-500' },
    { label: 'Total Events', value: data.total_events ?? 0, icon: <Calendar size={24} />, color: 'bg-green-500' },
    { label: 'Active Events', value: data.active_events ?? 0, icon: <Calendar size={24} />, color: 'bg-yellow-500' },
    { label: 'Total Vouchers In', value: data.total_vouchers_in ?? 0, icon: <CreditCard size={24} />, color: 'bg-indigo-500' },
    { label: 'Total Vouchers Out', value: data.total_vouchers_out ?? 0, icon: <CreditCard size={24} />, color: 'bg-red-500' },
    { label: 'Total Tix Awarded', value: data.total_tix_in ?? 0, icon: <TrendingUp size={24} />, color: 'bg-emerald-500' },
    { label: 'Total Tix Spent', value: data.total_tix_out ?? 0, icon: <TrendingUp size={24} />, color: 'bg-orange-500' },
    { label: 'Store Items', value: data.store_items ?? 0, icon: <ShoppingBag size={24} />, color: 'bg-pink-500' },
    { label: 'Store Orders', value: data.store_orders ?? 0, icon: <ShoppingBag size={24} />, color: 'bg-teal-500' },
  ] : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Statistics</h1>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} text-white p-2.5 rounded-lg`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {data?.top_players && data.top_players.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Top Players by Match Wins</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase w-10">#</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Player</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Wins</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Losses</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.top_players.map((p: any, idx: number) => {
                  const total = (p.total_wins || 0) + (p.total_losses || 0);
                  const winRate = total > 0 ? Math.round(((p.total_wins || 0) / total) * 100) : 0;
                  return (
                    <tr key={p.user_id || idx} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-400">{idx + 1}</td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-800">{p.name || p.user_name}</td>
                      <td className="px-6 py-3 text-sm text-center text-green-600 font-semibold">{p.total_wins || 0}</td>
                      <td className="px-6 py-3 text-sm text-center text-red-600 font-semibold">{p.total_losses || 0}</td>
                      <td className="px-6 py-3 text-sm text-center text-gray-500">{winRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
