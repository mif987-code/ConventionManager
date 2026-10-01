import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Users, Calendar, CreditCard, ScanLine, Trophy, Settings as SettingsIcon, Ticket, ShoppingBag, BarChart3, Shield, LogOut, Map, Menu, X as XIcon, WifiOff, Star, CalendarClock, UserCheck } from 'lucide-react';
import { getApiKey, setApiKey, getAdminToken, setAdminToken, getAdminPermissions, setAdminPermissions, auth } from './api';
import { useNetworkStatus } from './hooks/useNetworkStatus';
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
import ConventionSelectPage from './pages/ConventionSelectPage';
import PackagesPage from './pages/PackagesPage';
import FloorPlanPage from './pages/FloorPlanPage';
import CollectionPage from './pages/CollectionPage';
import SchedulePage from './pages/SchedulePage';
import PreregisteredPage from './pages/PreregisteredPage';
import PermissionsPage from './pages/PermissionsPage';

function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/player/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Password created</h2>
          <p className="text-gray-600 mb-4">Your admin password has been set. You can now sign in.</p>
          <a href="/admin/" className="text-indigo-600 font-medium hover:underline">Go to admin login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Create admin password</h2>
        <p className="text-sm text-gray-500 mb-4">Set a secure password for your admin account.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Set password'}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const location = useLocation();
  const resetToken = new URLSearchParams(location.search).get('reset');
  if (resetToken) {
    return <ResetPasswordForm token={resetToken} />;
  }

  const [authenticated, setAuthenticated] = useState(!!(getApiKey() || getAdminToken()));
  const [keyInput, setKeyInput] = useState('');
  const [loginMode, setLoginMode] = useState<'api' | 'email'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [permissions, setPermissions] = useState<string[]>(getAdminPermissions());
  const [conventionId, setConventionId] = useState<string | null>(localStorage.getItem('cm_convention_id'));
  const [conventionName, setConventionName] = useState<string | null>(localStorage.getItem('cm_convention_name'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isOnline, queuedCount } = useNetworkStatus();

  useEffect(() => {
    setAuthenticated(!!(getApiKey() || getAdminToken()));
    setPermissions(getAdminPermissions());
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
            <p className="text-gray-500 mt-1">Admin access</p>
          </div>

          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => setLoginMode('email')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${loginMode === 'email' ? 'bg-white text-indigo-700 shadow' : 'text-gray-600'}`}
            >
              Admin email
            </button>
            <button
              type="button"
              onClick={() => setLoginMode('api')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${loginMode === 'api' ? 'bg-white text-indigo-700 shadow' : 'text-gray-600'}`}
            >
              API key
            </button>
          </div>

          {loginMode === 'api' ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (keyInput.trim()) {
                setAdminToken('');
                setApiKey(keyInput.trim());
                setAdminPermissions(['super']);
                setPermissions(['super']);
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
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoginError('');
              if (!email.trim() || !password) return;
              setLoginLoading(true);
              try {
                const res = await auth.login(email.trim(), password);
                setApiKey('');
                setAdminToken(res.token);
                setAdminPermissions(res.admin.permissions || []);
                setPermissions(res.admin.permissions || []);
                setAuthenticated(true);
              } catch (err: any) {
                setLoginError(err.message || 'Login failed');
              } finally {
                setLoginLoading(false);
              }
            }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Admin email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none mb-3"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
              {loginError && <p className="text-red-600 text-sm mt-2">{loginError}</p>}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-60"
              >
                {loginLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (!conventionId) {
    return <ConventionSelectPage />;
  }

  const can = (perm: string | null) => !perm || permissions.includes('super') || permissions.includes(perm);

  const navItems = [
    { to: '/', icon: <SettingsIcon size={20} />, label: 'Dashboard', perm: null },
    { to: '/users', icon: <Users size={20} />, label: 'Users', perm: 'users' },
    { to: '/events', icon: <Calendar size={20} />, label: 'Events', perm: 'events' },
    { to: '/schedule', icon: <CalendarClock size={20} />, label: 'Schedule', perm: 'events' },
    { to: '/preregistered', icon: <UserCheck size={20} />, label: 'Preregistered', perm: 'events' },
    { to: '/floor-plan', icon: <Map size={20} />, label: 'Floor Plan', perm: 'super' },
    { to: '/event-types', icon: <Trophy size={20} />, label: 'Event Types', perm: 'super' },
    { to: '/prize-templates', icon: <Ticket size={20} />, label: 'Prize Templates', perm: 'super' },
    { to: '/vouchers', icon: <CreditCard size={20} />, label: 'Transactions (Coupons & Tix)', perm: 'vouchers' },
    { to: '/store', icon: <ShoppingBag size={20} />, label: 'Store', perm: 'store' },
    { to: '/packages', icon: <Ticket size={20} />, label: 'Packages', perm: 'super' },
    { to: '/scan', icon: <ScanLine size={20} />, label: 'NFC Scan', perm: 'register' },
    { to: '/stats', icon: <BarChart3 size={20} />, label: 'Statistics', perm: 'stats' },
    { to: '/collection', icon: <Star size={20} />, label: 'Collection', perm: 'super' },
    { to: '/permissions', icon: <Shield size={20} />, label: 'Permissions', perm: 'super' },
  ].filter(item => can(item.perm));

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎮</span>
          <div>
            <h1 className="font-bold text-gray-800">Convention</h1>
            <p className="text-xs text-gray-500">{conventionName || 'Unknown'}</p>
          </div>
        </div>
        <button className="md:hidden text-gray-400 hover:text-gray-600" onClick={() => setSidebarOpen(false)}>
          <XIcon size={20} />
        </button>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setSidebarOpen(false)}
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
          onClick={() => { setApiKey(''); setAdminToken(''); setAdminPermissions([]); setPermissions([]); setAuthenticated(false); }}
          className="w-full text-sm text-gray-500 hover:text-red-600 transition py-2"
        >
          Disconnect
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {!isOnline && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-gray-900 text-white text-xs font-medium px-3 py-2 rounded-full shadow-lg">
          <WifiOff size={14} />
          {queuedCount > 0 ? `Offline — ${queuedCount} queued` : 'Offline'}
        </div>
      )}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — hidden on mobile unless open */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 md:static md:translate-x-0 md:flex md:z-auto ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 hover:text-indigo-600">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-gray-800 text-sm">{conventionName || 'Convention Manager'}</span>
        </div>
        <div className="p-4 md:p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/preregistered" element={<PreregisteredPage />} />
            <Route path="/floor-plan" element={<FloorPlanPage />} />
            <Route path="/event-types" element={<EventTypesPage />} />
            <Route path="/prize-templates" element={<PrizeTemplatesPage />} />
            <Route path="/vouchers" element={<VouchersPage />} />
            <Route path="/store" element={<StorePage />} />
            <Route path="/packages" element={<PackagesPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/collection" element={<CollectionPage />} />
            <Route path="/permissions" element={<PermissionsPage />} />
        </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
