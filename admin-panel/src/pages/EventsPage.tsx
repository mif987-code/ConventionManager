import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
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
  const [form, setForm] = useState({ name: '', event_type_id: '' });
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
    try {
      await events.create(form.name, parseInt(form.event_type_id));
      setForm({ name: '', event_type_id: '' });
      setShowCreate(false);
      loadEvents();
    } catch (err: any) {
      setError(err.message);
    }
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

      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Create New Event</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              placeholder="Event Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <select
              value={form.event_type_id}
              onChange={(e) => setForm({ ...form, event_type_id: e.target.value })}
              required
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">Select event type...</option>
              {types.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.entry_cost_vouchers} vouchers, max {t.max_players})
                </option>
              ))}
            </select>
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium">
              Create
            </button>
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
