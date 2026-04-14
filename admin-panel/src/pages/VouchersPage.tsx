import { useState, useRef, useCallback } from 'react';
import { CreditCard, Search, X, Loader2, Wifi } from 'lucide-react';
import { vouchers, tix, users, scan } from '../api';

export default function VouchersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [voucherHistory, setVoucherHistory] = useState<any[]>([]);
  const [tixHistory, setTixHistory] = useState<any[]>([]);
  const [topupAmount, setTopupAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nfcListening, setNfcListening] = useState(false);
  const [nfcStatus, setNfcStatus] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (query: string) => {
    if (query.trim().length < 1) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await users.search(query.trim());
      setSearchResults(res.users || []);
    } catch (err: any) { setError(err.message); }
    finally { setSearching(false); }
  }, []);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  async function selectUser(u: any) {
    setSearchResults([]);
    setSearchQuery('');
    setError('');
    setSuccess('');
    try {
      const [balRes, tBalRes, vhRes, thRes] = await Promise.all([
        vouchers.balance(u.id),
        tix.balance(u.id),
        vouchers.history(u.id),
        tix.history(u.id),
      ]);
      setUser({ ...u, voucher_balance: balRes.balance ?? 0, tix_balance: tBalRes.balance ?? 0 });
      setVoucherHistory(vhRes.transactions || []);
      setTixHistory(thRes.transactions || []);
    } catch (err: any) { setError(err.message); }
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
        setNfcStatus(`Scanned: ${uid} — looking up...`);
        try {
          const res = await scan.lookup(uid);
          if (res.user) {
            selectUser(res.user);
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

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !topupAmount) return;
    setError('');
    try {
      const res = await vouchers.topup(user.id, parseInt(topupAmount));
      setSuccess(`Added ${topupAmount} vouchers. New balance: ${res.new_balance}`);
      setTopupAmount('');
      setUser({ ...user, voucher_balance: res.new_balance });
      const vhRes = await vouchers.history(user.id);
      setVoucherHistory(vhRes.transactions || []);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Vouchers & Tix</h1>

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

      {/* NFC Status */}
      {nfcStatus && (
        <div className={`text-sm px-3 py-2 rounded-lg mb-4 ${nfcStatus.startsWith('Error') || nfcStatus.startsWith('NFC error') || nfcStatus.startsWith('Web NFC')
          ? 'bg-red-50 text-red-700' : nfcStatus.startsWith('Found') ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
          {nfcStatus}
          <button onClick={() => setNfcStatus('')} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Search bar */}
      <div className="flex gap-2 mb-6 items-start">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-3.5 text-gray-400" />
          <input
            placeholder="Search by player name or NFC UID..."
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-lg"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
          {searching && <Loader2 size={18} className="absolute right-10 top-3.5 text-indigo-500 animate-spin" />}

          {/* Autocomplete dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {searchResults.map((u: any) => (
                <button key={u.id} onClick={() => selectUser(u)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition text-left border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">{u.name}</span>
                    <span className="text-gray-400 text-sm ml-2 font-mono">{u.nfc_uid}</span>
                    {u.email && <span className="text-gray-400 text-sm ml-2">{u.email}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
          {searchQuery.length >= 1 && !searching && searchResults.length === 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3">
              <p className="text-sm text-gray-400 italic">No players found.</p>
            </div>
          )}
        </div>

        {/* NFC Scan */}
        {nfcListening ? (
          <button onClick={() => { setNfcListening(false); setNfcStatus(''); }}
            className="flex items-center gap-2 bg-red-100 text-red-700 px-5 py-3 rounded-lg hover:bg-red-200 transition font-medium animate-pulse whitespace-nowrap">
            <Wifi size={18} /> Stop NFC
          </button>
        ) : (
          <button onClick={handleNfcScan}
            className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-5 py-3 rounded-lg hover:bg-emerald-200 transition font-medium whitespace-nowrap">
            <Wifi size={18} /> Scan NFC
          </button>
        )}
      </div>

      {user && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-800 mb-2">{user.name}</h2>
              <p className="text-sm text-gray-500 font-mono mb-4">{user.nfc_uid}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-emerald-600 font-medium">Vouchers</p>
                  <p className="text-2xl font-bold text-emerald-700">{user.voucher_balance}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-purple-600 font-medium">Tix</p>
                  <p className="text-2xl font-bold text-purple-700">{user.tix_balance}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Top Up Vouchers</h3>
              <form onSubmit={handleTopup} className="space-y-3">
                <input
                  type="number"
                  min="1"
                  placeholder="Amount"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <div className="flex gap-2">
                  {[10, 25, 50, 100].map((amt) => (
                    <button key={amt} type="button" onClick={() => setTopupAmount(String(amt))}
                      className="flex-1 bg-gray-100 text-gray-700 py-1.5 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
                      +{amt}
                    </button>
                  ))}
                </div>
                <button type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 transition font-medium">
                  <CreditCard size={16} /> Add Vouchers
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800">Voucher History</h3>
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Reason</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Event</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {voucherHistory.map((t: any) => (
                      <tr key={t.id}>
                        <td className={`px-4 py-2 text-sm font-medium ${t.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {t.amount > 0 ? '+' : ''}{t.amount}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{t.reason}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{t.event_name || '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-400">{new Date(t.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {voucherHistory.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No transactions</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800">Tix History</h3>
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Reason</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Event</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tixHistory.map((t: any) => (
                      <tr key={t.id}>
                        <td className={`px-4 py-2 text-sm font-medium ${t.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {t.amount > 0 ? '+' : ''}{t.amount}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{t.reason}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{t.event_name || '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-400">{new Date(t.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {tixHistory.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No transactions</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
