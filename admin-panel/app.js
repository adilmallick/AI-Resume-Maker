/* ============================================================
   Career Vault — Admin Panel  |  app.js
   Communicates exclusively via /admin/* endpoints using
   the X-Admin-Secret header.  No user credentials stored.
   ============================================================ */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
let API_BASE = '';
let ADMIN_SECRET = '';
let APP_URL = '';
let allUsers = [];
let currentFilter = 'all';
let currentModalUserId = null;

// ── Persistence ───────────────────────────────────────────────────────────────
function saveSession() {
  sessionStorage.setItem('cv_admin_base',   API_BASE);
  sessionStorage.setItem('cv_admin_secret', ADMIN_SECRET);
  sessionStorage.setItem('cv_admin_app',    APP_URL);
}
function loadSession() {
  API_BASE     = sessionStorage.getItem('cv_admin_base')   || '';
  ADMIN_SECRET = sessionStorage.getItem('cv_admin_secret') || '';
  APP_URL      = sessionStorage.getItem('cv_admin_app')    || '';
}

// ── API helper ────────────────────────────────────────────────────────────────
async function api(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function doLogin() {
  const urlInput = document.getElementById('api-url');
  const secretInput = document.getElementById('admin-secret');
  const errEl = document.getElementById('login-error');
  const spinner = document.getElementById('login-spinner');
  const btnText = document.querySelector('#login-btn .btn-text');

  API_BASE     = urlInput.value.trim().replace(/\/$/, '');
  ADMIN_SECRET = secretInput.value.trim();
  APP_URL      = (document.getElementById('app-url').value || '').trim().replace(/\/$/, '') || API_BASE.replace(':8000', ':3000');

  errEl.classList.add('hidden');
  spinner.classList.remove('hidden');
  btnText.textContent = 'Authenticating…';

  try {
    // Validate by hitting /admin/stats — if forbidden it throws
    await api('/admin/stats');
    saveSession();
    document.getElementById('topbar-api').textContent = API_BASE;
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    document.getElementById('status-dot').classList.add('ok');
    document.getElementById('status-text').textContent = 'Connected';
    await refreshAll();
  } catch (e) {
    errEl.textContent = e.message.includes('403') || e.message.includes('Forbidden')
      ? 'Invalid admin secret.'
      : `Connection failed: ${e.message}`;
    errEl.classList.remove('hidden');
    document.getElementById('status-dot').classList.add('err');
  } finally {
    spinner.classList.add('hidden');
    btnText.textContent = 'Authenticate';
  }
}

function doLogout() {
  sessionStorage.clear();
  allUsers = [];
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('admin-secret').value = '';
}

// Enter key submits login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').classList.contains('active')) {
    doLogin();
  }
});

// ── Navigation ────────────────────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.getElementById(`nav-${name}`).classList.add('active');

  const titles = {
    dashboard: ['Dashboard', 'Platform overview'],
    users: ['Users', 'All registered accounts'],
    settings: ['Settings', 'LLM provider configuration'],
  };
  document.getElementById('page-title').textContent = titles[name][0];
  document.getElementById('page-sub').textContent = titles[name][1];

  if (name === 'settings') loadProviderConfig();
}

