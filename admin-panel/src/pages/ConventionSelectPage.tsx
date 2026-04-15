import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Trash2, Lock, Download } from 'lucide-react';
import { conventions } from '../api';

export default function ConventionSelectPage() {
  const navigate = useNavigate();
  const [conventionList, setConventionList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newConventionName, setNewConventionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadConventions();
  }, []);

  async function loadConventions() {
    try {
      const res = await conventions.list();
      setConventionList(res.conventions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newConventionName.trim()) return;
    setCreating(true);
    try {
      const res = await conventions.create(newConventionName);
      localStorage.setItem('cm_convention_id', res.convention.id.toString());
      localStorage.setItem('cm_convention_name', res.convention.name);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function handleSelectConvention(id: number, name: string) {
    localStorage.setItem('cm_convention_id', id.toString());
    localStorage.setItem('cm_convention_name', name);
    navigate('/dashboard');
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this convention and ALL its data? This cannot be undone.')) return;
    try {
      await conventions.delete(id);
      loadConventions();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Convention Manager</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-8 text-white hover:shadow-lg transition"
        >
          <div className="flex flex-col items-center gap-4">
            <Plus size={48} />
            <div className="text-center">
              <h3 className="text-xl font-semibold">Create New Convention</h3>
              <p className="text-indigo-100 text-sm mt-1">Start a fresh convention</p>
            </div>
          </div>
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex flex-col items-center gap-4 text-gray-400">
            <FolderOpen size={48} />
            <div className="text-center">
              <h3 className="text-xl font-semibold">Load Existing Convention</h3>
              <p className="text-sm mt-1">Select from the list below</p>
            </div>
          </div>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Create New Convention</h2>
          <input
            type="text"
            value={newConventionName}
            onChange={e => setNewConventionName(e.target.value)}
            placeholder="Convention name (e.g., Summer 2026)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none mb-4"
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={!newConventionName.trim() || creating}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setNewConventionName(''); }}
              className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <h2 className="text-xl font-semibold text-gray-800 mb-4">Existing Conventions</h2>
      {conventionList.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
          No conventions yet. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {conventionList.map((conv) => (
            <div
              key={conv.id}
              className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition cursor-pointer ${
                conv.status === 'ended' ? 'border-gray-300 opacity-75' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex-1"
                  onClick={() => handleSelectConvention(conv.id, conv.name)}
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-800">{conv.name}</h3>
                    {conv.status === 'ended' && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full flex items-center gap-1">
                        <Lock size={12} /> Ended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Created: {new Date(conv.created_at).toLocaleDateString()}
                    {conv.ended_at && ` • Ended: ${new Date(conv.ended_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSelectConvention(conv.id, conv.name)}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium px-3 py-1 rounded hover:bg-indigo-50 transition"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleDelete(conv.id)}
                    className="text-red-500 hover:text-red-600 p-2 rounded hover:bg-red-50 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
