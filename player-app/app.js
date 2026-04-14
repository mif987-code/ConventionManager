/* ===== Convention Player App ===== */

const API_BASE = '/player';
let token = localStorage.getItem('player_token');
let player = null;
let currentPage = 'home';

// ---- API Helper ----
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---- Toast ----
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2500);
}

// ---- Auth ----
async function loginNfc() {
  if (!('NDEFReader' in window)) {
    toast('Web NFC not supported. Use email login or a compatible browser.', 'error');
    return;
  }
  const btn = document.getElementById('nfc-login-btn');
  btn.disabled = true;
  btn.textContent = 'Waiting for NFC…';
  try {
    const ndef = new NDEFReader();
    await ndef.scan();
    ndef.onreading = async (event) => {
      const uid = event.serialNumber.replace(/:/g, '').toUpperCase();
      try {
        const data = await api('/auth/nfc', { method: 'POST', body: JSON.stringify({ nfc_uid: uid }) });
        token = data.token;
        player = data.player;
        localStorage.setItem('player_token', token);
        enterApp();
      } catch (err) { toast(err.message, 'error'); }
      btn.disabled = false;
      btn.textContent = 'Tap NFC Tag';
    };
    ndef.onreadingerror = () => {
      toast('Could not read NFC tag', 'error');
      btn.disabled = false;
      btn.textContent = 'Tap NFC Tag';
    };
  } catch (err) {
    toast('NFC error: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Tap NFC Tag';
  }
}

async function loginEmail() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  if (!email || !password) { errEl.textContent = 'Enter both email and password'; errEl.classList.remove('hidden'); return; }

  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    token = data.token;
    player = data.player;
    localStorage.setItem('player_token', token);
    enterApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function logout() {
  token = null;
  player = null;
  localStorage.removeItem('player_token');
  document.getElementById('app-shell').classList.remove('active');
  document.getElementById('login-screen').classList.remove('hidden');
}

async function enterApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.add('active');
  navigate('home');
}

// ---- Auto-login on load ----
async function tryAutoLogin() {
  if (!token) return;
  try {
    const data = await api('/me');
    player = data.player;
    enterApp();
  } catch {
    token = null;
    localStorage.removeItem('player_token');
  }
}

// ---- Navigation ----
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.getElementById('event-detail').classList.remove('active');

  const content = document.getElementById('page-content');
  switch (page) {
    case 'home': renderHome(content); break;
    case 'events': renderEvents(content); break;
    case 'store': renderStore(content); break;
    case 'profile': renderProfile(content); break;
  }
}

// ---- Refresh player data ----
async function refreshPlayer() {
  try {
    const data = await api('/me');
    player = data.player;
  } catch { /* ignore */ }
}

// ==========================================
//  HOME PAGE
// ==========================================
async function renderHome(el) {
  await refreshPlayer();
  el.innerHTML = `
    <div class="page-hdr">Welcome, ${esc(player.name)}!</div>
    <div class="balance-bar">
      <div class="bal-card bal-vouchers">
        <div class="bal-label">Vouchers</div>
        <div class="bal-value">${player.voucher_balance}</div>
      </div>
      <div class="bal-card bal-tix">
        <div class="bal-label">Tix</div>
        <div class="bal-value">${player.tix_balance}</div>
      </div>
    </div>
    <div id="home-upcoming"></div>
    <div id="home-recent"></div>
  `;
  // Load upcoming events
  try {
    const data = await api('/upcoming-events');
    const open = data.events || [];
    let html = '<div class="card"><h3 style="font-size:0.9rem;font-weight:700;margin-bottom:10px;">Open Events</h3>';
    if (open.length === 0) html += '<p style="color:var(--text3);font-size:0.85rem;">No open events right now.</p>';
    else open.forEach(ev => {
      html += `<div class="evt-card" onclick="navigate('events')">
        <div class="evt-name">${esc(ev.name)}</div>
        <div class="evt-meta">
          <span class="badge badge-open">Open</span>
          <span class="badge ${ev.tournament_structure === 'single_elimination' ? 'badge-elim' : 'badge-swiss'}">${ev.tournament_structure === 'single_elimination' ? 'Single Elim' : 'Swiss'}</span>
          <span>${ev.participant_count}/${ev.max_players} players</span>
          ${ev.already_registered ? '<span class="badge badge-registered">Registered</span>' : ''}
        </div>
      </div>`;
    });
    html += '</div>';
    document.getElementById('home-upcoming').innerHTML = html;
  } catch { /* ignore */ }

  // Load recent events
  try {
    const data = await api('/events');
    const recent = (data.events || []).slice(0, 3);
    if (recent.length > 0) {
      let html = '<div class="card" style="margin-top:12px"><h3 style="font-size:0.9rem;font-weight:700;margin-bottom:10px;">Recent Results</h3>';
      recent.forEach(ev => {
        html += `<div class="evt-card" onclick="openEventDetail(${ev.event_id})">
          <div class="evt-name">${esc(ev.event_name)}</div>
          <div class="evt-meta">
            <span class="badge badge-${ev.status}">${ev.status}</span>
            <span>${ev.wins}W-${ev.losses}L${ev.draws > 0 ? '-' + ev.draws + 'D' : ''}</span>
            ${ev.result_position ? '<span>#' + ev.result_position + '</span>' : ''}
          </div>
        </div>`;
      });
      html += '</div>';
      document.getElementById('home-recent').innerHTML = html;
    }
  } catch { /* ignore */ }
}

