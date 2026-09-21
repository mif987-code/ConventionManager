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
  if (!res.ok) throw new Error(data.error || 'La solicitud falló');
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
    toast('Este dispositivo no admite NFC web. Inicia sesión con tu correo o usa un navegador compatible.', 'error');
    return;
  }
  const btn = document.getElementById('nfc-login-btn');
  btn.disabled = true;
  btn.textContent = 'Esperando etiqueta NFC…';
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
      btn.textContent = 'Acercar etiqueta NFC';
    };
    ndef.onreadingerror = () => {
      toast('No se pudo leer la etiqueta NFC', 'error');
      btn.disabled = false;
      btn.textContent = 'Acercar etiqueta NFC';
    };
  } catch (err) {
    toast('Error de NFC: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Acercar etiqueta NFC';
  }
}

async function loginEmail() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  if (!email || !password) { errEl.textContent = 'Escribe tu correo y contraseña'; errEl.classList.remove('hidden'); return; }

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

function showForgotPassword() {
  document.getElementById('email-login-section').classList.add('hidden');
  document.getElementById('forgot-password-section').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('forgot-password-section').classList.add('hidden');
  document.getElementById('reset-password-section').classList.add('hidden');
  document.getElementById('email-login-section').classList.remove('hidden');
}

async function requestPasswordReset() {
  const email = document.getElementById('forgot-email').value.trim();
  const error = document.getElementById('forgot-error');
  error.classList.add('hidden');
  if (!email) { error.textContent = 'Escribe tu correo electrónico'; error.classList.remove('hidden'); return; }
  try {
    const data = await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    toast(data.message);
    showLogin();
  } catch (err) { error.textContent = err.message; error.classList.remove('hidden'); }
}

async function submitPasswordReset() {
  const resetToken = new URLSearchParams(location.search).get('reset');
  const password = document.getElementById('reset-pass').value;
  const confirmation = document.getElementById('reset-pass-confirm').value;
  const error = document.getElementById('reset-error');
  error.classList.add('hidden');
  if (password.length < 8) { error.textContent = 'La contraseña debe tener al menos 8 caracteres'; error.classList.remove('hidden'); return; }
  if (password !== confirmation) { error.textContent = 'Las contraseñas no coinciden'; error.classList.remove('hidden'); return; }
  try {
    const data = await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, password }) });
    history.replaceState({}, '', location.pathname);
    toast(data.message);
    showLogin();
  } catch (err) { error.textContent = err.message; error.classList.remove('hidden'); }
}

