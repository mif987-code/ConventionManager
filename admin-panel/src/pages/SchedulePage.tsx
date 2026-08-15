import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Printer, X, GripVertical } from 'lucide-react';
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, useDroppable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { events as eventsApi } from '../api';

const UNSCHEDULED = '__unscheduled__';
const DEFAULT_DAYS = ['saturday', 'sunday'];
const DEFAULT_TRACKS = ['Featured / Main Event', 'Panels & Special Events', 'Rotating'];

function colKey(day: string, track: string) {
  return `${day}|||${track}`;
}

function EventCard({ ev, onColorChange, onTimeChange, onRemove }: {
  ev: any;
  onColorChange: (color: string) => void;
  onTimeChange: (field: 'start_time' | 'end_time', value: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(ev.id) });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: ev.schedule_color || '#6366f1' }}
      className="bg-[#27273a] border border-[#3f3f5a] border-l-4 rounded-md p-2 mb-2 text-white"
    >
      <div className="flex items-center gap-1 mb-1">
        <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-white touch-none">
          <GripVertical size={14} />
        </button>
        <Link to={`/events/${ev.id}`} className="flex-1 text-sm font-semibold truncate hover:underline">
          {ev.name}
        </Link>
        <input
          type="color"
          value={ev.schedule_color || '#6366f1'}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-4 h-4 rounded-full border-none bg-transparent cursor-pointer"
        />
        <button onClick={onRemove} className="text-gray-500 hover:text-red-400 text-xs" title="Unschedule">
          <X size={13} />
        </button>
      </div>
      <div className="text-[10px] text-gray-400 mb-1">
        {ev.event_type_name} &middot; {ev.category} &middot; {ev.entry_cost_vouchers} vouchers
      </div>
      <div className="flex items-center gap-1">
        <input
          type="time"
          value={ev.start_time ? ev.start_time.slice(0, 5) : ''}
          onChange={(e) => onTimeChange('start_time', e.target.value)}
          className="bg-[#161625] border border-[#3f3f5a] text-cyan-400 text-[10px] rounded px-1 py-0.5 w-full"
        />
        <span className="text-gray-500 text-[10px]">–</span>
        <input
          type="time"
          value={ev.end_time ? ev.end_time.slice(0, 5) : ''}
          onChange={(e) => onTimeChange('end_time', e.target.value)}
          className="bg-[#161625] border border-[#3f3f5a] text-cyan-400 text-[10px] rounded px-1 py-0.5 w-full"
        />
      </div>
    </div>
  );
}