// ── Refresh all ───────────────────────────────────────────────────────────────
async function refreshAll() {
  const btn = document.getElementById('refresh-btn');
  btn.textContent = '↺ Refreshing…';
  btn.disabled = true;
  try {
    await Promise.all([loadStats(), loadUsers()]);
  } finally {
    btn.textContent = '↺ Refresh';
    btn.disabled = false;
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const s = await api('/admin/stats');
    const grid = document.getElementById('stats-grid');
    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-value stat-accent">${s.total_users}</div>
        <div class="stat-label">Total Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-value stat-green">${s.active_users}</div>
        <div class="stat-label">Active Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🚫</div>
        <div class="stat-value stat-red">${s.inactive_users}</div>
        <div class="stat-label">Inactive Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💼</div>
        <div class="stat-value stat-amber">${s.total_experiences}</div>
        <div class="stat-label">Experiences</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🚀</div>
        <div class="stat-value stat-accent">${s.total_projects}</div>
        <div class="stat-label">Projects</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🛠️</div>
        <div class="stat-value">${s.total_skills}</div>
        <div class="stat-label">Skills Logged</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-value stat-green">${s.total_applications}</div>
        <div class="stat-label">Job Applications</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📄</div>
        <div class="stat-value stat-accent">${s.total_resumes}</div>
        <div class="stat-label">Resumes Generated</div>
      </div>
    `;
  } catch (e) {
    showToast('Failed to load stats: ' + e.message, 'error');
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  const loading = document.getElementById('users-loading');
  const empty = document.getElementById('users-empty');

  loading.classList.remove('hidden');
  tbody.innerHTML = '';
  empty.classList.add('hidden');

  try {
    allUsers = await api('/admin/users');
    renderRecentUsers(allUsers.slice(0, 5));
    renderUsersTable();
  } catch (e) {
    showToast('Failed to load users: ' + e.message, 'error');
  } finally {
    loading.classList.add('hidden');
  }
}

function renderRecentUsers(users) {
  const el = document.getElementById('recent-users-list');
  if (!users.length) { el.innerHTML = '<p class="muted">No users yet.</p>'; return; }
  el.innerHTML = users.map(u => `
    <div class="list-item" onclick="openModal('${u.id}')">
      <div>
        <div class="list-item-name">${u.first_name || ''} ${u.last_name || ''}</div>
        <div class="list-item-email">${u.email}</div>
      </div>
      <span class="status-badge ${u.is_active ? 'status-active' : 'status-inactive'}">
        ${u.is_active ? '● Active' : '○ Inactive'}
      </span>
    </div>
  `).join('');
}

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`filter-${f}`).classList.add('active');
  renderUsersTable();
}

function filterUsers() { renderUsersTable(); }

function renderUsersTable() {
  const q = document.getElementById('user-search').value.toLowerCase();
  const tbody = document.getElementById('users-tbody');
  const empty = document.getElementById('users-empty');

  let filtered = allUsers.filter(u => {
    if (currentFilter === 'active' && !u.is_active) return false;
    if (currentFilter === 'inactive' && u.is_active) return false;
    if (q) {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      const email = u.email.toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td>
        <div class="user-cell">
          <span class="user-name">${u.first_name || '—'} ${u.last_name || ''}</span>
          <span class="user-email">${u.email}</span>
        </div>
      </td>
      <td>
        <span class="status-badge ${u.is_active ? 'status-active' : 'status-inactive'}">
          ${u.is_active ? '● Active' : '○ Inactive'}
        </span>
      </td>
      <td>${fmtDate(u.created_at)}</td>
      <td>${u.ai_credits ?? '—'}</td>
      <td>${u.experience_count}</td>
      <td>${u.project_count}</td>
      <td>${u.application_count}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-xs btn-secondary" onclick="openModal('${u.id}')">View</button>
          <button class="btn btn-xs btn-accent" onclick="quickLogin('${u.id}', event)">⚡ Login</button>
          <button class="btn btn-xs ${u.is_active ? 'btn-danger' : 'btn-secondary'}"
            onclick="quickToggle('${u.id}', event)">
            ${u.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function quickToggle(userId, e) {
  e.stopPropagation();
  try {
    const res = await api(`/admin/users/${userId}/toggle-active`, { method: 'PATCH' });
    const u = allUsers.find(x => x.id === userId);
    if (u) u.is_active = res.is_active;
    renderUsersTable();
    renderRecentUsers(allUsers.slice(0, 5));
    showToast(res.message, 'success');
  } catch (e) {
    showToast('Toggle failed: ' + e.message, 'error');
  }
}

async function quickLogin(userId, e) {
  e.stopPropagation();
  try {
    const res = await api(`/admin/users/${userId}/impersonate`, { method: 'POST' });
    const bridgeUrl = `impersonate.html`
      + `?token=${encodeURIComponent(res.access_token)}`
      + `&email=${encodeURIComponent(res.email)}`
      + `&id=${encodeURIComponent(res.user_id)}`
      + `&app=${encodeURIComponent(APP_URL)}`;
    showToast(`Opening app as ${res.email}`, 'success');
    window.open(bridgeUrl, '_blank');
  } catch (e) {
    showToast('Login failed: ' + e.message, 'error');
  }
}

// ── User Modal ────────────────────────────────────────────────────────────────
async function openModal(userId) {
  currentModalUserId = userId;
  document.getElementById('user-modal').classList.remove('hidden');
  document.getElementById('modal-apps-list').innerHTML = '<div class="muted">Loading…</div>';

  try {
    const u = await api(`/admin/users/${userId}`);

    document.getElementById('modal-name').textContent = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
    document.getElementById('modal-email').textContent = u.email;
    document.getElementById('modal-joined').textContent = fmtDate(u.created_at);
    document.getElementById('modal-location').textContent = u.location || '—';
    document.getElementById('modal-phone').textContent = u.phone || '—';
    document.getElementById('modal-template').textContent = u.preferred_template || '—';
    document.getElementById('modal-summary').textContent = u.summary || 'No summary added.';
    document.getElementById('modal-credits-input').value = u.ai_credits ?? 10;

    const statusEl = document.getElementById('modal-status');
    statusEl.className = `status-badge ${u.is_active ? 'status-active' : 'status-inactive'}`;
    statusEl.textContent = u.is_active ? '● Active' : '○ Inactive';

    const toggleBtn = document.getElementById('modal-toggle-btn');
    toggleBtn.textContent = u.is_active ? 'Deactivate User' : 'Activate User';
    toggleBtn.className = `btn ${u.is_active ? 'btn-danger' : 'btn-secondary'}`;

    document.getElementById('mc-exp').textContent = u.experience_count;
    document.getElementById('mc-proj').textContent = u.project_count;
    document.getElementById('mc-skill').textContent = u.skill_count;
    document.getElementById('mc-apps').textContent = u.application_count;

    // Load applications
    const apps = await api(`/admin/users/${userId}/applications`);
    const appsEl = document.getElementById('modal-apps-list');
    if (!apps.length) {
      appsEl.innerHTML = '<p class="muted">No job applications yet.</p>';
    } else {
      appsEl.innerHTML = apps.map(a => `
        <div class="app-item">
          <div class="app-info">
            <div class="app-title">${a.job_title}</div>
            <div class="app-company">${a.company_name}</div>
          </div>
          <div class="app-meta">
            <span class="app-status">${a.status}</span>
            <span class="app-date">${fmtDate(a.applied_at)}</span>
            <span class="app-resume ${a.has_resume ? 'has-resume' : 'no-resume'}">
              ${a.has_resume ? '📄 Resume' : 'No PDF'}
            </span>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    showToast('Failed to load user: ' + e.message, 'error');
    closeModal();
  }
}

