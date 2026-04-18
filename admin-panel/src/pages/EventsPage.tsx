import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Check, X } from 'lucide-react';
import { events, eventTypes } from '../api';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  ongoing: 'bg-yellow-100 text-yellow-700',
  finished: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

export default function EventsPage() {
  const [eventList, setEventList] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedType, setSelectedType] = useState<any>(null);
  const [eventName, setEventName] = useState('');
  const [preregistrationEnabled, setPreregistrationEnabled] = useState(false);
  const [filter, setFilter] = useState('');

  async function loadEvents() {
    try {
      setLoading(true);
      const [evRes, typesRes] = await Promise.all([
        events.list(filter || undefined),
        eventTypes.list(),
      ]);
      setEventList(evRes.events || []);
      setTypes(typesRes.event_types || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEvents(); }, [filter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedType || !eventName.trim()) return;
    try {
      await events.create(eventName.trim(), selectedType.id, preregistrationEnabled);
      setEventName('');
      setPreregistrationEnabled(false);
      setSelectedType(null);
      setShowCreate(false);
      loadEvents();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleSelectType(type: any) {
    setSelectedType(type);
  }

  function handleCancelSelection() {
    setSelectedType(null);
    setEventName('');
    setPreregistrationEnabled(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Events</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
        >
          <Plus size={16} />
          Create Event
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">×</button>
        </div>
      )}

      {showCreate && !selectedType && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Select Event Type</h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">Choose an event type to see its details and create an event.</p>
          <div className="grid gap-3">
            {types.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition cursor-pointer"
                onClick={() => handleSelectType(t)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-800">{t.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t.category}</span>
                    {t.format && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">{t.format}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.tournament_structure === 'single_elimination' ? 'bg-red-100 text-red-600' : 'bg-cyan-100 text-cyan-600'}`}>
                      {t.tournament_structure === 'single_elimination' ? 'Single Elim' : 'Swiss'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {t.entry_cost_vouchers} vouchers · Max {t.max_players} players
                  </div>
                </div>
                <button className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
                  <Check size={14} /> Select
                </button>
              </div>
            ))}
            {types.length === 0 && (
              <div className="text-center text-gray-400 py-4">No event types available. Create one first.</div>
            )}
          </div>
        </div>
      )}

      {showCreate && selectedType && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Create Event</h2>
            <button onClick={handleCancelSelection} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          
          {/* Selected Event Type Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Selected Event Type</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Type:</span>
                <div className="font-medium text-gray-800">{selectedType.name}</div>
              </div>
              <div>
                <span className="text-gray-500">Category:</span>
                <div className="font-medium text-gray-800">{selectedType.category}</div>
              </div>
              <div>
                <span className="text-gray-500">Format:</span>
                <div className="font-medium text-gray-800">{selectedType.format || '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Structure:</span>
                <div className={`font-medium ${selectedType.tournament_structure === 'single_elimination' ? 'text-red-600' : 'text-cyan-600'}`}>
                  {selectedType.tournament_structure === 'single_elimination' ? 'Single Elimination' : 'Swiss'}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Entry Cost:</span>
                <div className="font-medium text-gray-800">{selectedType.entry_cost_vouchers} vouchers</div>
              </div>
              <div>
                <span className="text-gray-500">Max Players:</span>
                <div className="font-medium text-gray-800">{selectedType.max_players}</div>
              </div>
            </div>
          </div>

          {/* Event Name Input */}
          <form onSubmit={handleCreate}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Name *</label>
              <input
                placeholder="Enter event name (e.g., Friday Night Draft)"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preregistrationEnabled}
                  onChange={(e) => setPreregistrationEnabled(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Enable Pre-registration</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">Allow users to pre-register for this event from the registration page</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelSelection}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium"
              >
                Create Event
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {['', 'open', 'ongoing', 'finished', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {eventList.map((ev: any) => (
            <Link
              key={ev.id}
              to={`/events/${ev.id}`}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{ev.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {ev.event_type_name} &middot; {ev.participant_count}/{ev.max_players} players
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {ev.entry_cost_vouchers} vouchers
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[ev.status] || ''}`}>
                    {ev.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          {eventList.length === 0 && (
            <div className="text-center text-gray-400 py-8">No events found</div>
          )}
        </div>
      )}
    </div>
  );
}