function Column({ id, title, eventList, onColorChange, onTimeChange, onRemove }: {
  id: string;
  title: string;
  eventList: any[];
  onColorChange: (evId: number, color: string) => void;
  onTimeChange: (evId: number, field: 'start_time' | 'end_time', value: string) => void;
  onRemove: (evId: number) => void;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="bg-[#1e1e2e] border border-[#334155] rounded-lg p-2 min-h-[80px] flex-1 min-w-[220px]">
      <div className="text-[11px] uppercase tracking-wide font-bold text-gray-400 mb-2 px-1">{title}</div>
      <SortableContext id={id} items={eventList.map((e) => String(e.id))} strategy={verticalListSortingStrategy}>
        {eventList.map((ev) => (
          <EventCard
            key={ev.id}
            ev={ev}
            onColorChange={(c) => onColorChange(ev.id, c)}
            onTimeChange={(f, v) => onTimeChange(ev.id, f, v)}
            onRemove={() => onRemove(ev.id)}
          />
        ))}
      </SortableContext>
      {eventList.length === 0 && (
        <div className="text-[10px] text-gray-500 italic px-1 py-2">Drop events here</div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const [eventList, setEventList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState<string[]>(DEFAULT_DAYS);
  const [tracks, setTracks] = useState<string[]>(DEFAULT_TRACKS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newDay, setNewDay] = useState('');
  const [newTrack, setNewTrack] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function load() {
    try {
      setLoading(true);
      const res = await eventsApi.list();
      const list = res.events || [];
      setEventList(list);
      const extraDays = Array.from(new Set(list.map((e: any) => e.schedule_day).filter(Boolean))) as string[];
      const extraTracks = Array.from(new Set(list.map((e: any) => e.track).filter(Boolean))) as string[];
      setDays((prev) => Array.from(new Set([...prev, ...extraDays])));
      setTracks((prev) => Array.from(new Set([...prev, ...extraTracks])));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const columns = useMemo(() => {
    const map: Record<string, any[]> = { [UNSCHEDULED]: [] };
    for (const day of days) {
      for (const track of tracks) {
        map[colKey(day, track)] = [];
      }
    }
    for (const ev of eventList) {
      const key = ev.schedule_day && ev.track ? colKey(ev.schedule_day, ev.track) : UNSCHEDULED;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    return map;
  }, [eventList, days, tracks]);

  function findContainer(id: string): string {
    for (const key of Object.keys(columns)) {
      if (columns[key].some((e) => String(e.id) === id)) return key;
    }
    return UNSCHEDULED;
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeIdStr = String(active.id);
    const sourceKey = findContainer(activeIdStr);
    const overIdStr = String(over.id);
    const destKey = columns[overIdStr] !== undefined ? overIdStr : findContainer(overIdStr);
    if (!destKey) return;

    const sourceItems = [...columns[sourceKey]];
    const destItems = sourceKey === destKey ? sourceItems : [...columns[destKey]];

    const oldIndex = sourceItems.findIndex((e2) => String(e2.id) === activeIdStr);
    if (oldIndex === -1) return;
    const [moved] = sourceItems.splice(oldIndex, 1);

    let newIndex = destItems.findIndex((e2) => String(e2.id) === overIdStr);
    if (newIndex === -1) newIndex = destItems.length;
    destItems.splice(newIndex, 0, moved);

    const [destDay, destTrack] = destKey === UNSCHEDULED ? [null, null] : destKey.split('|||');

    // Optimistic local update
    setEventList((prev) => prev.map((ev) => {
      if (String(ev.id) === activeIdStr) {
        return { ...ev, schedule_day: destDay, track: destTrack };
      }
      return ev;
    }));

    try {
      await eventsApi.updateSchedule(moved.id, {
        schedule_day: destDay,
        track: destTrack,
        sort_order: newIndex,
      });
      // Reflow sort_order for the rest of destination column
      await Promise.all(
        destItems.map((ev, idx) =>
          idx === newIndex ? Promise.resolve() : eventsApi.updateSchedule(ev.id, { sort_order: idx })
        )
      );
      load();
    } catch (err: any) {
      setError(err.message);
      load();
    }
  }

  async function handleColorChange(evId: number, color: string) {
    setEventList((prev) => prev.map((ev) => (ev.id === evId ? { ...ev, schedule_color: color } : ev)));
    try {
      await eventsApi.updateSchedule(evId, { schedule_color: color });
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleTimeChange(evId: number, field: 'start_time' | 'end_time', value: string) {
    setEventList((prev) => prev.map((ev) => (ev.id === evId ? { ...ev, [field]: value } : ev)));
    try {
      await eventsApi.updateSchedule(evId, { [field]: value || null });
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRemove(evId: number) {
    setEventList((prev) => prev.map((ev) => (ev.id === evId ? { ...ev, schedule_day: null, track: null } : ev)));
    try {
      await eventsApi.updateSchedule(evId, { schedule_day: null, track: null });
    } catch (err: any) {
      setError(err.message);
    }
  }

  function addDay() {
    const name = newDay.trim();
    if (!name || days.includes(name)) return;
    setDays((prev) => [...prev, name]);
    setNewDay('');
  }

  function addTrack() {
    const name = newTrack.trim();
    if (!name || tracks.includes(name)) return;
    setTracks((prev) => [...prev, name]);
    setNewTrack('');
  }

  function removeDay(day: string) {
    const hasEvents = eventList.some((ev) => ev.schedule_day === day);
    if (hasEvents && !confirm(`"${day}" has scheduled events. Remove column anyway? Events will move to Unscheduled.`)) return;
    setDays((prev) => prev.filter((d) => d !== day));
  }

  function removeTrack(track: string) {
    const hasEvents = eventList.some((ev) => ev.track === track);
    if (hasEvents && !confirm(`"${track}" has scheduled events. Remove column anyway? Events will move to Unscheduled.`)) return;
    setTracks((prev) => prev.filter((t) => t !== track));
  }

  const activeEvent = activeId ? eventList.find((e) => String(e.id) === activeId) : null;

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Schedule</h1>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition text-sm font-medium"
        >
          <Printer size={16} /> Print / PDF
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">×</button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4 items-center bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-1">
          <input
            value={newDay}
            onChange={(e) => setNewDay(e.target.value)}
            placeholder="Add day (e.g. friday)"
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          />
          <button onClick={addDay} className="flex items-center gap-1 bg-indigo-600 text-white px-2 py-1 rounded text-sm">
            <Plus size={14} /> Day
          </button>
        </div>
        <div className="flex items-center gap-1">
          <input
            value={newTrack}
            onChange={(e) => setNewTrack(e.target.value)}
            placeholder="Add track/column"
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          />
          <button onClick={addTrack} className="flex items-center gap-1 bg-indigo-600 text-white px-2 py-1 rounded text-sm">
            <Plus size={14} /> Track
          </button>
        </div>
        <span className="text-xs text-gray-400">Drag events created in the Events page onto the grid below. Changes save automatically.</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Unscheduled bucket */}
        <div className="mb-6">
          <Column
            id={UNSCHEDULED}
            title={`Unscheduled (${columns[UNSCHEDULED]?.length || 0})`}
            eventList={columns[UNSCHEDULED] || []}
            onColorChange={handleColorChange}
            onTimeChange={handleTimeChange}
            onRemove={handleRemove}
          />
        </div>

        {days.map((day) => (
          <div key={day} className="mb-8">
            <div className="flex items-center justify-between mb-2 bg-gradient-to-r from-indigo-800 to-indigo-950 text-white px-4 py-2 rounded-lg">
              <span className="font-bold uppercase text-sm">{day}</span>
              <button onClick={() => removeDay(day)} className="text-indigo-300 hover:text-white text-xs">Remove day</button>
            </div>
            <div className="flex gap-3">
              {tracks.map((track) => (
                <div key={track} className="flex-1 min-w-[220px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-500 truncate">{track}</span>
                    <button onClick={() => removeTrack(track)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                  </div>
                  <Column
                    id={colKey(day, track)}
                    title=""
                    eventList={columns[colKey(day, track)] || []}
                    onColorChange={handleColorChange}
                    onTimeChange={handleTimeChange}
                    onRemove={handleRemove}
                  />
                </div>
              ))}
              {tracks.length === 0 && <div className="text-sm text-gray-400">Add a track column above.</div>}
            </div>
          </div>
        ))}

        <DragOverlay>
          {activeEvent ? (
            <div className="bg-[#27273a] border border-indigo-400 rounded-md p-2 text-white text-sm shadow-xl w-56">
              {activeEvent.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