async function configureLogin() {
  const resetToken = new URLSearchParams(location.search).get('reset');
  if (resetToken) {
    document.getElementById('email-login-section').classList.add('hidden');
    document.getElementById('reset-password-section').classList.remove('hidden');
  }
  try {
    const data = await api('/auth/config');
    if (data.scan_mode === 'nfc' && !resetToken) {
      document.getElementById('nfc-login-section').classList.remove('hidden');
      document.getElementById('login-or').classList.remove('hidden');
    }
  } catch { /* ignore */ }
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
let eventsTab = 'upcoming';

function historyCardHtml(ev) {
  return `
    <div class="evt-card" onclick="openEventDetail(${ev.event_id})">
      <div class="evt-name">${esc(ev.event_name)}</div>
      <div class="evt-meta">
        <span class="badge badge-${ev.status}">${statusLabel(ev.status)}</span>
        <span class="badge ${ev.tournament_structure === 'single_elimination' ? 'badge-elim' : 'badge-swiss'}">${ev.tournament_structure === 'single_elimination' ? 'Eliminación directa' : 'Suizo'}</span>
        <span>${ev.wins}G-${ev.losses}P${ev.draws > 0 ? '-' + ev.draws + 'E' : ''}</span>
        ${ev.result_position ? `<span>#${ev.result_position}</span>` : ''}
        ${ev.table_number ? `<span style="background:rgba(74,158,110,0.2);color:#4ade80;padding:1px 6px;border-radius:4px;font-weight:600;">Mesa ${esc(ev.table_number)}</span>` : ''}
      </div>
    </div>`;
}

async function renderEvents(el) {
  el.innerHTML = `
    <div class="page-hdr">Eventos</div>
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
      <button class="btn btn-sm ${eventsTab === 'upcoming' ? 'btn-accent' : 'btn-outline'}" onclick="eventsTab='upcoming';renderEvents(document.getElementById('page-content'))">Próximos</button>
      <button class="btn btn-sm ${eventsTab === 'history' ? 'btn-accent' : 'btn-outline'}" onclick="eventsTab='history';renderEvents(document.getElementById('page-content'))">Mi historial</button>
      <button class="btn btn-sm ${eventsTab === 'recent' ? 'btn-accent' : 'btn-outline'}" onclick="eventsTab='recent';renderEvents(document.getElementById('page-content'))">Resultados recientes</button>
    </div>
    <div id="events-list"></div>
  `;
  const listEl = document.getElementById('events-list');

  if (eventsTab === 'upcoming') {
    try {
      const data = await api('/upcoming-events');
      const events = data.events || [];
      if (events.length === 0) { listEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">No hay eventos abiertos para inscripción en este momento.</p>'; return; }
      listEl.innerHTML = events.map(ev => {
        const cost = ev.entry_cost_colones || 0;
        const costLabel = ev.covered_by_voucher
          ? 'Cubierto por voucher'
          : cost > 0 ? `Entrada: ${formatCRC(cost)}` : 'Entrada gratuita';
        const canAfford = ev.covered_by_voucher || cost <= 0 || (player && player.credit_balance >= cost);
        return `
        <div class="evt-card">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <div class="evt-name">${esc(ev.name)}</div>
              <div class="evt-meta">
                <span class="badge badge-open">Abierto</span>
                ${ev.category ? `<span>${esc(ev.category)}${ev.format ? ' (' + esc(ev.format) + ')' : ''}</span>` : ''}
                <span>${ev.participant_count}${ev.max_players ? '/' + ev.max_players : ''}</span>
              </div>
              <div class="evt-meta" style="margin-top:2px"><span>${costLabel}</span></div>
            </div>
            ${ev.already_registered
              ? `<span class="badge badge-registered" style="flex-shrink:0">${ev.preregistered_by_me ? 'Preinscrito' : 'Inscrito'}</span>`
              : `<button class="btn btn-accent btn-sm" style="flex-shrink:0" ${canAfford ? '' : 'disabled'} onclick="registerForEvent(${ev.id}, this)">${canAfford ? 'Inscribirme' : 'Crédito insuficiente'}</button>`}
          </div>
        </div>`;
      }).join('');
    } catch (err) { listEl.innerHTML = `<p style="color:var(--red);font-size:0.85rem;">${esc(err.message)}</p>`; }
  } else if (eventsTab === 'history') {
    try {
      const data = await api('/events');
      const events = data.events || [];
      if (events.length === 0) { listEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">Aún no tienes historial de eventos.</p>'; return; }
      listEl.innerHTML = events.map(historyCardHtml).join('');
    } catch (err) { listEl.innerHTML = `<p style="color:var(--red);font-size:0.85rem;">${esc(err.message)}</p>`; }
  } else if (eventsTab === 'recent') {
    try {
      const data = await api('/events');
      const events = (data.events || []).filter(ev => ev.status === 'completed').slice(0, 10);
      if (events.length === 0) { listEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">Aún no hay eventos finalizados.</p>'; return; }
      listEl.innerHTML = events.map(historyCardHtml).join('');
    } catch (err) { listEl.innerHTML = `<p style="color:var(--red);font-size:0.85rem;">${esc(err.message)}</p>`; }
  }
}

async function registerForEvent(eventId, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await api(`/events/${eventId}/register`, { method: 'POST' });
    toast('¡Inscripción completada!');
    await refreshPlayer();
    renderEvents(document.getElementById('page-content'));
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Inscribirme';
  }
}

async function togglePreregistration(eventId, isRegistered, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    if (isRegistered) {
      await api(`/preregistrations/${eventId}`, { method: 'DELETE' });
      toast('Preinscripción cancelada');
    } else {
      await api(`/preregistrations/${eventId}`, { method: 'POST' });
      toast('¡Preinscripción completada!');
    }
    renderEvents(document.getElementById('page-content'));
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = isRegistered ? 'Cancelar' : 'Preinscribirme';
  }
}

// ==========================================
//  EVENT DETAIL
// ==========================================
async function openEventDetail(eventId) {
  const overlay = document.getElementById('event-detail');
  overlay.classList.add('active');
  overlay.innerHTML = '<p style="color:var(--text2);padding:40px;text-align:center;">Cargando…</p>';

  try {
    const data = await api(`/events/${eventId}`);
    const ev = data.event;
    const parts = data.participants || [];
    const myMatches = data.my_matches || [];

    let html = `
      <button class="back-btn" onclick="document.getElementById('event-detail').classList.remove('active')">← Volver</button>
      <div class="page-hdr">${esc(ev.name)}</div>
      <div class="evt-meta" style="margin-bottom:16px;">
        <span class="badge badge-${ev.status}">${statusLabel(ev.status)}</span>
        <span class="badge ${ev.tournament_structure === 'single_elimination' ? 'badge-elim' : 'badge-swiss'}">${ev.tournament_structure === 'single_elimination' ? 'Eliminación directa' : 'Suizo'}</span>
        ${ev.category ? `<span>${esc(ev.category)}</span>` : ''}
        ${ev.status === 'ongoing' ? `<span>Ronda ${ev.current_round}/${ev.total_rounds}</span>` : ''}
      </div>
    `;

    // My matches
    if (myMatches.length > 0) {
      html += '<div class="card"><h3 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">Mis partidas</h3>';
      const pMap = {};
      parts.forEach(p => { pMap[p.user_id] = p.user_name; });
      myMatches.sort((a, b) => a.round_number - b.round_number);
      myMatches.forEach(m => {
        const opp = m.player1_id === player.id ? pMap[m.player2_id] : pMap[m.player1_id];
        let resultText = 'Pendiente';
        let resultColor = 'var(--text3)';
        if (m.reported) {
          const myWins = m.player1_id === player.id ? m.player1_wins : m.player2_wins;
          const oppWins = m.player1_id === player.id ? m.player2_wins : m.player1_wins;
          if (myWins > oppWins) { resultText = 'Victoria'; resultColor = 'var(--green)'; }
          else if (oppWins > myWins) { resultText = 'Derrota'; resultColor = 'var(--red)'; }
          else { resultText = 'Empate'; resultColor = 'var(--yellow)'; }
        }
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--surface2);font-size:0.85rem;">
          <span style="color:var(--text2)">R${m.round_number}</span>
          <span>vs. ${esc(opp || 'DESCANSO')}</span>
          <span style="font-weight:700;color:${resultColor}">${resultText}</span>
        </div>`;
      });
      html += '</div>';
    }

    // Standings
    html += '<div class="card"><h3 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">Clasificación</h3>';
    html += '<table class="standings-tbl"><thead><tr><th>#</th><th>Jugador</th><th>G-P-E</th><th>Pts.</th></tr></thead><tbody>';
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
    overlay.innerHTML = `<button class="back-btn" onclick="document.getElementById('event-detail').classList.remove('active')">← Volver</button>
      <p style="color:var(--red);padding:20px;">${esc(err.message)}</p>`;
  }
}

