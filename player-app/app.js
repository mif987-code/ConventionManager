/* ===== Convention Player App ===== */

const API_BASE = '/player';
let token = localStorage.getItem('player_token');
let player = null;
let currentPage = 'profile';
let convention = null;

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
  navigate('profile');
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
    case 'events': renderEvents(content); break;
    case 'store': renderStore(content); break;
    case 'profile': renderProfile(content); break;
    case 'collection': renderCollection(content); break;
  }
}

// ---- Refresh player data ----
async function refreshPlayer() {
  try {
    const data = await api('/me');
    player = data.player;
    convention = data.convention || null;
  } catch { /* ignore */ }
}

// ==========================================
//  EVENTS PAGE
// ==========================================
let eventsTab = 'preregistered';

function comingSoonHtml() {
  return '<p style="color:var(--text3);font-size:0.85rem;text-align:center;padding:24px 0;">Coming Soon</p>';
}

async function renderEvents(el) {
  el.innerHTML = `
    <div class="page-hdr">Events</div>
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
      <button class="btn btn-sm ${eventsTab === 'preregistered' ? 'btn-accent' : 'btn-outline'}" onclick="eventsTab='preregistered';renderEvents(document.getElementById('page-content'))">Preregistered</button>
      <button class="btn btn-sm ${eventsTab === 'upcoming' ? 'btn-accent' : 'btn-outline'}" onclick="eventsTab='upcoming';renderEvents(document.getElementById('page-content'))">Upcoming</button>
      <button class="btn btn-sm ${eventsTab === 'history' ? 'btn-accent' : 'btn-outline'}" onclick="eventsTab='history';renderEvents(document.getElementById('page-content'))">My History</button>
      <button class="btn btn-sm ${eventsTab === 'recent' ? 'btn-accent' : 'btn-outline'}" onclick="eventsTab='recent';renderEvents(document.getElementById('page-content'))">Recent Results</button>
    </div>
    <div id="events-list"></div>
  `;
  const listEl = document.getElementById('events-list');

  if (eventsTab === 'upcoming') {
    listEl.innerHTML = comingSoonHtml();
  } else if (eventsTab === 'preregistered') {
    try {
      const data = await api('/preregistrations');
      const events = data.events || [];
      if (events.length === 0) { listEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">No events open for pre-registration yet.</p>'; return; }
      listEl.innerHTML = events.map(ev => {
        const schedule = [
          ev.schedule_day,
          ev.start_time ? ev.start_time.slice(0, 5) + (ev.end_time ? ' - ' + ev.end_time.slice(0, 5) : '') : null,
          ev.track,
        ].filter(Boolean).join(' • ');
        return `
        <div class="evt-card">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <div class="evt-name">${esc(ev.name)}</div>
              <div class="evt-meta">
                ${ev.category ? `<span>${esc(ev.category)}${ev.format ? ' (' + esc(ev.format) + ')' : ''}</span>` : ''}
                <span>${ev.preregistered_count}${ev.max_players ? '/' + ev.max_players : ''}</span>
              </div>
              ${schedule ? `<div class="evt-meta" style="margin-top:4px;color:var(--accent-light);">${esc(schedule)}</div>` : ''}
            </div>
            ${ev.preregistered_by_me
              ? `<button class="btn btn-outline btn-sm" style="flex-shrink:0;border-color:var(--red);color:var(--red);" onclick="togglePreregistration(${ev.id}, true, this)">Cancel</button>`
              : `<button class="btn btn-accent btn-sm" style="flex-shrink:0" onclick="togglePreregistration(${ev.id}, false, this)">Pre-register</button>`}
          </div>
        </div>
      `;
      }).join('');
    } catch (err) { listEl.innerHTML = `<p style="color:var(--red);font-size:0.85rem;">${esc(err.message)}</p>`; }
  } else if (eventsTab === 'history') {
    listEl.innerHTML = comingSoonHtml();
  } else if (eventsTab === 'recent') {
    listEl.innerHTML = comingSoonHtml();
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

async function togglePreregistration(eventId, isRegistered, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    if (isRegistered) {
      await api(`/preregistrations/${eventId}`, { method: 'DELETE' });
      toast('Pre-registration cancelled');
    } else {
      await api(`/preregistrations/${eventId}`, { method: 'POST' });
      toast('Pre-registered!');
    }
    renderEvents(document.getElementById('page-content'));
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = isRegistered ? 'Cancel' : 'Pre-register';
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
let storeTab = 'items';

async function renderStore(el) {
  el.innerHTML = `
    <div class="page-hdr">Store</div>
    ${comingSoonHtml()}
  `;
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
    ${convention ? `<div style="margin-bottom:12px;padding:8px 12px;background:var(--surface);border-radius:8px;font-size:0.8rem;color:var(--text2);">
      <span style="font-weight:600">${esc(convention.name)}</span>
    </div>` : ''}
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

    ${player.qr_code ? `
    <div class="card" style="margin-top:12px">
      <h3 style="font-size:0.85rem;font-weight:700;margin-bottom:10px;">Your QR Code</h3>
      <div style="display:flex;justify-content:center;align-items:center;flex-direction:column;gap:12px;">
        <img src="${player.qr_code}" alt="QR Code" style="width:150px;height:150px;border:4px solid #fff;border-radius:8px;">
        <button class="btn btn-sm btn-outline" onclick="regenerateQrCode()">Regenerate QR Code</button>
      </div>
    </div>
    ` : ''}

    <div class="card" style="margin-top:12px">
      <h3 style="font-size:0.85rem;font-weight:700;margin-bottom:10px;">Purchase Vouchers</h3>
      <input class="login-input" id="purchase-amount" type="number" placeholder="Amount" min="1" style="margin-bottom:8px;">
      <button class="btn btn-accent" onclick="purchaseVouchers()">Purchase</button>
    </div>

    <div class="card" style="margin-top:12px">
      <h3 style="font-size:0.85rem;font-weight:700;margin-bottom:10px;">Set / Change Password</h3>
      <input class="login-input" id="new-pass" type="password" placeholder="New password (min 4 chars)">
      <button class="btn btn-accent" onclick="changePassword()">Update Password</button>
    </div>

    <button class="btn btn-outline" style="margin-top:16px;border-color:var(--red);color:var(--red);" onclick="logout()">Sign Out</button>
  `;
}

async function regenerateQrCode() {
  if (!confirm('Regenerate your QR code? Your old QR code will no longer work.')) return;
  try {
    await api('/regenerate-qr', { method: 'POST' });
    toast('QR code regenerated successfully!');
    await refreshPlayer();
    renderProfile(document.getElementById('page-content'));
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function purchaseVouchers() {
  const amountInput = document.getElementById('purchase-amount');
  const amount = parseInt(amountInput?.value);
  if (!amount || amount <= 0) {
    toast('Please enter a valid amount', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-convention-id': localStorage.getItem('convention_id') || '',
      },
      body: JSON.stringify({ userId: player.id, amount }),
    });

    const data = await response.json();
    if (data.success) {
      toast(`Payment created! Complete payment at: ${data.paymentUrl}`);
      // In real implementation, open paymentUrl in a new tab
      window.open(data.paymentUrl, '_blank');
    } else {
      toast('Payment creation failed', 'error');
    }
  } catch (err) {
    toast(err.message, 'error');
  }
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

// ==========================================
//  COLLECTION PAGE
// ==========================================
async function renderCollection(el) {
  el.innerHTML = `<div class="page-hdr">Collection</div>${comingSoonHtml()}`;
}

function renderCollectibleCard(c, earned) {
  const imgContent = c.image_url
    ? `<img src="${esc(c.image_url)}" alt="${esc(c.name)}">`
    : `<div class="coll-placeholder">⭐</div>`;
  return `
    <div class="coll-item" title="${esc(c.description || c.name)}">
      <div class="coll-img-wrap ${earned ? 'earned' : 'locked'}">${imgContent}</div>
      <span class="coll-name ${earned ? 'earned' : ''}">${esc(c.name)}</span>
      ${earned ? `<span class="coll-earned-tag">Earned</span>` : `<span style="font-size:0.6rem;color:var(--text3);">${unlockHint(c)}</span>`}
    </div>`;
}

function unlockHint(c) {
  if (c.unlock_type === 'manual') return 'Special award';
  if (c.unlock_type === 'event_count') return `Play ${c.unlock_threshold} event(s)`;
  if (c.unlock_type === 'category') return `${c.unlock_threshold}× ${esc(c.unlock_value || '')}`;
  if (c.unlock_type === 'event_type') return `${c.unlock_threshold}× specific event`;
  return '';
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
