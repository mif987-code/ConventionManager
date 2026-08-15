import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Trophy, XCircle, UserPlus, ChevronRight, Wifi, Search, Check, X, Loader2, QrCode, ScanLine, Pencil } from 'lucide-react';
import { events, users, conventions, floorPlan, specialVouchers as specialVouchersApi } from '../api';
import FloorPlanPicker from '../components/FloorPlanPicker';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  ongoing: 'bg-yellow-100 text-yellow-700',
  finished: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

type Tab = 'standings' | 'rounds' | 'registration' | 'bracket';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('standings');
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [searching, setSearching] = useState(false);
  const [nfcListening, setNfcListening] = useState(false);
  const [nfcStatus, setNfcStatus] = useState('');
  const [registering, setRegistering] = useState(false);
  const [convention, setConvention] = useState<any>(null);
  const [scanMode, setScanMode] = useState<'nfc' | 'qr'>('nfc');
  const [qrInput, setQrInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [matchOutcomes, setMatchOutcomes] = useState<Record<number, 'p1' | 'p2' | 'draw'>>({});
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [tieScenario, setTieScenario] = useState<'no_ties' | '1_draw' | '2_draws' | 'high_draw'>('no_ties');
  const [teams, setTeams] = useState<any[]>([]);
  const [teamPairSelection, setTeamPairSelection] = useState<number[]>([]);
  const [teamError, setTeamError] = useState('');
  const [pairing, setPairing] = useState(false);
  const [specialVoucherNames, setSpecialVoucherNames] = useState<Record<number, string>>({});
  const [editingDetails, setEditingDetails] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPreregEnabled, setEditPreregEnabled] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  async function loadEvent() {
    try {
      setLoading(true);
      const res = await events.get(parseInt(id!));
      setEvent(res.event);
      setParticipants(res.participants || []);
      setRounds(res.rounds || []);
      setMatches(res.matches || []);
      if (res.event?.current_round > 0) setSelectedRound(res.event.current_round);
      if (res.event?.team_mode === '2hg') {
        const tRes = await events.getTeams(parseInt(id!));
        setTeams(tRes.teams || []);
      } else {
        setTeams([]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleTeamPairSelection(userId: number) {
    setTeamError('');
    setTeamPairSelection(prev => {
      if (prev.includes(userId)) return prev.filter(id => id !== userId);
      if (prev.length >= 2) return [prev[1], userId];
      return [...prev, userId];
    });
  }

  async function handleLinkTeam() {
    if (teamPairSelection.length !== 2) return;
    setPairing(true);
    setTeamError('');
    try {
      await events.createTeam(parseInt(id!), teamPairSelection[0], teamPairSelection[1]);
      setTeamPairSelection([]);
      loadEvent();
    } catch (err: any) { setTeamError(err.message); }
    finally { setPairing(false); }
  }

  async function handleUnlinkTeam(teamId: number) {
    if (!confirm('Unlink this team? Both players will need to be re-paired before the event can start.')) return;
    try {
      await events.deleteTeam(parseInt(id!), teamId);
      loadEvent();
    } catch (err: any) { setTeamError(err.message); }
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
        const svRes = await specialVouchersApi.list(parseInt(conventionId));
        const map: Record<number, string> = {};
        for (const v of svRes.special_vouchers || []) map[v.id] = v.name;
        setSpecialVoucherNames(map);
      }
    } catch (err: any) {
      console.error('Failed to load convention:', err);
    }
  }

  useEffect(() => { loadEvent(); loadConvention(); }, [id]);

  const doSearch = useCallback(async (query: string) => {
    if (query.trim().length < 1) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await users.search(query.trim());
      const participantIds = new Set(participants.map((p: any) => p.user_id));
      setSearchResults((res.users || []).filter((u: any) => !participantIds.has(u.id)));
    } catch (err: any) { setError(err.message); }
    finally { setSearching(false); }
  }, [participants]);

  function handleSearchInputChange(value: string) {
    setPlayerSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  function toggleSelect(userId: number) {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  async function handleRegisterSelected() {
    if (selectedUserIds.size === 0) return;
    setRegistering(true);
    try {
      for (const uid of selectedUserIds) {
        await events.register(parseInt(id!), uid);
      }
      setSelectedUserIds(new Set());
      setSearchResults([]);
      setPlayerSearch('');
      loadEvent();
    } catch (err: any) { setError(err.message); }
    finally { setRegistering(false); }
  }

  async function handleRegisterSingle(userId: number) {
    setRegistering(true);
    try {
      await events.register(parseInt(id!), userId);
      setSearchResults(prev => prev.filter(u => u.id !== userId));
      setSelectedUserIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
      loadEvent();
    } catch (err: any) { setError(err.message); }
    finally { setRegistering(false); }
  }

  async function handleNfcScan() {
    if (!('NDEFReader' in window)) {
      setNfcStatus('Web NFC not supported in this browser. Use Chrome on Android, or enter UID manually.');
      return;
    }
    setNfcListening(true);
    setNfcStatus('Waiting for NFC scan...');
    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      ndef.addEventListener('reading', async ({ serialNumber }: any) => {
        const uid = serialNumber.replace(/:/g, '').toUpperCase();
        setNfcStatus(`Scanned: ${uid} — registering...`);
        try {
          await events.registerNfc(parseInt(id!), uid);
          setNfcStatus(`Registered via NFC! (${uid})`);
          loadEvent();
        } catch (err: any) {
          setNfcStatus(`Error: ${err.message}`);
        }
      });
    } catch (err: any) {
      setNfcStatus(`NFC error: ${err.message}`);
      setNfcListening(false);
    }
  }

  function stopNfcScan() {
    setNfcListening(false);
    setNfcStatus('');
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
        setNfcStatus(`Found: ${data.user.name} — registering...`);
        try {
          await events.register(parseInt(id!), data.user.id);
          setNfcStatus(`Registered via QR! (${data.user.name})`);
          setQrInput('');
          loadEvent();
        } catch (err: any) {
          setNfcStatus(`Error: ${err.message}`);
        }
      } else {
        setNfcStatus(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setNfcStatus(`QR error: ${err.message}`);
    }
  }

  async function handleStart() {
    try {
      await events.start(parseInt(id!));
      loadEvent();
    } catch (err: any) { setError(err.message); }
  }

  async function handleNextRound() {
    try {
      await events.nextRound(parseInt(id!));
      loadEvent();
    } catch (err: any) { setError(err.message); }
  }

  async function handleReportMatch(matchId: number) {
    const outcome = matchOutcomes[matchId];
    if (!outcome) return;
    const p1 = outcome === 'p1' ? 1 : 0;
    const p2 = outcome === 'p2' ? 1 : 0;
    const d = outcome === 'draw' ? 1 : 0;
    try {
      await events.reportMatch(matchId, p1, p2, d);
      setMatchOutcomes((prev) => { const n = { ...prev }; delete n[matchId]; return n; });
      loadEvent();
    } catch (err: any) { setError(err.message); }
  }

  async function handleFinish() {
    try {
      await events.finish(parseInt(id!), tieScenario);
      if (event.table_id) await floorPlan.release(parseInt(id!)).catch(() => {});
      setShowFinishModal(false);
      loadEvent();
    } catch (err: any) { setError(err.message); }
  }

  function computeTieScenario(): 'no_ties' | '1_draw' | '2_draws' | 'high_draw' {
    const maxDraws = Math.max(...participants.map((p: any) => p.draws || 0), 0);
    if (maxDraws === 0) return 'no_ties';
    if (maxDraws === 1) return '1_draw';
    if (maxDraws === 2) return '2_draws';
    return 'high_draw';
  }

  function getActiveTieStructure() {
    const ties = event.prize_structure_ties || {};
    if (!Object.keys(ties).length) return null;
    const is3Round = event.total_rounds === 3 && event.tournament_structure !== 'single_elimination';
    if (!is3Round) return ties;
    const drawMap: Record<string, Record<string, number>> = { no_ties: {}, '1_draw': {}, '2_draws': {}, high_draw: {} };
    for (const [rec, amt] of Object.entries(ties) as [string, number][]) {
      const parts = rec.split('-');
      const t = parseInt(parts[2] ?? '0');
      if (t === 0) drawMap['no_ties'][rec] = amt;
      else if (t === 1) drawMap['1_draw'][rec] = amt;
      else if (t === 2) drawMap['2_draws'][rec] = amt;
      else drawMap['high_draw'][rec] = amt;
    }
    return drawMap[tieScenario];
  }

  function prizeTixAmount(entry: any): number {
    if (entry === undefined || entry === null) return 0;
    if (typeof entry === 'number') return entry;
    return entry.tix ?? 0;
  }

  function prizeSpecialVoucherId(entry: any): number | null {
    if (entry === undefined || entry === null || typeof entry === 'number') return null;
    return entry.special_voucher_id ?? null;
  }

  function calcTotalPayout(structure: Record<string, any> | null): number {
    if (!structure) return 0;
    return participants.reduce((sum: number, p: any) => {
      const key = `${p.wins}-${p.losses}-${p.draws}`;
      return sum + prizeTixAmount(structure[key]);
    }, 0);
  }

  function startEditingDetails() {
    setEditName(event.name);
    setEditPreregEnabled(!!event.preregistration_enabled);
    setEditingDetails(true);
  }

  async function handleSaveDetails() {
    if (!editName.trim()) { setError('Event name cannot be empty'); return; }
    setSavingDetails(true);
    try {
      await events.update(parseInt(id!), { name: editName.trim(), preregistration_enabled: editPreregEnabled });
      setEditingDetails(false);
      loadEvent();
    } catch (err: any) { setError(err.message); }
    finally { setSavingDetails(false); }
  }

  async function handleCancel() {
    if (!confirm('Cancel this event and refund all participants?')) return;
    try {
      await events.cancel(parseInt(id!));
      if (event.table_id) await floorPlan.release(parseInt(id!)).catch(() => {});
      loadEvent();
    } catch (err: any) { setError(err.message); }
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;
  if (!event) return <div className="text-red-500">Event not found</div>;

  const roundMatches = matches.filter((m: any) => m.round_number === selectedRound);
  const allCurrentRoundReported = roundMatches.length > 0 && roundMatches.every((m: any) => m.reported);
  const isLastRound = event.current_round >= event.total_rounds;

  return (
    <div>
      <button onClick={() => navigate('/events')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 text-sm">
        <ArrowLeft size={16} /> Back to Events
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Event Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            {editingDetails ? (
              <div className="space-y-2 max-w-md">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-xl font-bold text-gray-800 border border-indigo-300 rounded-lg px-2 py-1 w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                />
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={editPreregEnabled}
                    onChange={(e) => setEditPreregEnabled(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Preregistration enabled
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDetails}
                    disabled={savingDetails}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingDetails ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingDetails(false)}
                    disabled={savingDetails}
                    className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-800">{event.name}</h1>
                {event.status === 'open' && (
                  <button onClick={startEditingDetails} title="Edit name / preregistration" className="text-gray-400 hover:text-indigo-600">
                    <Pencil size={16} />
                  </button>
                )}
              </div>
            )}
            {!editingDetails && (
              <p className="text-gray-500 mt-1">
                {event.category && <span className="font-medium">{event.category}</span>}
                {event.format && <span> / {event.format}</span>}
                {' '}&middot; {Number(event.entry_cost_vouchers)} vouchers &middot; Max {event.max_players} players
                {' '}&middot;{' '}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${event.tournament_structure === 'single_elimination' ? 'bg-red-100 text-red-700' : 'bg-cyan-100 text-cyan-700'}`}>
                  {event.tournament_structure === 'single_elimination' ? 'Single Elim' : 'Swiss'}
                </span>
                {event.team_mode === '2hg' && (
                  <>
                    {' '}
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                      2-Headed Giant
                    </span>
                  </>
                )}
                {' '}&middot;{' '}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${event.preregistration_enabled ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                  {event.preregistration_enabled ? 'Prereg on' : 'Prereg off'}
                </span>
              </p>
            )}
            {event.status === 'ongoing' && (
              <p className="text-sm text-indigo-600 mt-1 font-medium">
                Round {event.current_round} of {event.total_rounds}
              </p>
            )}
          </div>
          <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${STATUS_COLORS[event.status] || ''}`}>
            {event.status}
          </span>
        </div>

        {/* Table reservation */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginTop:8}}>
          {event.table_number ? (
            <span style={{fontFamily:'DM Mono,monospace',fontSize:12,background:'rgba(74,158,110,0.15)',
              border:'1px solid #4a9e6e',color:'#4a9e6e',padding:'3px 10px',borderRadius:4}}>
              Table {event.table_number}
            </span>
          ) : (
            <span style={{fontFamily:'DM Mono,monospace',fontSize:11,color:'#8a8880'}}>No table assigned</span>
          )}
          {(event.status === 'open' || event.status === 'ongoing') && (
            <button onClick={() => setShowTablePicker(true)} style={{
              fontFamily:'DM Mono,monospace',fontSize:11,padding:'3px 10px',borderRadius:4,
              border:'1px solid #c8a84b',background:'rgba(200,168,75,0.1)',color:'#c8a84b',cursor:'pointer'
            }}>
              {event.table_number ? 'Change table' : 'Reserve table'}
            </button>
          )}
          {event.table_number && (event.status === 'open' || event.status === 'ongoing') && (
            <button onClick={async()=>{await floorPlan.release(parseInt(id!));loadEvent();}} style={{
              fontFamily:'DM Mono,monospace',fontSize:11,padding:'3px 10px',borderRadius:4,
              border:'1px solid #555450',background:'transparent',color:'#8a8880',cursor:'pointer'
            }}>
              Release
            </button>
          )}
        </div>

        {(event.prize_structure || event.tix_per_player) && (() => {
          const is3Round = event.total_rounds === 3 && event.tournament_structure !== 'single_elimination';
          const ties = event.prize_structure_ties || {};
          const hasTies = Object.keys(ties).length > 0;
          const maxTix = event.tix_per_player && event.max_players ? event.tix_per_player * event.max_players : null;
          return (
            <div className="mt-4 space-y-3">
              {maxTix && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 flex items-center gap-4">
                  <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Max Tix Payout</span>
                  <span className="font-bold text-indigo-800">{maxTix} tix</span>
                  <span className="text-xs text-indigo-500">{event.max_players} players × {event.tix_per_player} tix</span>
                </div>
              )}
              {event.prize_structure && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Prize Structure — Without Ties</h3>
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(event.prize_structure).map(([record, entry]) => (
                      <div key={record} className="text-center">
                        <div className="text-xs text-gray-500">{record}</div>
                        <div className="font-semibold text-gray-800">{prizeTixAmount(entry)} tix</div>
                        {prizeSpecialVoucherId(entry) && (
                          <div className="text-xs text-purple-600 font-medium">+ {specialVoucherNames[prizeSpecialVoucherId(entry)!] || 'Special Voucher'}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hasTies && is3Round && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Prize Structure — With Ties (3-Round)</h3>
                  {[['1_draw', '1 Draw', 1], ['2_draws', '2 Draws', 2], ['high_draw', 'High-Draw (3)', 3]].map(([key, label, draws]) => {
                    const rows = Object.entries(ties).filter(([r]) => parseInt((r as string).split('-')[2] ?? '0') === draws);
                    if (!rows.length) return null;
                    return (
                      <div key={key as string} className="mb-2">
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">{label as string}</div>
                        <div className="flex flex-wrap gap-3">
                          {rows.map(([record, entry]) => (
                            <div key={record} className="text-center">
                              <div className="text-xs text-gray-500">{record}</div>
                              <div className="font-semibold text-gray-800">{prizeTixAmount(entry)} tix</div>
                              {prizeSpecialVoucherId(entry) && (
                                <div className="text-xs text-purple-600 font-medium">+ {specialVoucherNames[prizeSpecialVoucherId(entry)!] || 'Special Voucher'}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {hasTies && !is3Round && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Prize Structure — With Ties</h3>
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(ties).map(([record, entry]) => (
                      <div key={record} className="text-center">
                        <div className="text-xs text-gray-500">{record}</div>
                        <div className="font-semibold text-gray-800">{prizeTixAmount(entry)} tix</div>
                        {prizeSpecialVoucherId(entry) && (
                          <div className="text-xs text-purple-600 font-medium">+ {specialVoucherNames[prizeSpecialVoucherId(entry)!] || 'Special Voucher'}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-6">
          {event.status === 'open' && (
            <>
              <button onClick={() => { setTab('registration'); setShowAddPlayer(true); }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                <UserPlus size={16} /> Add Player
              </button>
              <button onClick={handleStart}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium">
                <Play size={16} /> Start Event
              </button>
            </>
          )}
          {event.status === 'ongoing' && (
            <>
              {(event.current_round === 0 || (allCurrentRoundReported && !isLastRound)) && (
                <button onClick={handleNextRound}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                  <ChevronRight size={16} /> {event.current_round === 0 ? 'Start Round 1' : `Start Round ${event.current_round + 1}`}
                </button>
              )}
              {allCurrentRoundReported && isLastRound && (
                <button onClick={() => { setTieScenario(computeTieScenario()); setShowFinishModal(true); }}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm font-medium">
                  <Trophy size={16} /> Finish & Award Prizes
                </button>
              )}
            </>
          )}
          {(event.status === 'open' || event.status === 'ongoing') && (
            <button onClick={handleCancel}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-sm font-medium">
              <XCircle size={16} /> Cancel Event
            </button>
          )}
        </div>
      </div>

      {/* Finish & Award Prizes Modal */}
      {showFinishModal && (() => {
        const is3Round = event.total_rounds === 3 && event.tournament_structure !== 'single_elimination';
        const ties = event.prize_structure_ties || {};
        const hasTies = Object.keys(ties).length > 0;
        const activeTieStruct = getActiveTieStructure();
        const noTieStruct = event.prize_structure || {};
        const activeStruct = tieScenario === 'no_ties' ? noTieStruct : (activeTieStruct || noTieStruct);
        const totalPayout = calcTotalPayout(activeStruct);
        const maxTix = event.tix_per_player && event.max_players ? event.tix_per_player * event.max_players : null;
        const overBudget = maxTix !== null && totalPayout > maxTix;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Finish & Award Prizes</h2>
              <p className="text-sm text-gray-500 mb-4">Confirm the tie scenario for this event before distributing prizes.</p>

              {is3Round && hasTies ? (
                <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-600 uppercase mb-2 block">Tie Scenario</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['no_ties', '1_draw', '2_draws', 'high_draw'] as const).map((s) => (
                      <button key={s} onClick={() => setTieScenario(s)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                          tieScenario === s ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                        }`}>
                        {s === 'no_ties' ? 'No Ties' : s === '1_draw' ? 'With Ties — 1 Draw' : s === '2_draws' ? 'With Ties — 2 Draws' : 'High-Draw (3 Draws)'}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Payout Preview (based on current standings)</div>
                <div className="space-y-1">
                  {participants.map((p: any) => {
                    const key = `${p.wins}-${p.losses}-${p.draws}`;
                    const tix = activeStruct[key] || 0;
                    return (
                      <div key={p.user_id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{p.user_name}</span>
                        <span className="font-mono text-xs text-gray-500 mr-2">{key}</span>
                        <span className={`font-semibold ${tix > 0 ? 'text-green-700' : 'text-gray-400'}`}>{tix} tix</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">Total Payout</span>
                  <span className={`font-bold text-sm ${overBudget ? 'text-red-600' : 'text-gray-800'}`}>{totalPayout} tix</span>
                </div>
                {maxTix && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">Max Budget ({event.max_players} × {event.tix_per_player})</span>
                    <span className="text-xs font-semibold text-indigo-700">{maxTix} tix</span>
                  </div>
                )}
                {overBudget && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700 font-medium">
                    ⚠️ Payout exceeds budget by {totalPayout - maxTix!} tix. Adjust the prize structure before finishing.
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={handleFinish} disabled={overBudget}
                  className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                  <Trophy size={15} /> Confirm & Award
                </button>
                <button onClick={() => setShowFinishModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {((['standings', 'rounds', 'registration'] as Tab[]).concat(
          event.tournament_structure === 'single_elimination' ? ['bracket' as Tab] : []
        )).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'standings' ? `Standings (${participants.length})` : t === 'rounds' ? `Rounds (${event.current_round}/${event.total_rounds})` : t === 'bracket' ? 'Bracket' : 'Registration'}
          </button>
        ))}
      </div>

      {/* Standings Tab */}
      {tab === 'standings' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[420px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase w-10">#</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Player</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Record (W-L-D)</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Match Pts</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Win %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {participants.map((p: any, idx: number) => {
                const totalMatches = p.wins + p.losses + p.draws;
                const winPct = totalMatches > 0 ? Math.round((p.wins / totalMatches) * 100) : 0;
                return (
                  <tr key={p.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-400">{idx + 1}</td>
                    <td className="px-6 py-3">
                      <div className="text-sm font-medium text-gray-800">{p.user_name}</div>
                      {event.team_mode === '2hg' && p.team_name ? (
                        <div className="text-xs text-emerald-600 font-medium">{p.team_name}</div>
                      ) : (
                        <div className="text-xs text-gray-400 font-mono">{p.nfc_uid}</div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-center">
                      <span className="font-mono">
                        <span className="text-green-600 font-semibold">{p.wins}</span>
                        <span className="text-gray-400"> - </span>
                        <span className="text-red-600 font-semibold">{p.losses}</span>
                        {p.draws > 0 && (
                          <>
                            <span className="text-gray-400"> - </span>
                            <span className="text-yellow-600 font-semibold">{p.draws}</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-center font-semibold text-gray-700">{p.match_points}</td>
                    <td className="px-6 py-3 text-sm text-center text-gray-500">{winPct}%</td>
                  </tr>
                );
              })}
              {participants.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No participants yet</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Rounds Tab */}
      {tab === 'rounds' && (
        <div>
          {/* Round selector */}
          {rounds.length > 0 && (
            <div className="flex gap-2 mb-4">
              {rounds.map((r: any) => (
                <button key={r.round_number} onClick={() => setSelectedRound(r.round_number)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedRound === r.round_number ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                  Round {r.round_number}
                </button>
              ))}
            </div>
          )}

          {rounds.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-400">
              {event.status === 'ongoing' ? 'Click "Start Round 1" to begin the first round' : 'No rounds played yet'}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Round {selectedRound} Matches</h2>
                {roundMatches.every((m: any) => m.reported) && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">All Reported</span>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {roundMatches.map((m: any) => {
                  const outcome = matchOutcomes[m.id];
                  const isBye = !m.player2_name;
                  const p1Label = m.team1_name || m.player1_name;
                  const p2Label = m.team2_name || m.player2_name;
                  return (
                    <div key={m.id} className="px-6 py-4">
                      <div className="flex items-center justify-between gap-4">
                        {/* Player names - left side */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div>
                              <span className="font-medium text-gray-800">{p1Label}</span>
                              {!m.team1_name && <span className="text-gray-400 text-xs ml-1 font-mono">(P1)</span>}
                            </div>
                            <span className="text-gray-400 text-sm font-medium">vs</span>
                            <div>
                              <span className="font-medium text-gray-800">{p2Label || 'BYE'}</span>
                              {!isBye && !m.team2_name && <span className="text-gray-400 text-xs ml-1 font-mono">(P2)</span>}
                            </div>
                          </div>
                        </div>

                        {/* Result / Reporting - right side */}
                        {m.reported && !matchOutcomes[m.id] ? (
                          <div className="flex items-center gap-2">
                            {m.draws > 0 ? (
                              <span className="text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">Draw</span>
                            ) : m.player1_wins > m.player2_wins ? (
                              <span className="text-sm px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">{p1Label} wins</span>
                            ) : (
                              <span className="text-sm px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">{p2Label} wins</span>
                            )}
                            <span className="text-xs text-green-500">✓</span>
                            {!isBye && (
                              <button onClick={() => {
                                const cur = m.draws > 0 ? 'draw' : m.player1_wins > m.player2_wins ? 'p1' : 'p2';
                                setMatchOutcomes(prev => ({ ...prev, [m.id]: cur }));
                              }}
                                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium ml-1 transition">
                                Edit
                              </button>
                            )}
                          </div>
                        ) : isBye ? (
                          <span className="text-xs text-gray-400 italic">Auto-win (BYE)</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <button onClick={() => setMatchOutcomes(prev => ({ ...prev, [m.id]: 'p1' }))}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition truncate max-w-[120px] ${
                                outcome === 'p1' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                              title={p1Label}>
                              {p1Label} wins
                            </button>
                            <button onClick={() => setMatchOutcomes(prev => ({ ...prev, [m.id]: 'draw' }))}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                outcome === 'draw' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                              Draw
                            </button>
                            <button onClick={() => setMatchOutcomes(prev => ({ ...prev, [m.id]: 'p2' }))}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition truncate max-w-[120px] ${
                                outcome === 'p2' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                              title={p2Label}>
                              {p2Label} wins
                            </button>
                            <button onClick={() => handleReportMatch(m.id)} disabled={!outcome}
                              className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed font-medium">
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {roundMatches.length === 0 && (
                  <div className="px-6 py-8 text-center text-gray-400">No matches for this round</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Registration Tab */}
      {tab === 'registration' && (
        <div>
          {event.status === 'open' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800">Add Player to Event</h2>
                {/* Scan Mode Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setScanMode('nfc')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      scanMode === 'nfc' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ScanLine size={16} /> NFC
                  </button>
                  <button
                    onClick={() => setScanMode('qr')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      scanMode === 'qr' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <QrCode size={16} /> QR
                  </button>
                </div>
              </div>

              {/* NFC/QR Scan Button */}
              {scanMode === 'nfc' ? (
                nfcListening ? (
                  <button onClick={stopNfcScan}
                    className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition text-sm font-medium animate-pulse mb-4">
                    <Wifi size={16} /> Stop NFC Scan
                  </button>
                ) : (
                  <button onClick={handleNfcScan}
                    className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-200 transition text-sm font-medium mb-4">
                    <Wifi size={16} /> Scan NFC Tag
                  </button>
                )
              ) : (
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      placeholder="Enter QR code or scan..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                    <button onClick={handleQrScan}
                      className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-200 transition text-sm font-medium">
                      <QrCode size={16} /> Scan QR
                    </button>
                  </div>
                </div>
              )}

              {/* NFC/QR Status */}
              {nfcStatus && (
                <div className={`text-sm px-3 py-2 rounded-lg mb-4 ${nfcStatus.startsWith('Error') || nfcStatus.startsWith('NFC error') || nfcStatus.startsWith('Web NFC') || nfcStatus.startsWith('QR error')
                  ? 'bg-red-50 text-red-700' : nfcStatus.includes('Registered') ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                  {nfcStatus}
                  <button onClick={() => setNfcStatus('')} className="ml-2 font-bold">&times;</button>
                </div>
              )}

              {/* Search Input with autocomplete */}
              <div className="relative mb-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      ref={searchInputRef}
                      placeholder="Type player name or NFC UID to search..."
                      value={playerSearch}
                      onChange={(e) => handleSearchInputChange(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                    {playerSearch && (
                      <button onClick={() => { setPlayerSearch(''); setSearchResults([]); setSelectedUserIds(new Set()); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {searching && <Loader2 size={18} className="text-indigo-500 animate-spin" />}
                </div>
              </div>

              {/* Search Results with multi-select */}
              {searchResults.length > 0 && (
                <div>
                  {selectedUserIds.size > 0 && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-indigo-600 font-medium">{selectedUserIds.size} selected</span>
                      <button onClick={handleRegisterSelected} disabled={registering}
                        className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50">
                        {registering ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                        Register Selected ({selectedUserIds.size})
                      </button>
                    </div>
                  )}
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {searchResults.map((u: any) => {
                      const isSelected = selectedUserIds.has(u.id);
                      return (
                        <div key={u.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition ${isSelected ? 'bg-indigo-50' : ''}`}
                          onClick={() => toggleSelect(u.id)}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                            isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                            {isSelected && <Check size={12} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-800 text-sm">{u.name}</span>
                            <span className="text-gray-400 text-xs ml-2 font-mono">{u.nfc_uid}</span>
                            {u.email && <span className="text-gray-400 text-xs ml-2">{u.email}</span>}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); handleRegisterSingle(u.id); }} disabled={registering}
                            className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-md hover:bg-indigo-700 transition flex-shrink-0 disabled:opacity-50">
                            Register
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {playerSearch.length >= 1 && !searching && searchResults.length === 0 && (
                <p className="text-sm text-gray-400 italic">No matching players found.</p>
              )}
            </div>
          )}

          {event.team_mode === '2hg' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="font-semibold text-gray-800 mb-1">2-Headed Giant Team Pairing</h2>
              <p className="text-sm text-gray-500 mb-4">
                Link registered players into 2-player teams. All players must be paired before the event can start.
              </p>

              {teamError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-4 text-sm">
                  {teamError}
                  <button onClick={() => setTeamError('')} className="ml-2 font-bold">&times;</button>
                </div>
              )}

              {teams.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Linked Teams ({teams.length})</h3>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {teams.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm font-medium text-gray-800">{t.name}</span>
                        {event.status === 'open' && (
                          <button onClick={() => handleUnlinkTeam(t.id)}
                            className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-md hover:bg-red-100 transition">
                            Unlink
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {event.status === 'open' && (() => {
                const unpaired = participants.filter((p: any) => !p.team_id);
                return (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      Unpaired Players ({unpaired.length}) — select 2 to link
                    </h3>
                    {unpaired.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">All registered players are paired.</p>
                    ) : (
                      <>
                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto mb-3">
                          {unpaired.map((p: any) => {
                            const isSelected = teamPairSelection.includes(p.user_id);
                            return (
                              <div key={p.user_id}
                                onClick={() => toggleTeamPairSelection(p.user_id)}
                                className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition ${isSelected ? 'bg-indigo-50' : ''}`}>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                                  isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                  {isSelected && <Check size={12} className="text-white" />}
                                </div>
                                <span className="text-sm font-medium text-gray-800">{p.user_name}</span>
                              </div>
                            );
                          })}
                        </div>
                        <button onClick={handleLinkTeam} disabled={teamPairSelection.length !== 2 || pairing}
                          className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50">
                          {pairing ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                          Link as Team {teamPairSelection.length === 2 ? '' : `(${teamPairSelection.length}/2 selected)`}
                        </button>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800">Registered Players ({participants.length})</h2>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[380px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Player</th>
                  {event.team_mode === '2hg' && <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Team</th>}
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">NFC UID</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {participants.map((p: any) => (
                  <tr key={p.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-800">{p.user_name}</td>
                    {event.team_mode === '2hg' && (
                      <td className="px-6 py-3 text-sm">
                        {p.team_name ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{p.team_name}</span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Unpaired</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-3 text-sm text-gray-600 font-mono">{p.nfc_uid}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{new Date(p.registered_at).toLocaleString()}</td>
                  </tr>
                ))}
                {participants.length === 0 && (
                  <tr><td colSpan={event.team_mode === '2hg' ? 4 : 3} className="px-6 py-8 text-center text-gray-400">No participants yet</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Bracket Tab (Single Elimination only) */}
      {tab === 'bracket' && event.tournament_structure === 'single_elimination' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-x-auto">
          <h2 className="font-semibold text-gray-800 mb-4">Elimination Bracket</h2>
          {rounds.length === 0 ? (
            <p className="text-gray-400 italic">No rounds yet. Start the event first.</p>
          ) : (
            <BracketSVG rounds={rounds} matches={matches} participants={participants} />
          )}
        </div>
      )}
      {showTablePicker && (
        <FloorPlanPicker
          eventId={parseInt(id!)}
          currentTableNumber={event.table_number}
          onReserved={() => loadEvent()}
          onClose={() => setShowTablePicker(false)}
        />
      )}
    </div>
  );
}

function BracketSVG({ rounds, matches, participants }: { rounds: any[]; matches: any[]; participants: any[] }) {
  const pMap: Record<number, string> = {};
  participants.forEach((p: any) => { pMap[p.user_id] = p.user_name || `Player #${p.user_id}`; });

  const totalRounds = rounds.length;
  if (totalRounds === 0) return null;

  // Build bracket data per round
  const roundData = rounds.map((r: any) => {
    return matches
      .filter((m: any) => m.round_number === r.round_number)
      .map((m: any) => {
        const p1 = pMap[m.player1_id] || '?';
        const p2 = m.player2_id ? (pMap[m.player2_id] || '?') : 'BYE';
        let winner: string | null = null;
        if (m.reported) {
          if (!m.player2_id) winner = p1;
          else if (m.player1_wins > m.player2_wins) winner = p1;
          else if (m.player2_wins > m.player1_wins) winner = p2;
          else winner = 'Draw';
        }
        return { p1, p2, winner };
      });
  });

  const matchW = 160, matchH = 48, gapY = 20, gapX = 50, padX = 16, padY = 16;
  const r1count = roundData[0]?.length || 0;
  if (r1count === 0) return <p className="text-gray-400 italic">No matches yet.</p>;

  const svgH = padY * 2 + r1count * (matchH + gapY) - gapY;
  const svgW = padX * 2 + totalRounds * (matchW + gapX) - gapX;

  const truncName = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + '…' : s;
  const escSvg = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Calculate positions
  const positions: { x: number; y: number }[][] = [];
  for (let ri = 0; ri < totalRounds; ri++) {
    const rd = roundData[ri] || [];
    const count = rd.length;
    const totalH = count * (matchH + gapY) - gapY;
    const startY = padY + (svgH - padY * 2 - totalH) / 2;
    const x = padX + ri * (matchW + gapX);
    const rpos: { x: number; y: number }[] = [];
    for (let mi = 0; mi < count; mi++) {
      rpos.push({ x, y: startY + mi * (matchH + gapY) });
    }
    positions.push(rpos);
  }

  // Build SVG string
  let svg = '';

  // Style
  svg += `<style>text{font-family:'Inter',system-ui,sans-serif;font-size:11px;fill:#374151}.winner{font-weight:700;fill:#4f46e5}.slot{fill:#f9fafb;stroke:#e5e7eb;stroke-width:1;rx:6}.rnd{font-size:10px;fill:#9ca3af;font-weight:600;text-transform:uppercase}</style>`;

  // Round labels
  for (let ri = 0; ri < totalRounds; ri++) {
    const x = padX + ri * (matchW + gapX) + matchW / 2;
    const label = ri === totalRounds - 1 ? 'Final' : ri === totalRounds - 2 ? 'Semis' : `Round ${ri + 1}`;
    svg += `<text x="${x}" y="${padY - 4}" text-anchor="middle" class="rnd">${label}</text>`;
  }

  // Draw matches
  for (let ri = 0; ri < totalRounds; ri++) {
    const rd = roundData[ri] || [];
    for (let mi = 0; mi < rd.length; mi++) {
      const { x, y } = positions[ri][mi];
      const m = rd[mi];
      svg += `<rect x="${x}" y="${y}" width="${matchW}" height="${matchH}" class="slot"/>`;
      svg += `<line x1="${x}" y1="${y + matchH / 2}" x2="${x + matchW}" y2="${y + matchH / 2}" stroke="#e5e7eb" stroke-width="0.5"/>`;
      const p1class = m.winner === m.p1 ? 'winner' : '';
      const p2class = m.winner === m.p2 ? 'winner' : '';
      svg += `<text x="${x + 6}" y="${y + 16}" class="${p1class}">${escSvg(truncName(m.p1, 18))}</text>`;
      svg += `<text x="${x + 6}" y="${y + matchH / 2 + 16}" class="${p2class}">${escSvg(truncName(m.p2, 18))}</text>`;
    }
  }

  // Connector lines
  for (let ri = 0; ri < totalRounds - 1; ri++) {
    const curr = positions[ri] || [];
    const next = positions[ri + 1] || [];
    for (let ni = 0; ni < next.length; ni++) {
      const i1 = ni * 2;
      const i2 = ni * 2 + 1;
      if (i1 < curr.length) {
        const fromY1 = curr[i1].y + matchH / 2;
        const fromX = curr[i1].x + matchW;
        const toX = next[ni].x;
        const toY = next[ni].y + matchH / 2;
        const midX = fromX + (toX - fromX) / 2;
        svg += `<path d="M${fromX} ${fromY1} H${midX} V${toY} H${toX}" fill="none" stroke="#d1d5db" stroke-width="1.5"/>`;
        if (i2 < curr.length) {
          const fromY2 = curr[i2].y + matchH / 2;
          svg += `<path d="M${fromX} ${fromY2} H${midX} V${toY} H${toX}" fill="none" stroke="#d1d5db" stroke-width="1.5"/>`;
        }
      }
    }
  }

  return (
    <svg width={svgW} height={svgH + 10} viewBox={`0 0 ${svgW} ${svgH + 10}`} className="block"
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
