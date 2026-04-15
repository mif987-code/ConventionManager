import { useState, useEffect } from 'react';
import { RefreshCw, Users, Calendar, CreditCard, ShoppingBag, TrendingUp, DollarSign, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { stats } from '../api';

export default function StatsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['players', 'events', 'tix', 'store', 'vouchers']));

  async function load() {
    setLoading(true);
    try {
      const res = await stats.get();
      setData(res.stats || res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  if (loading) return <div className="text-gray-500">Loading statistics...</div>;

  const statsData = data?.stats || data;

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

      {/* Players Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
        <button 
          onClick={() => toggleSection('players')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <Users size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Players</h2>
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
              {statsData?.players?.total || 0}
            </span>
          </div>
          {expandedSections.has('players') ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>
        {expandedSections.has('players') && (
          <div className="px-6 pb-6 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Total Registered</p>
                <p className="text-3xl font-bold text-blue-700">{statsData?.players?.total || 0}</p>
              </div>
            </div>
            {statsData?.players?.names && statsData.players.names.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Player Names</h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {statsData.players.names.map((player: any) => (
                      <div key={player.id} className="text-sm text-gray-700">
                        {player.name} {player.email && <span className="text-gray-400 text-xs ml-1">({player.email})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Events Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
        <button 
          onClick={() => toggleSection('events')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <Calendar size={20} className="text-green-600" />
            <h2 className="text-lg font-semibold text-gray-800">Events</h2>
            <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">
              {statsData?.events?.total || 0}
            </span>
          </div>
          {expandedSections.has('events') ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>
        {expandedSections.has('events') && (
          <div className="px-6 pb-6 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Total Events</p>
                <p className="text-3xl font-bold text-green-700">{statsData?.events?.total || 0}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <p className="text-sm text-yellow-600 font-medium">Open</p>
                <p className="text-3xl font-bold text-yellow-700">{statsData?.events?.open || 0}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-purple-600 font-medium">Finished</p>
                <p className="text-3xl font-bold text-purple-700">{statsData?.events?.finished || 0}</p>
              </div>
            </div>
            
            {statsData?.events?.type_breakdown && statsData.events.type_breakdown.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Event Type Breakdown</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase">
                        <th className="pb-2">Category</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {statsData.events.type_breakdown.map((type: any, idx: number) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="py-2">{type.category}</td>
                          <td className="py-2">{type.type_name}</td>
                          <td className="py-2 text-right font-medium">{type.event_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {statsData?.events?.players_per_event && statsData.events.players_per_event.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Players Per Event</h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase">
                        <th className="pb-2">Event</th>
                        <th className="pb-2 text-right">Players</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {statsData.events.players_per_event.map((event: any, idx: number) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="py-2">{event.name}</td>
                          <td className="py-2 text-right font-medium">{event.player_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tix Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
        <button 
          onClick={() => toggleSection('tix')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <TrendingUp size={20} className="text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-800">Tix</h2>
          </div>
          {expandedSections.has('tix') ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>
        {expandedSections.has('tix') && (
          <div className="px-6 pb-6 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-emerald-50 rounded-lg p-4">
                <p className="text-sm text-emerald-600 font-medium">Total Awarded</p>
                <p className="text-3xl font-bold text-emerald-700">{statsData?.tix?.awarded || 0}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-orange-600 font-medium">Total Used</p>
                <p className="text-3xl font-bold text-orange-700">{statsData?.tix?.used || 0}</p>
              </div>
            </div>
            
            {statsData?.tix?.usage_by_product && statsData.tix.usage_by_product.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Tix Usage by Product</h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase">
                        <th className="pb-2">Product</th>
                        <th className="pb-2 text-right">Orders</th>
                        <th className="pb-2 text-right">Tix Spent</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {statsData.tix.usage_by_product.map((product: any, idx: number) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="py-2">{product.product_name}</td>
                          <td className="py-2 text-right">{product.order_count}</td>
                          <td className="py-2 text-right font-medium">{product.total_tix_spent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Store Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
        <button 
          onClick={() => toggleSection('store')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <ShoppingBag size={20} className="text-pink-600" />
            <h2 className="text-lg font-semibold text-gray-800">Store</h2>
          </div>
          {expandedSections.has('store') ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>
        {expandedSections.has('store') && (
          <div className="px-6 pb-6 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-pink-50 rounded-lg p-4">
                <p className="text-sm text-pink-600 font-medium">Tix Purchases</p>
                <p className="text-3xl font-bold text-pink-700">{statsData?.store?.tix_purchases?.count || 0}</p>
                <p className="text-xs text-pink-600 mt-1">Total: {statsData?.store?.tix_purchases?.total_tix || 0} Tix</p>
              </div>
              <div className="bg-teal-50 rounded-lg p-4">
                <p className="text-sm text-teal-600 font-medium">Currency Purchases</p>
                <p className="text-3xl font-bold text-teal-700">{statsData?.store?.currency_purchases?.count || 0}</p>
                <p className="text-xs text-teal-600 mt-1">Total: ${statsData?.store?.currency_purchases?.total_currency || 0}</p>
              </div>
            </div>
            
            {statsData?.store?.real_currency_sales && statsData.store.real_currency_sales.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Real Currency Sales</h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase">
                        <th className="pb-2">Product</th>
                        <th className="pb-2 text-right">Orders</th>
                        <th className="pb-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {statsData.store.real_currency_sales.map((sale: any, idx: number) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="py-2">{sale.product_name}</td>
                          <td className="py-2 text-right">{sale.order_count}</td>
                          <td className="py-2 text-right font-medium">${sale.total_revenue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Vouchers Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
        <button 
          onClick={() => toggleSection('vouchers')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-800">Vouchers</h2>
          </div>
          {expandedSections.has('vouchers') ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>
        {expandedSections.has('vouchers') && (
          <div className="px-6 pb-6 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-indigo-50 rounded-lg p-4">
                <p className="text-sm text-indigo-600 font-medium">Sold</p>
                <p className="text-3xl font-bold text-indigo-700">{statsData?.vouchers?.sold || 0}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-600 font-medium">Used</p>
                <p className="text-3xl font-bold text-red-700">{statsData?.vouchers?.used || 0}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Unused</p>
                <p className="text-3xl font-bold text-green-700">{statsData?.vouchers?.unused || 0}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