// ==========================================
//  EVENTS PAGE
// ==========================================
let eventsTab = 'upcoming';

async function renderEvents(el) {
  el.innerHTML = `
    <div class="page-hdr">Events</div>
    <div style="display:flex;gap:8px;margin-bottom:14px;">
      <button class="btn btn-sm ${eventsTab === 'upcoming' ? 'btn-accent' : 'btn-outline'}" onclick="eventsTab='upcoming';renderEvents(document.getElementById('page-content'))">Upcoming</button>
      <button class="btn btn-sm ${eventsTab === 'history' ? 'btn-accent' : 'btn-outline'}" onclick="eventsTab='history';renderEvents(document.getElementById('page-content'))">My History</button>
    </div>
    <div id="events-list"></div>
  `;
  const listEl = document.getElementById('events-list');

  if (eventsTab === 'upcoming') {
    try {
      const data = await api('/upcoming-events');
      const events = data.events || [];
      if (events.length === 0) { listEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">No open events.</p>'; return; }
      listEl.innerHTML = events.map(ev => `
        <div class="evt-card">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <div class="evt-name">${esc(ev.name)}</div>
              <div class="evt-meta">
                <span class="badge badge-open">Open</span>
                <span class="badge ${ev.tournament_structure === 'single_elimination' ? 'badge-elim' : 'badge-swiss'}">${ev.tournament_structure === 'single_elimination' ? 'Single Elim' : 'Swiss'}</span>
                <span>${ev.participant_count}/${ev.max_players}</span>
                <span>${ev.entry_cost_vouchers} vouchers</span>
              </div>
            </div>
            ${ev.already_registered
              ? '<span class="badge badge-registered" style="flex-shrink:0">Registered</span>'
              : `<button class="btn btn-accent btn-sm" style="flex-shrink:0" onclick="registerForEvent(${ev.id}, this)">Join</button>`}
          </div>
        </div>
      `).join('');
    } catch (err) { listEl.innerHTML = `<p style="color:var(--red);font-size:0.85rem;">${esc(err.message)}</p>`; }
  } else {
    try {
      const data = await api('/events');
      const events = data.events || [];
      if (events.length === 0) { listEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">No event history yet.</p>'; return; }
      listEl.innerHTML = events.map(ev => `
        <div class="evt-card" onclick="openEventDetail(${ev.event_id})">
          <div class="evt-name">${esc(ev.event_name)}</div>
          <div class="evt-meta">
            <span class="badge badge-${ev.status}">${ev.status}</span>
            <span class="badge ${ev.tournament_structure === 'single_elimination' ? 'badge-elim' : 'badge-swiss'}">${ev.tournament_structure === 'single_elimination' ? 'Single Elim' : 'Swiss'}</span>
            <span>${ev.wins}W-${ev.losses}L${ev.draws > 0 ? '-' + ev.draws + 'D' : ''}</span>
            <span>${ev.match_points} pts</span>
            ${ev.result_position ? `<span>#${ev.result_position}</span>` : ''}
          </div>
        </div>
      `).join('');
    } catch (err) { listEl.innerHTML = `<p style="color:var(--red);font-size:0.85rem;">${esc(err.message)}</p>`; }
  }
}

async function registerForEvent(eventId, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await api(`/events/${eventId}/register`, { method: 'POST' });
    toast('Registered!');
    await refreshPlayer();
    renderEvents(document.getElementById('page-content'));
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Join';
  }
}

// ==========================================
//  EVENT DETAIL
// ==========================================
async function openEventDetail(eventId) {
  const overlay = document.getElementById('event-detail');
  overlay.classList.add('active');
  overlay.innerHTML = '<p style="color:var(--text2);padding:40px;text-align:center;">Loading…</p>';

  try {
    const data = await api(`/events/${eventId}`);
    const ev = data.event;
    const parts = data.participants || [];
    const myMatches = data.my_matches || [];

    let html = `
      <button class="back-btn" onclick="document.getElementById('event-detail').classList.remove('active')">← Back</button>
      <div class="page-hdr">${esc(ev.name)}</div>
      <div class="evt-meta" style="margin-bottom:16px;">
        <span class="badge badge-${ev.status}">${ev.status}</span>
        <span class="badge ${ev.tournament_structure === 'single_elimination' ? 'badge-elim' : 'badge-swiss'}">${ev.tournament_structure === 'single_elimination' ? 'Single Elim' : 'Swiss'}</span>
        ${ev.category ? `<span>${esc(ev.category)}</span>` : ''}
        ${ev.status === 'ongoing' ? `<span>Round ${ev.current_round}/${ev.total_rounds}</span>` : ''}
      </div>
    `;

    // My matches
    if (myMatches.length > 0) {
      html += '<div class="card"><h3 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">My Matches</h3>';
      const pMap = {};
      parts.forEach(p => { pMap[p.user_id] = p.user_name; });
      myMatches.sort((a, b) => a.round_number - b.round_number);
      myMatches.forEach(m => {
        const opp = m.player1_id === player.id ? pMap[m.player2_id] : pMap[m.player1_id];
        let resultText = 'Pending';
        let resultColor = 'var(--text3)';
        if (m.reported) {
          const myWins = m.player1_id === player.id ? m.player1_wins : m.player2_wins;
          const oppWins = m.player1_id === player.id ? m.player2_wins : m.player1_wins;
          if (myWins > oppWins) { resultText = 'Win'; resultColor = 'var(--green)'; }
          else if (oppWins > myWins) { resultText = 'Loss'; resultColor = 'var(--red)'; }
          else { resultText = 'Draw'; resultColor = 'var(--yellow)'; }
        }
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--surface2);font-size:0.85rem;">
          <span style="color:var(--text2)">R${m.round_number}</span>
          <span>vs ${esc(opp || 'BYE')}</span>
          <span style="font-weight:700;color:${resultColor}">${resultText}</span>
        </div>`;
      });
      html += '</div>';
    }

    // Standings
    html += '<div class="card"><h3 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">Standings</h3>';
    html += '<table class="standings-tbl"><thead><tr><th>#</th><th>Player</th><th>W-L-D</th><th>Pts</th></tr></thead><tbody>';
    parts.forEach((p, i) => {
      const isMe = p.user_id === player.id;
      html += `<tr class="${isMe ? 'me' : ''}">
        <td>${i + 1}</td>
        <td style="${isMe ? 'font-weight:700;color:var(--accent-light)' : ''}">${esc(p.user_name)}</td>
        <td>${p.wins}-${p.losses}${p.draws > 0 ? '-' + p.draws : ''}</td>
        <td>${p.match_points}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';

    overlay.innerHTML = html;
  } catch (err) {
    overlay.innerHTML = `<button class="back-btn" onclick="document.getElementById('event-detail').classList.remove('active')">← Back</button>
      <p style="color:var(--red);padding:20px;">${esc(err.message)}</p>`;
  }
}

// ==========================================
//  STORE PAGE
// ==========================================
async function renderStore(el) {
  await refreshPlayer();
  el.innerHTML = `
    <div class="page-hdr">Store</div>
    <div class="balance-bar">
      <div class="bal-card bal-tix">
        <div class="bal-label">Your Tix</div>
        <div class="bal-value">${player.tix_balance}</div>
      </div>
    </div>
    <div id="store-items"><p style="color:var(--text3)">Loading…</p></div>
    <div id="store-orders" style="margin-top:20px"></div>
  `;
  try {
    const data = await api('/store/items');
    const items = data.items || [];
    if (items.length === 0) {
      document.getElementById('store-items').innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">No items available right now.</p>';
    } else {
      document.getElementById('store-items').innerHTML = '<div class="store-grid">' + items.map(item => `
        <div class="store-item">
          <div class="store-item-name">${esc(item.name)}</div>
          <div class="store-item-price">${item.price_tix} tix</div>
          <div class="store-item-stock">${item.stock > 0 ? item.stock + ' in stock' : 'Out of stock'}</div>
          ${item.description ? `<div class="store-item-desc">${esc(item.description)}</div>` : '<div class="store-item-desc"></div>'}
          <button class="btn btn-accent btn-sm" ${item.stock <= 0 || player.tix_balance < item.price_tix ? 'disabled' : ''} onclick="purchaseItem(${item.id}, this)">
            ${item.stock <= 0 ? 'Sold Out' : player.tix_balance < item.price_tix ? 'Not Enough Tix' : 'Buy'}
          </button>
        </div>
      `).join('') + '</div>';
    }
  } catch (err) {
    document.getElementById('store-items').innerHTML = `<p style="color:var(--red);font-size:0.85rem;">${esc(err.message)}</p>`;
  }

  // Load orders
  try {
    const data = await api('/store/orders');
    const orders = data.orders || [];
    if (orders.length > 0) {
      let html = '<div class="card"><h3 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">My Orders</h3>';
      orders.forEach(o => {
        const statusColors = { pending: 'var(--yellow)', fulfilled: 'var(--green)', cancelled: 'var(--red)' };
        html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--surface2);font-size:0.85rem;">
          <span>${esc(o.item_name || 'Item #' + o.item_id)} x${o.quantity}</span>
          <span style="color:${statusColors[o.status] || 'var(--text3)'};font-weight:600">${o.status}</span>
        </div>`;
      });
      html += '</div>';
      document.getElementById('store-orders').innerHTML = html;
    }
  } catch { /* ignore */ }
}

