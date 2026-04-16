import { useState, useEffect } from 'react';
import { Settings, Key, Save, Eye, EyeOff, Shield } from 'lucide-react';

export default function SettingsPage() {
  const [qrSecretKey, setQrSecretKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadSettings() {
    try {
      const res = await fetch('/api/admin/settings/qr-secret-key', {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('cm_api_key') || '',
        },
      });
      const data = await res.json();
      if (res.ok) {
        setQrSecretKey(data.value || '');
      } else {
        throw new Error(data.error || 'Failed to load settings');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSettings(); }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/settings/qr-secret-key', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('cm_api_key') || '',
        },
        body: JSON.stringify({ value: qrSecretKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('QR Secret Key updated successfully!');
      } else {
        throw new Error(data.error || 'Failed to update settings');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function generateNewKey() {
    const array = new Uint32Array(8);
    crypto.getRandomValues(array);
    const newKey = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    setQrSecretKey(newKey);
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Admin Settings</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {success}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-100 text-indigo-600 p-3 rounded-lg">
            <Key size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">QR Secret Key</h2>
            <p className="text-sm text-gray-500">Secret key used to sign QR code tokens</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Secret Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={qrSecretKey}
                  onChange={(e) => setQrSecretKey(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
                  placeholder="Enter secret key"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="button"
                onClick={generateNewKey}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition font-medium flex items-center gap-2"
              >
                <Shield size={16} /> Generate
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ⚠️ This key is used to sign all QR codes. Changing it will invalidate all existing QR codes.
              Only change this if necessary and regenerate all user QR codes afterwards.
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving || !qrSecretKey.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 mb-2">Security Notice</h3>
            <p className="text-sm text-amber-700">
              The QR Secret Key is a critical security component. It should be:
            </p>
            <ul className="text-sm text-amber-700 mt-2 list-disc list-inside space-y-1">
              <li>A strong, randomly generated key (at least 32 characters)</li>
              <li>Kept confidential and never shared publicly</li>
              <li>Stored securely in the database (not in .env files)</li>
              <li>Rotated periodically for best security practices</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
