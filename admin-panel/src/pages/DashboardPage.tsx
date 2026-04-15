import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Calendar, CreditCard, ScanLine, Trash2, AlertTriangle, Lock, Download, Save, QrCode } from 'lucide-react';
import { users, events, conventions } from '../api';

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
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Scan Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateScanMode('nfc')}
                  disabled={updatingMode}
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
                  disabled={updatingMode}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                    scanMode === 'qr' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  <QrCode size={16} /> QR Code
                </button>
              </div>
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
      )}
    </div>
  );
}