// ==========================================
//  STORE PAGE
// ==========================================
let storeTab = 'items';

async function renderStore(el) {
  el.innerHTML = `
    <div class="page-hdr">Tienda</div>
    ${comingSoonHtml()}
  `;
}

async function purchaseItem(itemId, btn) {
  if (!confirm('¿Comprar este artículo?')) return;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await api('/store/purchase', { method: 'POST', body: JSON.stringify({ item_id: itemId }) });
    toast('¡Compra completada!');
    await refreshPlayer();
    renderStore(document.getElementById('page-content'));
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Comprar';
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
    <div class="page-hdr">Perfil</div>
    <div class="balance-bar">
      <div class="bal-card bal-vouchers">
        <div class="bal-label">Vales</div>
        <div class="bal-value">${player.voucher_balance}</div>
      </div>
      <div class="bal-card bal-tix">
        <div class="bal-label">Tix</div>
        <div class="bal-value">${player.tix_balance}</div>
      </div>
      <div class="bal-card" style="background:linear-gradient(135deg,#dbeafe,#eff6ff);border-left:3px solid #2563eb;position:relative;">
        <div class="bal-label" style="color:#1d4ed8">Crédito</div>
        <div class="bal-value" style="color:#1e40af">${formatCRC(player.credit_balance || 0)}</div>
        <button onclick="toggleCreditPurchase()" class="btn btn-sm" style="margin-top:6px;padding:3px 8px;font-size:0.7rem;background:#2563eb;color:#fff;border-radius:6px;width:100%;font-weight:600;">
          + Recargar crédito
        </button>
      </div>
    </div>

    <div id="credit-purchase-box" class="card" style="display:none;margin-bottom:12px;border:1px solid #bfdbfe;background:#f8faff;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 style="font-size:0.85rem;font-weight:700;color:#1e40af;">Comprar crédito</h3>
        <button onclick="toggleCreditPurchase()" style="background:none;border:none;color:var(--text2);font-size:1.1rem;cursor:pointer;">&times;</button>
      </div>
      <p style="font-size:0.75rem;color:var(--text2);margin-bottom:10px;">Recarga el saldo de tu cuenta en colones costarricenses (CRC) para inscribirte en eventos.</p>
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        ${[5000, 10000, 20000, 30000].map(amt => `
          <button type="button" onclick="document.getElementById('purchase-amount').value = ${amt}" class="btn btn-sm btn-outline" style="flex:1;padding:4px 8px;font-size:0.75rem;">
            ₡${amt.toLocaleString('es-CR')}
          </button>
        `).join('')}
      </div>
      <input class="login-input" id="purchase-amount" type="number" placeholder="Monto en CRC (ej. 5000)" min="1" style="margin-bottom:8px;">
      <button class="btn btn-accent" onclick="purchaseCredits()">Continuar al pago</button>
    </div>

    ${(player.credit_history && player.credit_history.length > 0) ? `
    <div class="card" style="margin-bottom:12px;">
      <h3 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">Historial de crédito</h3>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;">
        ${player.credit_history.map(t => {
          const isPos = t.amount_colones > 0;
          return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg3);border-radius:6px;border:1px solid var(--border);font-size:0.8rem;">
            <div>
              <div style="font-weight:600;color:${isPos ? 'var(--green)' : 'var(--text)'};">
                ${isPos ? '+' : ''}${formatCRC(t.amount_colones)}
              </div>
              <div style="font-size:0.7rem;color:var(--text2);margin-top:1px;">
                ${esc(t.reason || t.event_name || (isPos ? 'Recarga' : 'Entrada a evento'))}
                ${t.created_at ? ` · ${new Date(t.created_at).toLocaleDateString('es-CR')}` : ''}
              </div>
            </div>
            <span class="badge ${isPos ? 'badge-open' : 'badge-registered'}" style="font-size:0.65rem;text-transform:capitalize;">
              ${esc(t.type || (isPos ? 'Depósito' : 'Pago'))}
            </span>
          </div>`;
        }).join('')}
      </div>
    </div>
    ` : ''}

    ${(player.special_vouchers && player.special_vouchers.length > 0) ? `
    <div class="card" style="margin-bottom:12px;">
      <h3 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">Vouchers especiales</h3>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${player.special_vouchers.map(sv => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg3);border-radius:8px;border:1px solid var(--border);">
            <div>
              <div style="font-weight:600;font-size:0.85rem;">${esc(sv.name)}</div>
              <div style="font-size:0.75rem;color:var(--text2);margin-top:2px;">
                ${sv.category ? `<span>${esc(sv.category)}${sv.format ? ' · ' + esc(sv.format) : ''}</span>` : '<span>General</span>'}
                ${sv.description ? ` · <span>${esc(sv.description)}</span>` : ''}
              </div>
            </div>
            <span class="badge badge-open" style="font-size:0.7rem;padding:2px 8px;">Activo</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    ${(player.merchandise && player.merchandise.length > 0) ? `
    <div class="card" style="margin-bottom:12px;">
      <h3 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">Mercancía incluida en paquetes</h3>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${player.merchandise.map(m => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg3);border-radius:8px;border:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:10px;">
              ${m.image_url ? `
                <img src="${esc(m.image_url)}" alt="${esc(m.item_name)}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;border:1px solid var(--border);background:#fff;">
              ` : ''}
              <div>
                <div style="font-weight:600;font-size:0.85rem;${m.is_claimed ? 'text-decoration:line-through;color:var(--text2);' : ''}">${esc(m.item_name)}</div>
                <div style="font-size:0.75rem;color:var(--text2);margin-top:2px;">
                  ${m.is_claimed && m.claimed_at ? `Retirado el ${new Date(m.claimed_at).toLocaleDateString('es-CR')}` : 'Retirar en la mesa de organización'}
                </div>
              </div>
            </div>
            <span class="badge ${m.is_claimed ? 'badge-completed' : 'badge-open'}" style="font-size:0.7rem;padding:2px 8px;">
              ${m.is_claimed ? 'Retirado' : 'Listo para retirar'}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    <div class="card">
      <div class="profile-field"><span class="profile-key">Nombre</span><span class="profile-val">${esc(player.name)}${player.last_name ? ' ' + esc(player.last_name) : ''}</span></div>
      <div class="profile-field"><span class="profile-key">Correo electrónico</span><span class="profile-val">${player.email ? esc(player.email) : '—'}</span></div>
      ${convention?.scan_mode === 'nfc' ? `<div class="profile-field"><span class="profile-key">Identificador NFC</span><span class="profile-val" style="font-family:monospace;font-size:0.8rem;">${player.nfc_uid || '—'}</span></div>` : ''}
      <div class="profile-field"><span class="profile-key">Días de participación</span><span class="profile-val">${player.days_playing || 1}</span></div>
      <div class="profile-field"><span class="profile-key">Miembro desde</span><span class="profile-val">${new Date(player.created_at).toLocaleDateString('es-CR')}</span></div>
    </div>

    ${player.qr_code ? `
    <div class="card" style="margin-top:12px">
      <h3 style="font-size:0.85rem;font-weight:700;margin-bottom:10px;">Tu código QR</h3>
      <div style="display:flex;justify-content:center;align-items:center;flex-direction:column;gap:12px;">
        <img src="${player.qr_code}" alt="QR Code" style="width:150px;height:150px;border:4px solid #fff;border-radius:8px;">
        <button class="btn btn-sm btn-outline" onclick="regenerateQrCode()">Regenerar código QR</button>
      </div>
    </div>
    ` : ''}

    <div class="card" style="margin-top:12px">
      <h3 style="font-size:0.85rem;font-weight:700;margin-bottom:10px;">Establecer o cambiar contraseña</h3>
      <input class="login-input" id="new-pass" type="password" placeholder="Nueva contraseña (mínimo 8 caracteres)">
      <button class="btn btn-accent" onclick="changePassword()">Actualizar contraseña</button>
    </div>

    <button class="btn btn-outline" style="margin-top:16px;border-color:var(--red);color:var(--red);" onclick="logout()">Cerrar sesión</button>
  `;
}

