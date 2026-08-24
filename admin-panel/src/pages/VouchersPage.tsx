import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Search, X, Loader2, Wifi, Gift, Plus, Trash2, QrCode, ScanLine, DollarSign, ExternalLink } from 'lucide-react';
import { vouchers, tix, wallet, users, scan, specialVouchers, events, conventions } from '../api';

export default function VouchersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [voucherHistory, setVoucherHistory] = useState<any[]>([]);
  const [tixHistory, setTixHistory] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupMode, setTopupMode] = useState<'manual' | 'purchase'>('manual');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nfcListening, setNfcListening] = useState(false);
  const [nfcStatus, setNfcStatus] = useState('');
  const [scanMode, setScanMode] = useState<'nfc' | 'qr'>('nfc');
  const [qrInput, setQrInput] = useState('');
  const [activeTab, setActiveTab] = useState<'payments' | 'regular' | 'special'>('payments');
  const [searchParams, setSearchParams] = useSearchParams();
  const [specialVouchersList, setSpecialVouchersList] = useState<any[]>([]);
  const [openEvents, setOpenEvents] = useState<any[]>([]);
  const [showCreateVoucher, setShowCreateVoucher] = useState(false);
  const [newVoucher, setNewVoucher] = useState({ name: '', amount: 5, description: '', category: '', entry_cost: 0, max_awards: 1 });
  const [creatingVoucher, setCreatingVoucher] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<any | null>(null);
  const [savingVoucherEdit, setSavingVoucherEdit] = useState(false);
  const [selectedSpecialVoucher, setSelectedSpecialVoucher] = useState<number | null>(null);
  const [selectedAwardEventId, setSelectedAwardEventId] = useState<number | null>(null);
  const [awarding, setAwarding] = useState(false);
  const [userAwardedVouchers, setUserAwardedVouchers] = useState<any[]>([]);

  const EVENT_CATEGORIES = ['Draft', 'Sealed', 'Constructed', 'Commander'];
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
    setSelectedSpecialVoucher(null);
    try {
      const [balRes, tBalRes, creditRes, vhRes, thRes, payRes] = await Promise.all([
        vouchers.balance(u.id),
        tix.balance(u.id),
        wallet.balance(u.id),
        vouchers.history(u.id),
        tix.history(u.id),
        users.payments(u.id),
      ]);
      setUser({ ...u, voucher_balance: balRes.balance ?? 0, tix_balance: tBalRes.balance ?? 0, credit_balance: creditRes.balance ?? 0 });
      setVoucherHistory(vhRes.transactions || []);
      setTixHistory(thRes.transactions || []);
      setPaymentHistory(payRes.payments || []);
      loadUserAwardedVouchers(u.id);
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
        setNfcStatus(`Found: ${data.user.name}`);
        selectUser(data.user);
        setQrInput('');
      } else {
        setNfcStatus(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setNfcStatus(`QR error: ${err.message}`);
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

  async function handlePurchaseTopup(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !topupAmount) return;
    setError('');
    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('cm_api_key') || '',
          'x-convention-id': localStorage.getItem('cm_convention_id') || '',
        },
        body: JSON.stringify({ userId: user.id, amount: parseInt(topupAmount) }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`Payment created: ${data.paymentId}. Please complete payment.`);
        setTopupAmount('');
        // In real implementation, open paymentUrl
        console.log('Payment URL:', data.paymentUrl);
        console.log('Payment Link:', data.paymentLink);
      } else {
        setError('Payment creation failed');
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Load special vouchers and open events
  async function loadSpecialVouchers() {
    try {
      const conventionId = localStorage.getItem('cm_convention_id');
      if (!conventionId) return;

      const [svRes, eventsRes, convRes] = await Promise.all([
        specialVouchers.list(parseInt(conventionId)),
        events.list('open'),
        conventions.get(parseInt(conventionId)),
      ]);
      setSpecialVouchersList(svRes.special_vouchers || []);
      setOpenEvents(eventsRes.events || []);
      if (convRes.convention?.scan_mode) {
        setScanMode(convRes.convention.scan_mode);
      }
    } catch (err: any) {
      console.error('Failed to load special vouchers:', err);
    }
  }

  useEffect(() => { loadSpecialVouchers(); }, []);

  useEffect(() => {
    const userIdParam = searchParams.get('userId');
    const tabParam = searchParams.get('tab');
    if (userIdParam) {
      const userId = parseInt(userIdParam, 10);
      if (!isNaN(userId)) {
        users.get(userId).then((res) => {
          if (res.user) selectUser(res.user);
        }).catch((err: any) => setError(err.message));
      }
    }
    if (tabParam === 'payments' || tabParam === 'regular' || tabParam === 'special') {
      setActiveTab(tabParam);
    }
    setSearchParams({}, { replace: true });
  }, []);

  async function handleCreateSpecialVoucher(e: React.FormEvent) {
    e.preventDefault();
    if (!newVoucher.name || !newVoucher.category || newVoucher.amount <= 0) return;
    const conventionId = localStorage.getItem('cm_convention_id');
    if (!conventionId) return;
    setCreatingVoucher(true);
    setError('');
    try {
      await specialVouchers.create({
        convention_id: parseInt(conventionId),
        category: newVoucher.category,
        entry_cost: newVoucher.entry_cost,
        name: newVoucher.name,
        amount: newVoucher.amount,
        description: newVoucher.description,
        max_awards: newVoucher.max_awards,
      });
      setSuccess('Special voucher created successfully!');
      setNewVoucher({ name: '', amount: 5, description: '', category: '', entry_cost: 0, max_awards: 1 });
      setShowCreateVoucher(false);
      loadSpecialVouchers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingVoucher(false);
    }
  }

  async function handleUpdateSpecialVoucher(e: React.FormEvent) {
    e.preventDefault();
    if (!editingVoucher) return;
    setSavingVoucherEdit(true);
    setError('');
    try {
      await specialVouchers.update(editingVoucher.id, {
        name: editingVoucher.name,
        category: editingVoucher.category,
        entry_cost: editingVoucher.entry_cost,
        amount: editingVoucher.amount,
        description: editingVoucher.description,
        max_awards: editingVoucher.max_awards,
      });
      setSuccess('Special voucher updated successfully!');
      setEditingVoucher(null);
      loadSpecialVouchers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingVoucherEdit(false);
    }
  }

  async function handleDeleteSpecialVoucher(voucherId: number) {
    if (!confirm('Delete this special voucher?')) return;
    setError('');
    try {
      await specialVouchers.delete(voucherId);
      setSuccess('Special voucher deleted successfully!');
      loadSpecialVouchers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function loadUserAwardedVouchers(userId: number) {
    try {
      const res = await specialVouchers.getUserAwardsInConvention(userId);
      setUserAwardedVouchers(res.awards || []);
    } catch (err: any) {
      console.error('Failed to load user awarded vouchers:', err);
    }
  }

  // Open events matching the currently selected special voucher's category + entry cost
  const matchingEventsForSelectedVoucher = (() => {
    const voucher = specialVouchersList.find((v: any) => v.id === selectedSpecialVoucher);
    if (!voucher) return [];
    return openEvents.filter((e: any) => e.category === voucher.category && e.entry_cost_vouchers === voucher.entry_cost);
  })();

  async function handleAwardSpecialVoucher() {
    if (!user || !selectedSpecialVoucher || !selectedAwardEventId) return;
    setAwarding(true);
    setError('');
    try {
      const voucher = specialVouchersList.find((v: any) => v.id === selectedSpecialVoucher);
      if (!voucher) throw new Error('Voucher not found');

      await specialVouchers.award(selectedSpecialVoucher, {
        user_id: user.id,
        event_id: selectedAwardEventId,
        awarded_by: 'manual'
      });
      setSuccess(`Special voucher "${voucher.name}" awarded to ${user.name}!`);
      setSelectedSpecialVoucher(null);
      setSelectedAwardEventId(null);
      loadUserAwardedVouchers(user.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAwarding(false);
    }
  }

  async function handleRemoveSpecialVoucherAward(awardId: number) {
    if (!user) return;
    setError('');
    try {
      await specialVouchers.deleteAward(awardId);
      setSuccess('Special voucher award removed!');
      loadUserAwardedVouchers(user.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Vouchers & Tix</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'payments' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Payments
        </button>
        <button
          onClick={() => setActiveTab('regular')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'regular' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Regular Vouchers & Tix
        </button>
        <button
          onClick={() => setActiveTab('special')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'special' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Special Vouchers
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

      {activeTab === 'regular' && (
        <>
      {/* NFC Status */}
      {nfcStatus && (
        <div className={`text-sm px-3 py-2 rounded-lg mb-4 ${nfcStatus.startsWith('Error') || nfcStatus.startsWith('NFC error') || nfcStatus.startsWith('Web NFC')
          ? 'bg-red-50 text-red-700' : nfcStatus.startsWith('Found') ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
          {nfcStatus}
          <button onClick={() => setNfcStatus('')} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Search bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6 items-start">
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

        {/* Scan */}
        {scanMode === 'nfc' ? (
          nfcListening ? (
            <button onClick={() => { setNfcListening(false); setNfcStatus(''); }}
              className="flex items-center gap-2 bg-red-100 text-red-700 px-5 py-3 rounded-lg hover:bg-red-200 transition font-medium animate-pulse whitespace-nowrap">
              <Wifi size={18} /> Stop NFC
            </button>
          ) : (
            <button onClick={handleNfcScan}
              className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-5 py-3 rounded-lg hover:bg-emerald-200 transition font-medium whitespace-nowrap">
              <Wifi size={18} /> Scan NFC
            </button>
          )
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter QR code..."
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              className="px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-48"
              onKeyPress={(e) => e.key === 'Enter' && handleQrScan()}
            />
            <button onClick={handleQrScan}
              className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-5 py-3 rounded-lg hover:bg-emerald-200 transition font-medium whitespace-nowrap">
              <QrCode size={18} /> Scan QR
            </button>
          </div>
        )}
      </div>

      {user && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-800 mb-2">{user.name}</h2>
              <p className="text-sm text-gray-500 font-mono mb-4">{user.nfc_uid}</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-emerald-600 font-medium">Vouchers</p>
                  <p className="text-2xl font-bold text-emerald-700">{user.voucher_balance}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-purple-600 font-medium">Tix</p>
                  <p className="text-2xl font-bold text-purple-700">{user.tix_balance}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-blue-600 font-medium">Credit</p>
                  <p className="text-2xl font-bold text-blue-700">{user.credit_balance}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Top Up Vouchers</h3>
              
              {/* Mode Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setTopupMode('manual')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                    topupMode === 'manual'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Manual
                </button>
                <button
                  onClick={() => setTopupMode('purchase')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                    topupMode === 'purchase'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Purchase
                </button>
              </div>

              <form onSubmit={topupMode === 'manual' ? handleTopup : handlePurchaseTopup} className="space-y-3">
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
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition font-medium ${
                    topupMode === 'manual'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {topupMode === 'manual' ? (
                    <><CreditCard size={16} /> Add Vouchers</>
                  ) : (
                    <><DollarSign size={16} /> Purchase Vouchers</>
                  )}
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
                <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">By</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Event</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {voucherHistory.map((t: any) => (
                      <tr key={t.id}>
                        <td className={`px-4 py-2 text-sm font-medium ${t.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {t.amount > 0 ? '+' : ''}{t.amount}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 capitalize">{t.reason}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{t.created_by || '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{t.event_name || '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-400">{new Date(t.created_at).toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm">
                          {t.payment_link ? (
                            <a href={t.payment_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                              <ExternalLink size={12} /> View
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {voucherHistory.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No transactions</td></tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800">Tix History</h3>
              </div>
              <div className="max-h-64 overflow-auto">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[360px]">
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
        </div>
      )}
        </>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {!user ? (
            <p className="text-gray-500">Select a player above to view their payments.</p>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800">Payment History — {user.name}</h3>
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full min-w-[480px]">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Payment ID</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paymentHistory.map((p: any) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 text-sm font-mono text-gray-700 break-all max-w-[160px]">{p.id}</td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-800">${p.amount}</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.status === 'paid' ? 'bg-green-100 text-green-700' :
                            p.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">{new Date(p.created_at).toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm">
                          {p.payment_link ? (
                            <a href={p.payment_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                              <ExternalLink size={12} /> View
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {paymentHistory.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No payments found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Special Vouchers Tab */}
      {activeTab === 'special' && (
        <div className="space-y-6">
          {/* Award Special Voucher to User Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Award Special Voucher to User</h2>

            {/* Search bar */}
            <div className="flex gap-2 mb-4 items-start">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  placeholder="Search by player name or NFC UID..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="w-full pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-lg"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults([]); setSelectedSpecialVoucher(null); setUserAwardedVouchers([]); setUser(null); }}
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

              {/* Scan */}
              {scanMode === 'nfc' ? (
                nfcListening ? (
                  <button onClick={() => { setNfcListening(false); setNfcStatus(''); }}
                    className="flex items-center gap-2 bg-red-100 text-red-700 px-5 py-3 rounded-lg hover:bg-red-200 transition font-medium animate-pulse whitespace-nowrap">
                    <Wifi size={18} /> Stop
                  </button>
                ) : (
                  <button onClick={handleNfcScan}
                    className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-5 py-3 rounded-lg hover:bg-emerald-200 transition font-medium whitespace-nowrap">
                    <Wifi size={18} /> Scan NFC
                  </button>
                )
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter QR code..."
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    className="px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-48"
                    onKeyPress={(e) => e.key === 'Enter' && handleQrScan()}
                  />
                  <button onClick={handleQrScan}
                    className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-5 py-3 rounded-lg hover:bg-emerald-200 transition font-medium whitespace-nowrap">
                    <QrCode size={18} /> Scan QR
                  </button>
                </div>
              )}
            </div>

            {user && (
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Selected player:</p>
                    <p className="font-medium text-gray-800">{user.name}</p>
                  </div>
                  <button onClick={() => { setUser(null); setSearchQuery(''); setSelectedSpecialVoucher(null); setUserAwardedVouchers([]); }}
                    className="text-sm text-gray-500 hover:text-gray-700">Clear</button>
                </div>

                {/* Award form */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Special Voucher</label>
                    <select
                      value={selectedSpecialVoucher || ''}
                      onChange={(e) => {
                        setSelectedSpecialVoucher(e.target.value ? parseInt(e.target.value) : null);
                        setSelectedAwardEventId(null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">Choose a voucher...</option>
                      {specialVouchersList.map((v: any) => (
                        <option key={v.id} value={v.id}>{v.name} ({v.amount} vouchers) — {v.category}, {v.entry_cost} entry</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">For Event</label>
                    <select
                      value={selectedAwardEventId || ''}
                      onChange={(e) => setSelectedAwardEventId(e.target.value ? parseInt(e.target.value) : null)}
                      disabled={!selectedSpecialVoucher}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-50"
                    >
                      <option value="">
                        {selectedSpecialVoucher ? (matchingEventsForSelectedVoucher.length ? 'Choose a matching event...' : 'No matching open events') : 'Select a voucher first'}
                      </option>
                      {matchingEventsForSelectedVoucher.map((evt: any) => (
                        <option key={evt.id} value={evt.id}>{evt.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleAwardSpecialVoucher}
                    disabled={!selectedSpecialVoucher || !selectedAwardEventId || awarding}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50"
                  >
                    {awarding ? 'Awarding...' : 'Award'}
                  </button>
                </div>

                {/* User's awarded special vouchers */}
                {userAwardedVouchers.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">User's Special Vouchers</h3>
                    <div className="grid gap-2">
                      {userAwardedVouchers.map((v: any) => (
                        <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{v.voucher_name}</p>
                            <p className="text-xs text-gray-500">{v.amount} vouchers • {v.category}, {v.entry_cost} entry</p>
                          </div>
                          <button onClick={() => handleRemoveSpecialVoucherAward(v.id)}
                            className="text-red-500 hover:text-red-600 text-sm">
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manage Special Vouchers Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Manage Special Vouchers</h2>
              <button onClick={() => setShowCreateVoucher(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
                <Plus size={16} /> Create Special Voucher
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Special vouchers are event-specific prizes that can be awarded to players. They award regular vouchers when claimed.
            </p>

            {specialVouchersList.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Gift size={48} className="mx-auto mb-3 opacity-50" />
                <p>No special vouchers created yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {specialVouchersList.map((voucher: any) => (
                  <div key={voucher.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-indigo-100 text-indigo-600">
                        <Gift size={24} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{voucher.name}</h3>
                        <p className="text-sm text-indigo-600 mt-1">{voucher.category} events • {voucher.entry_cost} voucher{voucher.entry_cost !== 1 ? 's' : ''} entry</p>
                        {voucher.description && <p className="text-sm text-gray-500 mt-1">{voucher.description}</p>}
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-indigo-600 font-semibold">{voucher.amount} vouchers</span>
                          <span className="text-gray-500">{voucher.awarded_count}/{voucher.max_awards} awarded</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingVoucher(voucher)}
                        className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition text-sm font-medium">
                        Edit
                      </button>
                      <button onClick={() => handleDeleteSpecialVoucher(voucher.id)}
                        className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 transition text-sm font-medium">
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Special Voucher Modal */}
      {showCreateVoucher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Create Special Voucher</h3>
            <form onSubmit={handleCreateSpecialVoucher}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newVoucher.name}
                    onChange={(e) => setNewVoucher({ ...newVoucher, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g., First Place Bonus"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Category</label>
                  <select
                    value={newVoucher.category}
                    onChange={(e) => setNewVoucher({ ...newVoucher, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  >
                    <option value="">Select a category</option>
                    {EVENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entry Cost (vouchers)</label>
                  <input
                    type="number"
                    value={newVoucher.entry_cost}
                    onChange={(e) => setNewVoucher({ ...newVoucher, entry_cost: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    min="0"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Matches any event with this category and entry cost.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (vouchers)</label>
                  <input
                    type="number"
                    value={newVoucher.amount}
                    onChange={(e) => setNewVoucher({ ...newVoucher, amount: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <textarea
                    value={newVoucher.description}
                    onChange={(e) => setNewVoucher({ ...newVoucher, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    rows={2}
                    placeholder="e.g., Bonus for winning the first round"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Awards</label>
                  <input
                    type="number"
                    value={newVoucher.max_awards}
                    onChange={(e) => setNewVoucher({ ...newVoucher, max_awards: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    min="1"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowCreateVoucher(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={creatingVoucher}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50">
                  {creatingVoucher ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Special Voucher Modal */}
      {editingVoucher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Special Voucher</h3>
            <form onSubmit={handleUpdateSpecialVoucher}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingVoucher.name}
                    onChange={(e) => setEditingVoucher({ ...editingVoucher, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Category</label>
                  <select
                    value={editingVoucher.category}
                    onChange={(e) => setEditingVoucher({ ...editingVoucher, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  >
                    {EVENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entry Cost (vouchers)</label>
                  <input
                    type="number"
                    value={editingVoucher.entry_cost}
                    onChange={(e) => setEditingVoucher({ ...editingVoucher, entry_cost: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (vouchers)</label>
                  <input
                    type="number"
                    value={editingVoucher.amount}
                    onChange={(e) => setEditingVoucher({ ...editingVoucher, amount: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <textarea
                    value={editingVoucher.description || ''}
                    onChange={(e) => setEditingVoucher({ ...editingVoucher, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Awards</label>
                  <input
                    type="number"
                    value={editingVoucher.max_awards}
                    onChange={(e) => setEditingVoucher({ ...editingVoucher, max_awards: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    min="1"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setEditingVoucher(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={savingVoucherEdit}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50">
                  {savingVoucherEdit ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
