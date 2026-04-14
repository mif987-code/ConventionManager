/* ===== Convention Admin PWA — app.js ===== */

const API = '/api';
let apiKey = localStorage.getItem('nfc_api_key') || '';
let nfcReader = null;
let nfcMode = null;
let recentLog = JSON.parse(localStorage.getItem('nfc_recent') || '[]');
let debounceTimers = {};

// Per-tab state
let linkUser = null;
let topupUser = null;
let evtList = [];
let evtDetail = null;
let matchEvtDetail = null;
let matchOutcomes = {};
let matchEditMode = {}; // matchId -> true if in edit mode
let storeEditingId = null;

/* ===== AUTH ===== */
if (apiKey) { document.getElementById('api-key').value = '********'; showApp(); }
renderRecent();

function saveApiKey() {
  const k = document.getElementById('api-key').value.trim();
  if (!k || k === '********') return;
  apiKey = k;
  localStorage.setItem('nfc_api_key', k);
  showApp();
}

function showApp() {
  document.getElementById('auth-gate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  loadEvents();
}

/* ===== API ===== */
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, ...opts.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

/* ===== TABS ===== */
function switchTab(name) {
  document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => { b.classList.remove('text-indigo-600'); b.classList.add('text-gray-400'); });
  document.getElementById(`page-${name}`).classList.add('active');
  const btn = document.getElementById(`tab-${name}`);
  btn.classList.remove('text-gray-400');
  btn.classList.add('text-indigo-600');
  nfcStop();
  if (name === 'events' || name === 'matches') loadEvents();
  if (name === 'store') { storeLoadItems(); storeLoadOrders(); }
  if (name === 'stats') loadStats();
}

/* ===== STATUS ===== */
function gMsg(msg, type) {
  const el = document.getElementById('g-status');
  el.className = 'rounded-xl p-3 mb-3 text-sm font-medium fade-in ' +
    (type === 'error' ? 'bg-red-50 text-red-700' : type === 'success' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 5000);
}