function toggleCreditPurchase() {
  const box = document.getElementById('credit-purchase-box');
  if (!box) return;
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
  if (box.style.display === 'block') {
    box.scrollIntoView({ behavior: 'smooth' });
    const input = document.getElementById('purchase-amount');
    if (input) input.focus();
  }
}

async function regenerateQrCode() {
  if (!confirm('¿Regenerar tu código QR? El código anterior dejará de funcionar.')) return;
  try {
    await api('/regenerate-qr', { method: 'POST' });
    toast('¡Código QR regenerado correctamente!');
    await refreshPlayer();
    renderProfile(document.getElementById('page-content'));
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function purchaseCredits() {
  const amountInput = document.getElementById('purchase-amount');
  const amount = parseInt(amountInput?.value);
  if (!amount || amount <= 0) {
    toast('Escribe un monto válido en CRC', 'error');
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
      toast(`¡Pago creado! Redirigiendo al proceso de pago...`);
      window.open(data.paymentUrl, '_blank');
    } else {
      toast('No se pudo crear el pago: ' + (data.error || 'Error desconocido'), 'error');
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function changePassword() {
  const pw = document.getElementById('new-pass').value;
  if (!pw || pw.length < 8) { toast('La contraseña debe tener al menos 8 caracteres', 'error'); return; }
  try {
    await api('/me/password', { method: 'PUT', body: JSON.stringify({ password: pw }) });
    toast('¡Contraseña actualizada!');
    document.getElementById('new-pass').value = '';
  } catch (err) { toast(err.message, 'error'); }
}

// ==========================================
//  COLLECTION PAGE
// ==========================================
async function renderCollection(el) {
  el.innerHTML = `<div class="page-hdr">Colección</div>${comingSoonHtml()}`;
}

function renderCollectibleCard(c, earned) {
  const imgContent = c.image_url
    ? `<img src="${esc(c.image_url)}" alt="${esc(c.name)}">`
    : `<div class="coll-placeholder">⭐</div>`;
  return `
    <div class="coll-item" title="${esc(c.description || c.name)}">
      <div class="coll-img-wrap ${earned ? 'earned' : 'locked'}">${imgContent}</div>
      <span class="coll-name ${earned ? 'earned' : ''}">${esc(c.name)}</span>
      ${earned ? `<span class="coll-earned-tag">Obtenido</span>` : `<span style="font-size:0.6rem;color:var(--text3);">${unlockHint(c)}</span>`}
    </div>`;
}

function unlockHint(c) {
  if (c.unlock_type === 'manual') return 'Premio especial';
  if (c.unlock_type === 'event_count') return `Juega ${c.unlock_threshold} evento(s)`;
  if (c.unlock_type === 'category') return `${c.unlock_threshold}× ${esc(c.unlock_value || '')}`;
  if (c.unlock_type === 'event_type') return `${c.unlock_threshold}× evento específico`;
  if (c.unlock_type === 'crc_cost') return `Costo: ${formatCRC(c.unlock_threshold)}`;
  return '';
}

// ---- Helpers ----
function statusLabel(status) {
  return ({ open: 'Abierto', ongoing: 'En curso', finished: 'Finalizado', completed: 'Completado', cancelled: 'Cancelado' })[status] || status;
}

function comingSoonHtml() {
  return '<div class="card" style="text-align:center;color:var(--text2);padding:32px 16px;">Disponible próximamente</div>';
}

function formatCRC(amount) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(amount);
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ---- Init ----
configureLogin();
if (!new URLSearchParams(location.search).get('reset')) tryAutoLogin();
