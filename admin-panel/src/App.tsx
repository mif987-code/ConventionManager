import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Users, Calendar, CreditCard, ScanLine, Trophy, Settings as SettingsIcon, Ticket, ShoppingBag, BarChart3, Shield, LogOut, Map } from 'lucide-react';
import { getApiKey, setApiKey } from './api';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import VouchersPage from './pages/VouchersPage';
import ScanPage from './pages/ScanPage';
import EventTypesPage from './pages/EventTypesPage';
import PrizeTemplatesPage from './pages/PrizeTemplatesPage';
import StorePage from './pages/StorePage';
import StatsPage from './pages/StatsPage';
import PermissionsPage from './pages/PermissionsPage';
import ConventionSelectPage from './pages/ConventionSelectPage';
import SettingsPage from './pages/SettingsPage';
import PackagesPage from './pages/PackagesPage';
import FloorPlanPage from './pages/FloorPlanPage';

function App() {
  const location = useLocation();
  const [authenticated, setAuthenticated] = useState(!!getApiKey());
  const [keyInput, setKeyInput] = useState('');
  const [conventionId, setConventionId] = useState<string | null>(localStorage.getItem('cm_convention_id'));
  const [conventionName, setConventionName] = useState<string | null>(localStorage.getItem('cm_convention_name'));

  useEffect(() => {
    setAuthenticated(!!getApiKey());
  }, []);

  // Reload convention from localStorage when route changes (after creating/selecting convention)
  useEffect(() => {
    const storedId = localStorage.getItem('cm_convention_id');
    const storedName = localStorage.getItem('cm_convention_name');
    setConventionId(storedId);
    setConventionName(storedName);
  }, [location.pathname]);

  function switchConvention() {
    setConventionId(null);
    setConventionName(null);
    localStorage.removeItem('cm_convention_id');
    localStorage.removeItem('cm_convention_name');
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🎮</div>
            <h1 className="text-2xl font-bold text-gray-800">Convention Manager</h1>
            <p className="text-gray-500 mt-1">Enter your API key to continue</p>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (keyInput.trim()) {
              setApiKey(keyInput.trim());
              setAuthenticated(true);
            }
          }}>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="API Key"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
            <button
              type="submit"
              className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              Connect
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!conventionId) {
    return <ConventionSelectPage />;
  }

  const navItems = [
    { to: '/', icon: <SettingsIcon size={20} />, label: 'Dashboard' },
    { to: '/users', icon: <Users size={20} />, label: 'Users' },
    { to: '/events', icon: <Calendar size={20} />, label: 'Events' },
    { to: '/event-types', icon: <Trophy size={20} />, label: 'Event Types' },
    { to: '/prize-templates', icon: <Ticket size={20} />, label: 'Prize Templates' },
    { to: '/vouchers', icon: <CreditCard size={20} />, label: 'Vouchers and Tix' },
    { to: '/packages', icon: <Ticket size={20} />, label: 'Packages' },
    { to: '/store', icon: <ShoppingBag size={20} />, label: 'Store' },
    { to: '/scan', icon: <ScanLine size={20} />, label: 'NFC Scan' },
    { to: '/stats', icon: <BarChart3 size={20} />, label: 'Statistics' },
    { to: '/permissions', icon: <Shield size={20} />, label: 'Permissions' },
    { to: '/settings', icon: <SettingsIcon size={20} />, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎮</span>
            <div>
              <h1 className="font-bold text-gray-800">Convention</h1>
              <p className="text-xs text-gray-500">{conventionName || 'Unknown'}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100 space-y-2">
          <button
            onClick={switchConvention}
            className="w-full text-sm text-gray-500 hover:text-indigo-600 transition py-2 flex items-center justify-center gap-2"
          >
            <LogOut size={14} /> Switch Convention
          </button>
          <button
            onClick={() => { setApiKey(''); setAuthenticated(false); }}
            className="w-full text-sm text-gray-500 hover:text-red-600 transition py-2"
          >
            Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/event-types" element={<EventTypesPage />} />
            <Route path="/prize-templates" element={<PrizeTemplatesPage />} />
            <Route path="/vouchers" element={<VouchersPage />} />
            <Route path="/packages" element={<PackagesPage />} />
            <Route path="/store" element={<StorePage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/permissions" element={<PermissionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/floor-plan" element={<FloorPlanPage />} />
        </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
