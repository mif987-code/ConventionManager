import { useState } from 'react';
import { ScanLine, QrCode } from 'lucide-react';
import { scan } from '../api';

export default function ScanPage() {
  const [scanMode, setScanMode] = useState<'nfc' | 'qr'>('qr');
  const [inputValue, setInputValue] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      if (scanMode === 'nfc') {
        const res = await scan.lookup(inputValue);
        setResult(res.user);
      } else {
        const res = await scan.lookupQr(inputValue);
        setResult(res.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Scanner</h1>

      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 text-white mb-8">
        <div className="text-center mb-6">
          {scanMode === 'nfc' ? (
            <ScanLine size={48} className="mx-auto mb-3 opacity-80" />
          ) : (
            <QrCode size={48} className="mx-auto mb-3 opacity-80" />
          )}
          <p className="text-indigo-100">
            {scanMode === 'nfc' ? 'Scan an NFC tag or enter the UID manually' : 'Enter QR code or scan with camera'}
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-4">
          <button
            onClick={() => { setScanMode('nfc'); setInputValue(''); setResult(null); setError(''); }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              scanMode === 'nfc' ? 'bg-white text-indigo-600' : 'bg-indigo-400 text-white hover:bg-indigo-300'
            }`}
          >
            NFC
          </button>
          <button
            onClick={() => { setScanMode('qr'); setInputValue(''); setResult(null); setError(''); }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              scanMode === 'qr' ? 'bg-white text-indigo-600' : 'bg-indigo-400 text-white hover:bg-indigo-300'
            }`}
          >
            QR Code
          </button>
        </div>

        <form onSubmit={handleScan} className="flex gap-3">
          <input
            placeholder={scanMode === 'nfc' ? 'NFC UID...' : 'QR code data...'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            required
            autoFocus
            className="flex-1 px-4 py-3 rounded-xl text-gray-800 outline-none focus:ring-2 focus:ring-white text-lg"
          />
          <button type="submit" disabled={loading}
            className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition disabled:opacity-50">
            {loading ? 'Scanning...' : 'Scan'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-center">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-indigo-600">
                {result.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-800">{result.name}</h2>
            <p className="text-sm text-gray-500 font-mono">
              {scanMode === 'nfc' ? result.nfc_uid : 'QR Code'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-emerald-50 rounded-xl p-5 text-center">
              <p className="text-sm text-emerald-600 font-medium mb-1">Vouchers</p>
              <p className="text-3xl font-bold text-emerald-700">{result.voucher_balance}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-5 text-center">
              <p className="text-sm text-purple-600 font-medium mb-1">Tix</p>
              <p className="text-3xl font-bold text-purple-700">{result.tix_balance}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
            <div>
              <span className="font-medium text-gray-700">Days Playing:</span> {result.days_playing}
            </div>
            <div>
              <span className="font-medium text-gray-700">Admin:</span> {result.is_admin ? 'Yes' : 'No'}
            </div>
            <div>
              <span className="font-medium text-gray-700">Email:</span> {result.email || '—'}
            </div>
            <div>
              <span className="font-medium text-gray-700">Joined:</span>{' '}
              {new Date(result.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
