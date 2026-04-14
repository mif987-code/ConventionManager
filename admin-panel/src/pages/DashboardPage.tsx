import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Calendar, CreditCard, ScanLine } from 'lucide-react';
import { users, events } from '../api';

export default function DashboardPage() {
  const [stats, setStats] = useState({ userCount: 0, openEvents: 0, totalEvents: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [usersRes, eventsRes] = await Promise.all([
          users.list(),
          events.list(),
        ]);
        setStats({
          userCount: usersRes.users?.length || 0,
          openEvents: eventsRes.events?.filter((e: any) => e.status === 'open').length || 0,
          totalEvents: eventsRes.events?.length || 0,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cards = [
    { label: 'Total Users', value: stats.userCount, icon: <Users size={24} />, color: 'bg-blue-500', to: '/users' },
    { label: 'Open Events', value: stats.openEvents, icon: <Calendar size={24} />, color: 'bg-green-500', to: '/events' },
    { label: 'Total Events', value: stats.totalEvents, icon: <Calendar size={24} />, color: 'bg-purple-500', to: '/events' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading ? (
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
                <ScanLine size={32} />
                <div>
                  <h3 className="text-lg font-semibold">NFC Scanner</h3>
                  <p className="text-indigo-100 text-sm">Scan a tag to look up a player</p>
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
        </>
      )}
    </div>
  );
}