function closeModal() {
  document.getElementById('user-modal').classList.add('hidden');
  currentModalUserId = null;
}

function closeModalIfBg(e) {
  if (e.target.id === 'user-modal') closeModal();
}

async function toggleUserFromModal() {
  if (!currentModalUserId) return;
  try {
    const res = await api(`/admin/users/${currentModalUserId}/toggle-active`, { method: 'PATCH' });
    const u = allUsers.find(x => x.id === currentModalUserId);
    if (u) u.is_active = res.is_active;
    renderUsersTable();
    renderRecentUsers(allUsers.slice(0, 5));
    showToast(res.message, 'success');
    await openModal(currentModalUserId); // refresh modal
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
}

async function saveCredits() {
  if (!currentModalUserId) return;
  const credits = parseInt(document.getElementById('modal-credits-input').value, 10);
  if (isNaN(credits) || credits < 0) { showToast('Invalid credit value', 'error'); return; }
  try {
    await api(`/admin/users/${currentModalUserId}/credits`, { method: 'PATCH', body: { ai_credits: credits } });
    const u = allUsers.find(x => x.id === currentModalUserId);
    if (u) u.ai_credits = credits;
    renderUsersTable();
    showToast('AI credits updated ✓', 'success');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
}

async function loginAsUser() {
  if (!currentModalUserId) return;

  try {
    const res = await api(`/admin/users/${currentModalUserId}/impersonate`, { method: 'POST' });

    const bridgeUrl = `impersonate.html`
      + `?token=${encodeURIComponent(res.access_token)}`
      + `&email=${encodeURIComponent(res.email)}`
      + `&id=${encodeURIComponent(res.user_id)}`
      + `&app=${encodeURIComponent(APP_URL)}`;

    showToast(`Opening app as ${res.email} (expires in 2h)`, 'success');
    window.open(bridgeUrl, '_blank');
  } catch (e) {
    showToast(`Login failed: ${e.message}`, 'error');
  }
}

async function deleteUserFromModal() {

  if (!currentModalUserId) return;
  const u = allUsers.find(x => x.id === currentModalUserId);
  const name = u ? u.email : currentModalUserId;
  if (!confirm(`⚠️ Permanently delete ${name} and ALL their data?\n\nThis cannot be undone.`)) return;

  try {
    await api(`/admin/users/${currentModalUserId}`, { method: 'DELETE' });
    allUsers = allUsers.filter(x => x.id !== currentModalUserId);
    renderUsersTable();
    renderRecentUsers(allUsers.slice(0, 5));
    closeModal();
    showToast('User deleted permanently', 'success');
    await loadStats();
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
}

// ── Health check ──────────────────────────────────────────────────────────────
async function checkHealth() {
  const el = document.getElementById('health-info');
  el.innerHTML = '<div class="muted">Checking…</div>';
  try {
    const h = await fetch(`${API_BASE}/health`).then(r => r.json());
    document.getElementById('status-dot').className = 'status-dot ok';
    document.getElementById('status-text').textContent = 'Connected';
    el.innerHTML = `
      <div class="health-row"><span class="health-key">Status</span><span class="health-val">${h.status}</span></div>
      <div class="health-row"><span class="health-key">LLM Provider</span><span class="health-val">${h.provider}</span></div>
      <div class="health-row"><span class="health-key">Model</span><span class="health-val">${h.model}</span></div>
      <div class="health-row"><span class="health-key">API URL</span><span class="health-val">${API_BASE}</span></div>
    `;
  } catch (e) {
    document.getElementById('status-dot').className = 'status-dot err';
    document.getElementById('status-text').textContent = 'Offline';
    el.innerHTML = `<p class="muted" style="color:var(--red)">API unreachable: ${e.message}</p>`;
  }
}

// ── Settings / LLM Provider ───────────────────────────────────────────────────
const PROVIDER_ICONS = {
  gemini: '🔷',
  anthropic: '🟣',
  groq: '⚡',
  ollama: '🦙',
  gemma_ollama: '🟢',
};

let _selectedProvider = null;
let _providerCatalogue = [];

async function loadProviderConfig() {
  const grid = document.getElementById('provider-cards');
  grid.innerHTML = '<div class="table-loading"><div class="spinner"></div><span>Loading providers…</span></div>';
  document.getElementById('api-key-section').classList.add('hidden');
  document.getElementById('provider-apply-row').classList.add('hidden');

  try {
    const config = await api('/admin/config');
    _providerCatalogue = config.providers;
    _selectedProvider = config.current_provider;
    renderProviderCards();
  } catch (e) {
    grid.innerHTML = `<p class="muted" style="color:var(--red)">Failed to load: ${e.message}</p>`;
  }
}

function renderProviderCards() {
  const grid = document.getElementById('provider-cards');
  grid.innerHTML = _providerCatalogue.map(p => {
    const icon = PROVIDER_ICONS[p.id] || '🤖';
    const isActive = p.is_active;
    const isSel = _selectedProvider === p.id;
    const keyTag = p.requires_key
      ? (p.has_key
        ? '<span class="provider-tag has-key">✓ Key saved</span>'
        : '<span class="provider-tag needs-key">⚠ Needs key</span>')
      : '<span class="provider-tag no-key">✓ No key needed</span>';
    const hostTag = p.local
      ? '<span class="provider-tag local">Local</span>'
      : '<span class="provider-tag cloud">Cloud</span>';

    return `
      <div class="provider-card ${isActive ? 'active-provider' : ''} ${isSel ? 'selected' : ''}"
           id="pcard-${p.id}" onclick="selectProvider('${p.id}')">
        <div class="provider-icon">${icon}</div>
        <div class="provider-name">${p.name}</div>
        <div class="provider-model">${p.model}</div>
        <div class="provider-desc">${p.description}</div>
        <div class="provider-tags">${hostTag}${keyTag}</div>
      </div>
    `;
  }).join('');
}

function selectProvider(providerId) {
  _selectedProvider = providerId;
  renderProviderCards();

  const p = _providerCatalogue.find(x => x.id === providerId);
  const isAlreadyActive = p && p.is_active;

  const apiKeySection = document.getElementById('api-key-section');
  const applyRow = document.getElementById('provider-apply-row');
  const applyStatus = document.getElementById('apply-status');

  if (p && p.requires_key && !p.has_key) {
    // Key needed but not saved — show key input
    document.getElementById('api-key-label').textContent = `${p.name} API Key`;
    document.getElementById('api-key-hint').textContent = `Env var: ${p.key_env}`;
    document.getElementById('api-key-input').value = '';
    apiKeySection.classList.remove('hidden');
    applyRow.classList.add('hidden');
  } else {
    apiKeySection.classList.add('hidden');
    if (isAlreadyActive) {
      applyRow.classList.add('hidden');
    } else {
      const currentName = _providerCatalogue.find(x => x.is_active)?.name || '?';
      applyRow.classList.remove('hidden');
      applyStatus.textContent = `Will switch: ${currentName} → ${p?.name}`;
    }
  }
}

async function applyProvider() {
  if (!_selectedProvider) return;
  const p = _providerCatalogue.find(x => x.id === _selectedProvider);
  const apiKey = document.getElementById('api-key-input').value.trim();

  // Find whichever Apply button triggered this
  const applyBtns = document.querySelectorAll('#apply-btn, #api-key-section .btn-primary');
  applyBtns.forEach(b => { b.disabled = true; b.textContent = 'Switching…'; });

  try {
    const res = await api('/admin/config', {
      method: 'PUT',
      body: { provider: _selectedProvider, api_key: apiKey || undefined },
    });
    showToast(`✓ ${res.message}`, 'success');
    await loadProviderConfig();  // Refresh cards with new LIVE badge
    checkHealth();               // Refresh health widget on dashboard
  } catch (e) {
    showToast(`Switch failed: ${e.message}`, 'error');
  } finally {
    applyBtns.forEach(b => { b.disabled = false; b.textContent = b.id === 'apply-btn' ? '✓ Switch Provider' : 'Apply & Switch'; });
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(function init() {
  loadSession();
  if (API_BASE && ADMIN_SECRET) {
    document.getElementById('api-url').value  = API_BASE;
    document.getElementById('app-url').value  = APP_URL;
    doLogin();
  }
})();