async function purchaseItem(itemId, btn) {
  if (!confirm('Purchase this item?')) return;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await api('/store/purchase', { method: 'POST', body: JSON.stringify({ item_id: itemId }) });
    toast('Purchase successful!');
    await refreshPlayer();
    renderStore(document.getElementById('page-content'));
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Buy';
  }
}

// ==========================================
//  PROFILE PAGE
// ==========================================
async function renderProfile(el) {
  await refreshPlayer();
  el.innerHTML = `
    <div class="page-hdr">Profile</div>
    <div class="balance-bar">
      <div class="bal-card bal-vouchers">
        <div class="bal-label">Vouchers</div>
        <div class="bal-value">${player.voucher_balance}</div>
      </div>
      <div class="bal-card bal-tix">
        <div class="bal-label">Tix</div>
        <div class="bal-value">${player.tix_balance}</div>
      </div>
    </div>
    <div class="card">
      <div class="profile-field"><span class="profile-key">Name</span><span class="profile-val">${esc(player.name)}${player.last_name ? ' ' + esc(player.last_name) : ''}</span></div>
      <div class="profile-field"><span class="profile-key">Email</span><span class="profile-val">${player.email ? esc(player.email) : '—'}</span></div>
      <div class="profile-field"><span class="profile-key">NFC UID</span><span class="profile-val" style="font-family:monospace;font-size:0.8rem;">${player.nfc_uid || '—'}</span></div>
      <div class="profile-field"><span class="profile-key">Days Playing</span><span class="profile-val">${player.days_playing || 1}</span></div>
      <div class="profile-field"><span class="profile-key">Member Since</span><span class="profile-val">${new Date(player.created_at).toLocaleDateString()}</span></div>
    </div>

    <div class="card" style="margin-top:12px">
      <h3 style="font-size:0.85rem;font-weight:700;margin-bottom:10px;">Set / Change Password</h3>
      <input class="login-input" id="new-pass" type="password" placeholder="New password (min 4 chars)">
      <button class="btn btn-accent" onclick="changePassword()">Update Password</button>
    </div>

    <button class="btn btn-outline" style="margin-top:16px;border-color:var(--red);color:var(--red);" onclick="logout()">Sign Out</button>
  `;
}

async function changePassword() {
  const pw = document.getElementById('new-pass').value;
  if (!pw || pw.length < 4) { toast('Password must be at least 4 characters', 'error'); return; }
  try {
    await api('/me/password', { method: 'PUT', body: JSON.stringify({ password: pw }) });
    toast('Password updated!');
    document.getElementById('new-pass').value = '';
  } catch (err) { toast(err.message, 'error'); }
}

// ---- Helpers ----
function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---- Init ----
tryAutoLogin();
