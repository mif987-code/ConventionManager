import { useState, useRef, useCallback, useEffect } from 'react';
import { UserPlus, Search, Link, X, Wifi, QrCode, X as CloseIcon, RefreshCw, Calendar, ScanLine, Copy, Package } from 'lucide-react';
import { users, conventions, scan, packages } from '../api';

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
  const [regeneratingQR, setRegeneratingQR] = useState(false);
  const [convention, setConvention] = useState<any>(null);
  const [selectedAttendanceDates, setSelectedAttendanceDates] = useState<string[]>([]);
  const [scanMode, setScanMode] = useState<'nfc' | 'qr'>('nfc');
  const [nfcListening, setNfcListening] = useState(false);
  const [nfcStatus, setNfcStatus] = useState('');
  const [qrInput, setQrInput] = useState('');
  const [copiedUserId, setCopiedUserId] = useState<number | null>(null);
  const [availablePackages, setAvailablePackages] = useState<any[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);

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

  async function loadConvention() {
    try {
      const conventionId = localStorage.getItem('cm_convention_id');
      if (conventionId) {
        const res = await conventions.get(parseInt(conventionId));
        setConvention(res.convention);
        if (res.convention?.scan_mode) {
          setScanMode(res.convention.scan_mode);
        }
        await loadPackages(parseInt(conventionId));
      }
    } catch (err: any) {
      console.error('Failed to load convention:', err);
    }
  }

  async function loadPackages(conventionId: number) {
    try {
      const res = await packages.list();
      const conventionPackages = (res.packages || []).filter((p: any) => p.convention_id === conventionId && p.is_active);
      setAvailablePackages(conventionPackages);
    } catch (err: any) {
      console.error('Failed to load packages:', err);
    }
  }

  async function handleNfcScan() {
    if (!('NDEFReader' in window)) {
      setNfcStatus('Web NFC not supported. Use Chrome on Android, or search by name above.');
      return;
    }
    setNfcListening(true);
    setNfcStatus('Waiting for NFC scan...');
    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      ndef.addEventListener('reading', async ({ serialNumber }: any) => {
        const uid = serialNumber.replace(/:/g, '').toUpperCase();
        setNfcStatus(`Scanned: ${uid} — searching...`);
        try {
          const res = await scan.lookup(uid);
          if (res.user) {
            setSearchQuery(res.user.name);
            loadUsers();
            setNfcStatus(`Found: ${res.user.name}`);
          }
        } catch (err: any) {
          setNfcStatus(`Error: ${err.message}`);
        }
      });
    } catch (err: any) {
      setNfcStatus(`NFC error: ${err.message}`);
      setNfcListening(false);
    }
  }

  async function handleQrScan() {
    if (!qrInput.trim()) return;
    setNfcStatus(`Scanning QR code...`);
    try {
      const res = await fetch('/api/scan/qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('cm_api_key') || '',
        },
        body: JSON.stringify({ qr_code: qrInput.trim() }),
      });
      const data = await res.json();
      if (data.found) {
        setSearchQuery(data.user.name);
        loadUsers();
        setNfcStatus(`Found: ${data.user.name}`);
        setQrInput('');
      } else {
        setNfcStatus(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setNfcStatus(`QR error: ${err.message}`);
    }
  }

  function getAvailableDates(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  useEffect(() => { loadUsers(); loadConvention(); }, []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    try {
      // For QR mode, NFC UID is optional - if not provided, a QR code will be generated
      const nfcUid = scanMode === 'qr' ? (form.nfc_uid || undefined) : form.nfc_uid;
      if (!nfcUid && scanMode === 'nfc') {
        setError('NFC UID is required when scan mode is NFC');
        return;
      }

      // Check if package requires payment
      const selectedPackage = availablePackages.find(p => p.id === selectedPackageId);
      const packageCost = selectedPackage ? (selectedPackage.prereg_cost || selectedPackage.cost) : 0;

      const res = await users.register(form.name, nfcUid || '', form.email || undefined, selectedAttendanceDates, selectedPackageId || undefined);
      const user = res.user;

      if (packageCost > 0) {
        // Create payment for package
        const paymentRes = await fetch('/api/payments/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': localStorage.getItem('cm_api_key') || '',
            'x-convention-id': localStorage.getItem('cm_convention_id') || '',
          },
          body: JSON.stringify({ userId: user.id, amount: packageCost }),
        });

        const paymentData = await paymentRes.json();
        if (paymentData.success) {
          setSuccess(`User created. Payment created: ${paymentData.paymentId}. Please complete payment at: ${paymentData.paymentUrl}`);
          // Open payment URL in new tab
          window.open(paymentData.paymentUrl, '_blank');
        } else {
          setError('User created but payment creation failed');
        }
      } else {
        setSuccess('User created successfully');
      }

      setForm({ name: '', nfc_uid: '', email: '' });
      setSelectedAttendanceDates([]);
      setSelectedPackageId(null);
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

  async function handleRegenerateQR(userId: number) {
    setRegeneratingQR(true);
    try {
      const res = await users.regenerateQR(userId);
      setShowingQrUser(res.user);
      setSuccess('QR code regenerated successfully!');
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegeneratingQR(false);
    }
  }

  async function handleActivate(userId: number) {
    try {
      await users.activate(userId);
      setSuccess('User activated successfully!');
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeactivate(userId: number) {
    try {
      await users.deactivate(userId);
      setSuccess('User deactivated.');
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCopyQRToken(userId: number) {
    try {
      const res = await users.getQRToken(userId);
      await navigator.clipboard.writeText(res.token);
      setCopiedUserId(userId);
      setSuccess('QR token copied to clipboard!');
      setTimeout(() => setCopiedUserId(null), 3000);
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
            {scanMode === 'nfc' ? (
              <input
                placeholder="NFC UID *"
                value={form.nfc_uid}
                onChange={(e) => setForm({ ...form, nfc_uid: e.target.value })}
                required
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            ) : (
              <input
                placeholder="NFC UID (optional)"
                value={form.nfc_uid}
                onChange={(e) => setForm({ ...form, nfc_uid: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            )}
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
          
          {convention && convention.start_date && convention.end_date && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} /> Attendance Dates
              </label>
              <p className="text-xs text-gray-500 mb-2">Convention: {new Date(convention.start_date).toLocaleDateString()} - {new Date(convention.end_date).toLocaleDateString()}</p>
              <div className="flex flex-wrap gap-2">
                {getAvailableDates(convention.start_date, convention.end_date).map((date: string) => {
                  const isSelected = selectedAttendanceDates.includes(date);
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedAttendanceDates(selectedAttendanceDates.filter(d => d !== date));
                        } else {
                          setSelectedAttendanceDates([...selectedAttendanceDates, date]);
                        }
                      }}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {availablePackages.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Package size={16} /> Package (Optional)
              </label>
              <select
                value={selectedPackageId || ''}
                onChange={(e) => setSelectedPackageId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">No package</option>
                {availablePackages.map((pkg: any) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} - ${pkg.prereg_cost || pkg.cost} ({pkg.days} day{pkg.days !== 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {nfcStatus && (
        <div className={`text-sm px-3 py-2 rounded-lg mb-4 ${nfcStatus.startsWith('Error') || nfcStatus.startsWith('NFC error') || nfcStatus.startsWith('Web NFC')
          ? 'bg-red-50 text-red-700' : nfcStatus.startsWith('Found') ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
          {nfcStatus}
          <button onClick={() => setNfcStatus('')} className="ml-2 font-bold">×</button>
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
        {scanMode === 'nfc' ? (
          nfcListening ? (
            <button type="button" onClick={() => { setNfcListening(false); setNfcStatus(''); }}
              className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition font-medium animate-pulse whitespace-nowrap">
              <Wifi size={16} /> Stop
            </button>
          ) : (
            <button type="button" onClick={handleNfcScan}
              className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-200 transition font-medium whitespace-nowrap">
              <Wifi size={16} /> Scan NFC
            </button>
          )
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter QR code..."
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-48"
              onKeyPress={(e) => e.key === 'Enter' && handleQrScan()}
            />
            <button type="button" onClick={handleQrScan}
              className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-200 transition font-medium whitespace-nowrap">
              <QrCode size={16} /> Scan QR
            </button>
          </div>
        )}
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
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">{scanMode === 'qr' ? 'QR Code' : 'NFC UID'}</th>
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
                    {scanMode === 'qr' ? (
                      u.qr_code ? (
                        <span className="text-gray-600">{u.qr_code.substring(0, 12)}...</span>
                      ) : (
                        <span className="text-orange-400 italic text-xs">No QR</span>
                      )
                    ) : (
                      u.nfc_uid ? (
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
                      )
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{u.email || '—'}</td>
                  <td className="px-6 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {u.is_admin && (
                        <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">Admin</span>
                      )}
                      {u.is_preregistered && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">Pre-reg</span>
                      )}
                      {u.is_active ? (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">Active</span>
                      ) : (
                        <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">Inactive</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {u.qr_code ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setShowingQrUser(u)}
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                          <QrCode size={12} /> View
                        </button>
                        <button onClick={() => handleCopyQRToken(u.id)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium">
                          <Copy size={12} /> {copiedUserId === u.id ? 'Copied!' : 'Copy Token'}
                        </button>
                        <button onClick={() => handleRegenerateQR(u.id)} disabled={regeneratingQR}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium disabled:opacity-50">
                          <RefreshCw size={12} /> Regenerate
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      {scanMode === 'qr' ? (
                        !u.qr_code && (
                          <button onClick={() => handleRegenerateQR(u.id)} disabled={regeneratingQR}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50">
                            <QrCode size={12} /> Generate QR
                          </button>
                        )
                      ) : (
                        !u.nfc_uid && linkingUserId !== u.id && (
                          <button onClick={() => { setLinkingUserId(u.id); setLinkNfcUid(''); }}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                            <Link size={12} /> Link NFC
                          </button>
                        )
                      )}
                      {u.is_active ? (
                        <button onClick={() => handleDeactivate(u.id)}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium">
                          <X size={12} /> Deactivate
                        </button>
                      ) : (
                        <button onClick={() => handleActivate(u.id)}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
                          <ScanLine size={12} /> Activate
                        </button>
                      )}
                    </div>
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
                <>
                  <img src={showingQrUser.qr_code} alt="QR Code" className="mx-auto w-48 h-48" />
                  <a href={showingQrUser.qr_code} target="_blank" rel="noopener noreferrer"
                    className="block mt-2 text-xs text-indigo-600 hover:text-indigo-700 underline">
                    Open QR Code in new tab
                  </a>
                </>
              )}
              <p className="text-xs text-gray-400 mt-4">Scan this code to register to events, load Tix, etc.</p>
              <button
                onClick={() => handleRegenerateQR(showingQrUser.id)}
                disabled={regeneratingQR}
                className="mt-4 flex items-center justify-center gap-2 w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50"
              >
                {regeneratingQR ? <><RefreshCw size={16} className="animate-spin" /> Regenerating...</> : <><RefreshCw size={16} /> Regenerate QR Code</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