/* ===== DEBOUNCED SEARCH HELPER ===== */
function setupSearch(inputId, resultsId, onSelectFn) {
  document.getElementById(inputId).addEventListener('input', (e) => {
    clearTimeout(debounceTimers[inputId]);
    const q = e.target.value.trim();
    if (q.length < 1) { document.getElementById(resultsId).innerHTML = ''; return; }
    debounceTimers[inputId] = setTimeout(async () => {
      try {
        const res = await api(`/users/search?q=${encodeURIComponent(q)}`);
        const users = res.users || [];
        const c = document.getElementById(resultsId);
        if (!users.length) { c.innerHTML = '<p class="text-xs text-gray-400 italic py-1">No results</p>'; return; }
        c.innerHTML = users.map((u, i) => {
          const name = u.name + (u.last_name ? ' ' + u.last_name : '');
          return `<button data-idx="${i}" class="srch-btn w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-indigo-50 text-left text-sm border-b border-gray-50">
            <span class="font-medium text-gray-800">${esc(name)}</span>
            <span class="text-[10px] ${u.nfc_uid ? 'text-green-600' : 'text-orange-500'}">${u.nfc_uid ? esc(u.nfc_uid) : 'No NFC'}</span>
          </button>`;
        }).join('');
        c.querySelectorAll('.srch-btn').forEach((btn, i) => {
          btn.addEventListener('click', () => onSelectFn(users[i]));
        });
      } catch (err) { gMsg(err.message, 'error'); }
    }, 300);
  });
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ===== NFC SHARED ===== */
async function nfcScan(mode) {
  nfcMode = mode;
  const scanEl = document.getElementById(`${mode}-scanning`);
  if (!('NDEFReader' in window)) {
    gMsg('Web NFC not supported. Use Chrome on Android or enter UID manually.', 'error');
    return;
  }
  if (scanEl) scanEl.classList.remove('hidden');
  try {
    nfcReader = new NDEFReader();
    await nfcReader.scan();
    nfcReader.addEventListener('reading', async ({ serialNumber }) => {
      const uid = serialNumber.replace(/:/g, '').toUpperCase();
      nfcStop();
      if (mode === 'link') await handleLinkNfc(uid);
      else if (mode === 'topup') await handleTopupNfc(uid);
      else if (mode === 'event') await handleEventNfc(uid);
    });
  } catch (err) { gMsg(`NFC: ${err.message}`, 'error'); nfcStop(); }
}

function nfcStop() {
  nfcReader = null;
  nfcMode = null;
  ['link-scanning', 'topup-scanning', 'evt-scanning'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

/* ===== RECENT LOG ===== */
function addRecent(text) {
  recentLog.unshift({ text, time: new Date().toLocaleTimeString() });
  if (recentLog.length > 20) recentLog.pop();
  localStorage.setItem('nfc_recent', JSON.stringify(recentLog));
  renderRecent();
}

function renderRecent() {
  const el = document.getElementById('recent-list');
  if (!el) return;
  if (!recentLog.length) { el.innerHTML = '<p class="text-gray-400 italic">No activity yet</p>'; return; }
  el.innerHTML = recentLog.map(r =>
    `<div class="flex justify-between py-1 border-b border-gray-50"><span>${esc(r.text)}</span><span class="text-gray-400 ml-2 whitespace-nowrap">${r.time}</span></div>`
  ).join('');
}

/* ================================================================
   TAB 1: LINK NFC
   ================================================================ */
setupSearch('link-search', 'link-results', linkSelect);

function linkSelect(u) {
  linkUser = u;
  const name = u.name + (u.last_name ? ' ' + u.last_name : '');
  document.getElementById('link-sel-name').textContent = name;
  document.getElementById('link-sel-detail').textContent = (u.nfc_uid || 'No NFC') + (u.email ? ' · ' + u.email : '');
  document.getElementById('link-selected').classList.remove('hidden');
  document.getElementById('link-results').innerHTML = '';
  document.getElementById('link-search').value = '';
}

function linkClear() {
  linkUser = null;
  document.getElementById('link-selected').classList.add('hidden');
}

async function handleLinkNfc(uid) {
  if (!linkUser) { gMsg('Select a player first', 'error'); return; }
  await doLink(linkUser.id, uid, linkUser.name + (linkUser.last_name ? ' ' + linkUser.last_name : ''));
}

function linkManual() {
  const uid = document.getElementById('link-manual').value.trim().toUpperCase();
  if (!uid || !linkUser) return;
  doLink(linkUser.id, uid, linkUser.name + (linkUser.last_name ? ' ' + linkUser.last_name : ''));
  document.getElementById('link-manual').value = '';
}

async function doLink(userId, uid, name) {
  try {
    await api(`/users/${userId}`, { method: 'PUT', body: JSON.stringify({ nfc_uid: uid }) });
    gMsg(`Linked ${name} → ${uid}`, 'success');
    addRecent(`Linked ${name} → ${uid}`);
    linkClear();
  } catch (err) { gMsg(err.message, 'error'); }
}

/* ================================================================
   TAB 2: TOP UP
   ================================================================ */
setupSearch('topup-search', 'topup-results', topupSelect);

async function topupSelect(u) {
  topupUser = u;
  const name = u.name + (u.last_name ? ' ' + u.last_name : '');
  document.getElementById('topup-name').textContent = name;
  document.getElementById('topup-nfc-label').textContent = u.nfc_uid || 'No NFC';
  document.getElementById('topup-user').classList.remove('hidden');
  document.getElementById('topup-results').innerHTML = '';
  document.getElementById('topup-search').value = '';
  await refreshBalances();
}

function topupClear() {
  topupUser = null;
  document.getElementById('topup-user').classList.add('hidden');
}

async function handleTopupNfc(uid) {
  try {
    const res = await api('/scan', { method: 'POST', body: JSON.stringify({ nfc_uid: uid }) });
    if (res.user) { topupSelect(res.user); }
  } catch (err) { gMsg(err.message, 'error'); }
}

async function refreshBalances() {
  if (!topupUser) return;
  try {
    const [v, t] = await Promise.all([
      api(`/vouchers/balance/${topupUser.id}`),
      api(`/tix/balance/${topupUser.id}`)
    ]);
    document.getElementById('topup-vouchers').textContent = v.balance ?? 0;
    document.getElementById('topup-tix').textContent = t.balance ?? 0;
  } catch (err) { gMsg(err.message, 'error'); }
}

async function doTopup(type) {
  if (!topupUser) return;
  const inputId = type === 'voucher' ? 'topup-v-amt' : 'topup-t-amt';
  const amt = parseInt(document.getElementById(inputId).value);
  if (!amt || amt <= 0) { gMsg('Enter a positive amount', 'error'); return; }
  try {
    const endpoint = type === 'voucher' ? '/vouchers/topup' : '/tix/adjust';
    await api(endpoint, { method: 'POST', body: JSON.stringify({ user_id: topupUser.id, amount: amt }) });
    gMsg(`Added ${amt} ${type === 'voucher' ? 'vouchers' : 'tix'}`, 'success');
    addRecent(`+${amt} ${type} → ${topupUser.name}`);
    document.getElementById(inputId).value = '';
    await refreshBalances();
  } catch (err) { gMsg(err.message, 'error'); }
}

/* ================================================================
   TAB 3: EVENTS
   ================================================================ */
async function loadEvents() {
  try {
    const res = await api('/events');
    evtList = res.events || [];
    populateEvtDropdowns();
  } catch (err) { /* silent */ }
}

function populateEvtDropdowns() {
  const opts = evtList.map(e =>
    `<option value="${e.id}">${esc(e.name)} (${e.status})</option>`
  );
  const placeholder = '<option value="">-- Select Event --</option>';
  const html = placeholder + opts.join('');
  document.getElementById('evt-select').innerHTML = html;
  document.getElementById('match-evt-select').innerHTML = html;
}

async function evtSelected() {
  const id = document.getElementById('evt-select').value;
  if (!id) { document.getElementById('evt-reg-section').classList.add('hidden'); return; }
  try {
    const res = await api(`/events/${id}`);
    evtDetail = res;
    document.getElementById('evt-info').innerHTML =
      `<span class="font-medium">${esc(res.event.name)}</span> · ${res.event.status} · ${res.participants.length} players`;
    document.getElementById('evt-info').classList.remove('hidden');
    document.getElementById('evt-reg-section').classList.remove('hidden');
    renderParticipants();
  } catch (err) { gMsg(err.message, 'error'); }
}

function renderParticipants() {
  const el = document.getElementById('evt-participants');
  if (!evtDetail || !evtDetail.participants.length) {
    el.innerHTML = '<p class="text-gray-400 italic">No players registered</p>';
    return;
  }
  el.innerHTML = evtDetail.participants.map((p, i) =>
    `<div class="flex justify-between py-1 border-b border-gray-50">
      <span>${i + 1}. ${esc(p.user_name || p.name || 'User #' + p.user_id)}</span>
      <span class="text-gray-400 text-[10px]">${p.nfc_uid || ''}</span>
    </div>`
  ).join('');
}

setupSearch('evt-search', 'evt-search-results', evtRegisterUser);

async function evtRegisterUser(u) {
  const evtId = document.getElementById('evt-select').value;
  if (!evtId) { gMsg('Select an event first', 'error'); return; }
  try {
    await api(`/events/${evtId}/register`, { method: 'POST', body: JSON.stringify({ user_id: u.id }) });
    const name = u.name + (u.last_name ? ' ' + u.last_name : '');
    gMsg(`Registered ${name}`, 'success');
    addRecent(`Registered ${name} → ${evtDetail?.event?.name || 'event'}`);
    document.getElementById('evt-search').value = '';
    document.getElementById('evt-search-results').innerHTML = '';
    await evtSelected();
  } catch (err) { gMsg(err.message, 'error'); }
}

async function handleEventNfc(uid) {
  const evtId = document.getElementById('evt-select').value;
  if (!evtId) { gMsg('Select an event first', 'error'); return; }
  try {
    const res = await api(`/events/${evtId}/register-nfc`, { method: 'POST', body: JSON.stringify({ nfc_uid: uid }) });
    const name = res.user?.name || uid;
    gMsg(`Registered ${name}`, 'success');
    addRecent(`NFC registered ${name} → ${evtDetail?.event?.name || 'event'}`);
    await evtSelected();
  } catch (err) { gMsg(err.message, 'error'); }
}

/* ================================================================
   TAB 4: MATCH REPORTING (reworked UI + edit + refresh + bracket)
   ================================================================ */
async function matchEvtSelected() {
  const id = document.getElementById('match-evt-select').value;
  if (!id) {
    document.getElementById('match-rounds').classList.add('hidden');
    document.getElementById('match-bracket').classList.add('hidden');
    return;
  }
  try {
    const res = await api(`/events/${id}`);
    matchEvtDetail = res;
    matchOutcomes = {};
    matchEditMode = {};
    renderMatches();
    renderBracket();
  } catch (err) { gMsg(err.message, 'error'); }
}

async function matchRefresh() {
  const id = document.getElementById('match-evt-select').value;
  if (!id) return;
  await loadEvents();
  try {
    const res = await api(`/events/${id}`);
    matchEvtDetail = res;
    matchOutcomes = {};
    matchEditMode = {};
    renderMatches();
    renderBracket();
    gMsg('Refreshed!', 'success');
  } catch (err) { gMsg(err.message, 'error'); }
}

function renderMatches() {
  const container = document.getElementById('match-rounds');
  container.classList.remove('hidden');

  if (!matchEvtDetail || !matchEvtDetail.rounds || !matchEvtDetail.rounds.length) {
    container.innerHTML = '<div class="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-400 italic">No rounds yet. Start the event from the admin panel first.</div>';
    return;
  }

  const matches = matchEvtDetail.matches || [];
  const participants = matchEvtDetail.participants || [];
  const pMap = {};
  participants.forEach(p => { pMap[p.user_id] = p.user_name || p.name || `Player #${p.user_id}`; });

  const rounds = matchEvtDetail.rounds;
  container.innerHTML = rounds.map(r => {
    const roundMatches = matches.filter(m => m.round_number === r.round_number);
    return `
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <h3 class="text-sm font-bold text-gray-700 mb-3">Round ${r.round_number}</h3>
        <div class="space-y-3">
          ${roundMatches.map(m => renderMatchCard(m, pMap)).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderMatchCard(m, pMap) {
  const p1 = pMap[m.player1_id] || `#${m.player1_id}`;
  const p2 = m.player2_id ? (pMap[m.player2_id] || `#${m.player2_id}`) : 'BYE';
  const mid = m.id;
  const reported = m.reported && m.player1_wins !== null;
  const editing = matchEditMode[mid];

  // If bye match, show simple display
  if (!m.player2_id) {
    return `<div class="p-3 bg-gray-50 rounded-lg">
      <div class="text-sm text-gray-700">${esc(p1)} <span class="text-gray-400">— BYE</span></div>
    </div>`;
  }

  // Reported match (not editing) — show result + Edit button
  if (reported && !editing) {
    const winner = m.player1_wins > m.player2_wins ? p1 : m.player2_wins > m.player1_wins ? p2 : 'Draw';
    const color = winner === 'Draw' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700';
    return `<div class="p-3 bg-gray-50 rounded-lg">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-700 truncate">${esc(p1)}</div>
          <div class="text-[10px] text-gray-400 my-0.5">vs</div>
          <div class="text-sm font-medium text-gray-700 truncate">${esc(p2)}</div>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          <span class="text-[10px] px-2 py-0.5 rounded-full font-medium ${color}">${winner === 'Draw' ? 'Draw' : esc(winner) + ' wins'}</span>
          <button onclick="enableEditMatch(${mid})" class="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium">Edit</button>
        </div>
      </div>
    </div>`;
  }

  // Unreported or editing — show stacked outcome buttons
  const cur = matchOutcomes[mid] || '';
  return `<div class="p-3 bg-gray-50 rounded-lg">
    ${editing ? '<div class="text-[10px] text-orange-500 font-medium mb-1">Editing result...</div>' : ''}
    <div class="space-y-1.5 mb-2">
      <button onclick="setOutcome(${mid},'p1')"
        class="w-full py-2.5 px-3 rounded-lg text-sm font-semibold transition text-left truncate ${cur === 'p1' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-indigo-50'}">
        ${esc(p1)} wins
      </button>
      <button onclick="setOutcome(${mid},'draw')"
        class="w-full py-2 px-3 rounded-lg text-xs font-semibold transition text-center ${cur === 'draw' ? 'bg-gray-700 text-white' : 'bg-white border border-gray-300 text-gray-500 hover:bg-gray-50'}">
        Draw
      </button>
      <button onclick="setOutcome(${mid},'p2')"
        class="w-full py-2.5 px-3 rounded-lg text-sm font-semibold transition text-left truncate ${cur === 'p2' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-indigo-50'}">
        ${esc(p2)} wins
      </button>
    </div>
    <div class="flex gap-2">
      <button onclick="submitMatch(${mid})" ${!cur ? 'disabled' : ''}
        class="flex-1 py-2 rounded-lg text-xs font-semibold transition ${cur ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}">
        ${editing ? 'Update Result' : 'Save Result'}
      </button>
      ${editing ? `<button onclick="cancelEditMatch(${mid})" class="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-200 text-gray-600 hover:bg-gray-300 transition">Cancel</button>` : ''}
    </div>
  </div>`;
}

function enableEditMatch(matchId) {
  matchEditMode[matchId] = true;
  matchOutcomes[matchId] = '';
  renderMatches();
}

function cancelEditMatch(matchId) {
  delete matchEditMode[matchId];
  delete matchOutcomes[matchId];
  renderMatches();
}

function setOutcome(matchId, outcome) {
  matchOutcomes[matchId] = outcome;
  renderMatches();
}

async function submitMatch(matchId) {
  const outcome = matchOutcomes[matchId];
  if (!outcome) return;
  const body = outcome === 'p1'
    ? { player1_wins: 1, player2_wins: 0, draws: 0 }
    : outcome === 'p2'
    ? { player1_wins: 0, player2_wins: 1, draws: 0 }
    : { player1_wins: 0, player2_wins: 0, draws: 1 };
  try {
    await api(`/events/matches/${matchId}/report`, { method: 'POST', body: JSON.stringify(body) });
    gMsg(matchEditMode[matchId] ? 'Result updated!' : 'Result saved!', 'success');
    addRecent(`Match #${matchId} ${matchEditMode[matchId] ? 'updated' : 'reported'}`);
    delete matchOutcomes[matchId];
    delete matchEditMode[matchId];
    await matchEvtSelected();
  } catch (err) { gMsg(err.message, 'error'); }
}

/* ===== BRACKET VISUALIZATION ===== */
function renderBracket() {
  const container = document.getElementById('match-bracket');
  // Only show bracket for single elimination events
  if (!matchEvtDetail || !matchEvtDetail.rounds || !matchEvtDetail.rounds.length ||
      matchEvtDetail.event?.tournament_structure !== 'single_elimination') {
    container.classList.add('hidden');
    return;
  }

  const matches = matchEvtDetail.matches || [];
  const participants = matchEvtDetail.participants || [];
  const pMap = {};
  participants.forEach(p => { pMap[p.user_id] = p.user_name || p.name || `#${p.user_id}`; });

  const rounds = matchEvtDetail.rounds;
  const totalRounds = rounds.length;
  if (totalRounds < 2) { container.classList.add('hidden'); return; }

  // Build bracket data per round
  const roundData = rounds.map(r => {
    return matches
      .filter(m => m.round_number === r.round_number)
      .map(m => {
        const p1 = pMap[m.player1_id] || '?';
        const p2 = m.player2_id ? (pMap[m.player2_id] || '?') : 'BYE';
        let winner = null;
        if (m.reported && m.player1_wins !== null) {
          winner = m.player1_wins > m.player2_wins ? p1 : m.player2_wins > m.player1_wins ? p2 : 'Draw';
        }
        return { p1, p2, winner };
      });
  });

  // SVG bracket layout
  const matchW = 120, matchH = 40, gapY = 16, gapX = 40, padX = 10, padY = 10;
  const r1count = roundData[0]?.length || 0;
  if (r1count === 0) { container.classList.add('hidden'); return; }

  const svgH = padY * 2 + r1count * (matchH + gapY) - gapY;
  const svgW = padX * 2 + totalRounds * (matchW + gapX) - gapX;

  let svg = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" class="block">`;
  svg += `<style>text{font-family:'Inter',sans-serif;font-size:9px;fill:#374151}.winner{font-weight:700;fill:#4f46e5}.slot{fill:#f9fafb;stroke:#e5e7eb;stroke-width:1;rx:4}</style>`;

  // Calculate match positions per round
  const positions = [];
  for (let ri = 0; ri < totalRounds; ri++) {
    const rd = roundData[ri] || [];
    const count = rd.length;
    // Vertically center each round's matches relative to round 1
    const totalH = count * (matchH + gapY) - gapY;
    const startY = padY + (svgH - padY * 2 - totalH) / 2;
    const x = padX + ri * (matchW + gapX);
    const rpos = [];
    for (let mi = 0; mi < count; mi++) {
      const y = startY + mi * (matchH + gapY);
      rpos.push({ x, y });

      const m = rd[mi];
      // Draw match box
      svg += `<rect x="${x}" y="${y}" width="${matchW}" height="${matchH}" class="slot"/>`;
      // Divider
      svg += `<line x1="${x}" y1="${y + matchH / 2}" x2="${x + matchW}" y2="${y + matchH / 2}" stroke="#e5e7eb" stroke-width="0.5"/>`;
      // Player names
      const p1class = m.winner === m.p1 ? 'winner' : '';
      const p2class = m.winner === m.p2 ? 'winner' : '';
      const p1txt = truncSvg(m.p1, 14);
      const p2txt = truncSvg(m.p2, 14);
      svg += `<text x="${x + 4}" y="${y + 13}" class="${p1class}">${escSvg(p1txt)}</text>`;
      svg += `<text x="${x + 4}" y="${y + matchH / 2 + 13}" class="${p2class}">${escSvg(p2txt)}</text>`;
    }
    positions.push(rpos);
  }

  // Draw connector lines between rounds
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
        svg += `<path d="M${fromX} ${fromY1} H${midX} V${toY} H${toX}" fill="none" stroke="#d1d5db" stroke-width="1"/>`;
        if (i2 < curr.length) {
          const fromY2 = curr[i2].y + matchH / 2;
          svg += `<path d="M${fromX} ${fromY2} H${midX} V${toY} H${toX}" fill="none" stroke="#d1d5db" stroke-width="1"/>`;
        }
      }
    }
  }

  svg += '</svg>';
  container.innerHTML = `<div class="bg-white rounded-xl border border-gray-200 p-3"><h3 class="text-xs font-medium text-gray-500 mb-2">Bracket</h3>${svg}</div>`;
  container.classList.remove('hidden');
}

function truncSvg(s, max) { return s.length > max ? s.slice(0, max - 1) + '…' : s; }
function escSvg(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ================================================================
   TAB 5: STORE MANAGEMENT
   ================================================================ */
async function storeLoadItems() {
  try {
    const res = await api('/store/items');
    const items = res.items || [];
    const el = document.getElementById('store-items-list');
    if (!items.length) { el.innerHTML = '<p class="text-gray-400 italic text-xs">No items yet</p>'; return; }
    el.innerHTML = items.map(it => `
      <div class="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-gray-800 text-sm truncate">${esc(it.name)}</div>
          <div class="text-[10px] text-gray-500">${it.price_tix} tix · Stock: ${it.stock} ${it.active ? '' : '· <span class="text-red-500">Inactive</span>'}</div>
        </div>
        <div class="flex gap-1 shrink-0 ml-2">
          <button onclick="storeEditItem(${it.id})" class="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium px-1">Edit</button>
          <button onclick="storeToggleItem(${it.id}, ${!it.active})" class="text-[10px] ${it.active ? 'text-orange-500' : 'text-green-500'} hover:underline font-medium px-1">${it.active ? 'Disable' : 'Enable'}</button>
        </div>
      </div>
    `).join('');
  } catch (err) { gMsg(err.message, 'error'); }
}

async function storeLoadOrders() {
  try {
    const status = document.getElementById('store-order-filter').value;
    const url = '/store/orders' + (status ? `?status=${status}` : '');
    const res = await api(url);
    const orders = res.orders || [];
    const el = document.getElementById('store-orders-list');
    if (!orders.length) { el.innerHTML = '<p class="text-gray-400 italic text-xs">No orders</p>'; return; }
    el.innerHTML = orders.slice(0, 30).map(o => {
      const userName = (o.user_name || '') + (o.user_last_name ? ' ' + o.user_last_name : '');
      const statusColor = o.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
        o.status === 'reserved' ? 'bg-yellow-100 text-yellow-700' :
        o.status === 'fulfilled' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600';
      return `<div class="p-2 bg-gray-50 rounded-lg">
        <div class="flex items-center justify-between">
          <div class="min-w-0">
            <span class="font-medium text-gray-800 text-xs">${esc(userName)}</span>
            <span class="text-gray-400 text-[10px] ml-1">${esc(o.item_name)} x${o.quantity}</span>
          </div>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor} shrink-0">${o.status}</span>
        </div>
        <div class="flex gap-1 mt-1">
          <span class="text-[10px] text-gray-400">${o.total_tix} tix · ${o.order_type}</span>
          ${o.status === 'confirmed' || o.status === 'reserved' ?
            `<button onclick="storeFulfillOrder(${o.id})" class="text-[10px] text-green-600 hover:underline ml-auto">Fulfill</button>
             <button onclick="storeCancelOrder(${o.id})" class="text-[10px] text-red-500 hover:underline">Cancel</button>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch (err) { gMsg(err.message, 'error'); }
}

function storeShowAdd() {
  storeEditingId = null;
  document.getElementById('store-item-name').value = '';
  document.getElementById('store-item-desc').value = '';
  document.getElementById('store-item-price').value = '';
  document.getElementById('store-item-stock').value = '';
  document.getElementById('store-add-form').classList.remove('hidden');
}
function storeCancelAdd() { document.getElementById('store-add-form').classList.add('hidden'); }

async function storeEditItem(id) {
  try {
    const res = await api(`/store/items/${id}`);
    const it = res.item;
    storeEditingId = id;
    document.getElementById('store-item-name').value = it.name;
    document.getElementById('store-item-desc').value = it.description || '';
    document.getElementById('store-item-price').value = it.price_tix;
    document.getElementById('store-item-stock').value = it.stock;
    document.getElementById('store-add-form').classList.remove('hidden');
  } catch (err) { gMsg(err.message, 'error'); }
}

async function storeSaveItem() {
  const name = document.getElementById('store-item-name').value.trim();
  const desc = document.getElementById('store-item-desc').value.trim();
  const price = parseInt(document.getElementById('store-item-price').value) || 0;
  const stock = parseInt(document.getElementById('store-item-stock').value) || 0;
  if (!name) { gMsg('Name is required', 'error'); return; }
  try {
    if (storeEditingId) {
      await api(`/store/items/${storeEditingId}`, { method: 'PUT', body: JSON.stringify({ name, description: desc, price_tix: price, stock }) });
      gMsg('Item updated', 'success');
    } else {
      await api('/store/items', { method: 'POST', body: JSON.stringify({ name, description: desc, price_tix: price, stock }) });
      gMsg('Item created', 'success');
    }
    storeCancelAdd();
    storeLoadItems();
  } catch (err) { gMsg(err.message, 'error'); }
}

async function storeToggleItem(id, active) {
  try {
    await api(`/store/items/${id}`, { method: 'PUT', body: JSON.stringify({ active }) });
    storeLoadItems();
  } catch (err) { gMsg(err.message, 'error'); }
}

async function storeFulfillOrder(id) {
  try {
    await api(`/store/orders/${id}/fulfill`, { method: 'POST', body: JSON.stringify({}) });
    gMsg('Order fulfilled', 'success');
    storeLoadOrders();
  } catch (err) { gMsg(err.message, 'error'); }
}

async function storeCancelOrder(id) {
  try {
    await api(`/store/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) });
    gMsg('Order cancelled', 'success');
    storeLoadOrders();
    storeLoadItems();
  } catch (err) { gMsg(err.message, 'error'); }
}

function storeRefresh() { storeLoadItems(); storeLoadOrders(); gMsg('Refreshed', 'success'); }

/* ================================================================
   TAB 6: STATISTICS
   ================================================================ */
async function loadStats() {
  try {
    const res = await api('/stats');
    const s = res.stats;
    document.getElementById('stats-content').innerHTML = `
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <h3 class="text-xs font-medium text-gray-500 mb-3">Events</h3>
        <div class="grid grid-cols-3 gap-3">
          <div class="text-center"><p class="text-2xl font-bold text-indigo-600">${s.events.finished}</p><p class="text-[10px] text-gray-500">Finished</p></div>
          <div class="text-center"><p class="text-2xl font-bold text-yellow-500">${s.events.ongoing}</p><p class="text-[10px] text-gray-500">Ongoing</p></div>
          <div class="text-center"><p class="text-2xl font-bold text-green-500">${s.events.open}</p><p class="text-[10px] text-gray-500">Open</p></div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <h3 class="text-xs font-medium text-gray-500 mb-3">Players</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="text-center"><p class="text-2xl font-bold text-gray-800">${s.players.total}</p><p class="text-[10px] text-gray-500">Total Players</p></div>
          <div class="text-center"><p class="text-2xl font-bold text-gray-800">${s.players.total_registrations}</p><p class="text-[10px] text-gray-500">Event Registrations</p></div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <h3 class="text-xs font-medium text-gray-500 mb-3">Vouchers</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="text-center"><p class="text-2xl font-bold text-indigo-600">${s.vouchers.topped_up}</p><p class="text-[10px] text-gray-500">Topped Up</p></div>
          <div class="text-center"><p class="text-2xl font-bold text-red-500">${s.vouchers.used_for_events}</p><p class="text-[10px] text-gray-500">Used for Events</p></div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <h3 class="text-xs font-medium text-gray-500 mb-3">Tix</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="text-center"><p class="text-2xl font-bold text-green-600">${s.tix.given}</p><p class="text-[10px] text-gray-500">Given Out</p></div>
          <div class="text-center"><p class="text-2xl font-bold text-orange-500">${s.tix.spent}</p><p class="text-[10px] text-gray-500">Spent</p></div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <h3 class="text-xs font-medium text-gray-500 mb-3">Store</h3>
        <div class="grid grid-cols-3 gap-3">
          <div class="text-center"><p class="text-2xl font-bold text-blue-600">${s.store.purchases}</p><p class="text-[10px] text-gray-500">Purchases</p></div>
          <div class="text-center"><p class="text-2xl font-bold text-yellow-600">${s.store.active_reservations}</p><p class="text-[10px] text-gray-500">Reservations</p></div>
          <div class="text-center"><p class="text-2xl font-bold text-gray-700">${s.store.purchase_tix_total}</p><p class="text-[10px] text-gray-500">Tix Revenue</p></div>
        </div>
      </div>`;
  } catch (err) { gMsg(err.message, 'error'); }
}
