/* ShootTracker — Pol Film Productions
   Standalone implementation of the ShootTracker.dc.html design. */
(function () {
  'use strict';

  /* ---------------- constants & sample data ---------------- */

  const STATUS_META = [
    { value: 'tentative', label: 'Tentative',  color: 'oklch(0.6 0.02 150)',   progress: 5 },
    { value: 'idea',      label: 'Booked',     color: 'oklch(0.48 0.015 150)', progress: 15 },
    { value: 'resched',   label: 'Resched',    color: 'oklch(0.62 0.17 45)',   progress: 15 },
    { value: 'shot',      label: 'Editing',    color: 'oklch(0.55 0.12 175)',  progress: 55 },
    { value: 'approval',  label: 'For Approval', color: 'oklch(0.62 0.16 70)', progress: 80 },
    { value: 'posted',    label: 'Completed',  color: 'oklch(0.45 0.14 150)',  progress: 100 },
  ];
  const SCRIPT_STATUS_META = {
    'Not Started': { color: 'oklch(0.48 0.015 150)', bg: 'oklch(0.48 0.015 150 / 0.14)' },
    'Drafting':    { color: 'oklch(0.5 0.16 240)',   bg: 'oklch(0.55 0.15 240 / 0.16)' },
    'In Review':   { color: 'oklch(0.58 0.16 80)',   bg: 'oklch(0.62 0.15 80 / 0.16)' },
    'Final':       { color: 'oklch(0.55 0.14 150)',  bg: 'oklch(0.55 0.14 150 / 0.16)' },
  };
  const PACKAGE_TIERS = [
    { value: 'basic',    label: 'Package 1 - Basic (₱8,000)',     price: 8000 },
    { value: 'standard', label: 'Package 2 - Standard (₱10,000)', price: 10000 },
    { value: 'premium',  label: 'Package 3 - Premium (₱12,000)',  price: 12000 },
    { value: 'ultimate', label: 'Package 4 - Ultimate (₱18,000)', price: 18000 },
    { value: 'custom',   label: 'Custom Quote',                   price: null },
  ];
  function getLiveTiers(rates) {
    return PACKAGE_TIERS.map(t => {
      if (t.price === null || !(t.value in rates)) return t;
      const price = Number(rates[t.value]) || 0;
      const name = t.label.split(' - ')[1].split(' (')[0];
      return { ...t, price, label: `${t.label.split(' - ')[0]} - ${name} (₱${price.toLocaleString('en-US')})` };
    });
  }
  const ADDON_DEFS = [
    { key: 'walkthrough', label: 'Walkthrough Video', price: 3000, unitLabel: 'per video' },
    { key: 'rawFootage',  label: 'Raw Footage + Color Grading', price: 3000, unitLabel: 'flat rate' },
    { key: 'aiScene',     label: 'AI Scene', price: 1000, unitLabel: 'per scene' },
  ];
  const USD_TO_PHP = 58;
  const SHOOT_TYPES = ['Real Estate', 'General Project'];
  const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const LEAD_STATUSES = ['New Lead', 'Contacted', 'Proposal Sent', 'Booked', 'Client', 'Lost'];
  const LEAD_STATUS_META = {
    'New Lead':      { color: 'oklch(0.5 0.16 235)',  bg: 'oklch(0.55 0.15 235 / 0.16)' },
    'Contacted':     { color: 'oklch(0.58 0.16 80)',  bg: 'oklch(0.62 0.15 80 / 0.16)' },
    'Proposal Sent': { color: 'oklch(0.55 0.12 175)', bg: 'oklch(0.55 0.12 175 / 0.16)' },
    'Booked':        { color: 'oklch(0.55 0.14 150)', bg: 'oklch(0.55 0.14 150 / 0.16)' },
    'Client':        { color: 'oklch(0.45 0.14 150)', bg: 'oklch(0.5 0.13 150 / 0.14)' },
    'Lost':          { color: 'oklch(0.48 0.015 150)', bg: 'oklch(0.48 0.015 150 / 0.16)' },
  };

  const DOC_TYPE_META = {
    contract:  { title: 'Service Agreement / Contract', body: (d) => `This Service Agreement is entered into between Pol Film Productions and ${d.clientName || '[Client Name]'} for the production of "${d.description || '[Project/Service]'}", to be delivered on ${d.date || '[Date]'} for a total contract value of ${fmtMoney(d.amount)}.` },
    quotation: { title: 'Quotation / Proposal',          body: (d) => `Quotation prepared for ${d.clientName || '[Client Name]'} for "${d.description || '[Project/Service]'}". Proposed rate: ${fmtMoney(d.amount)}. Valid until ${d.date || '[Date]'}.` },
    invoice:   { title: 'Billing Invoice',                body: (d) => `Invoice billed to ${d.clientName || '[Client Name]'} for "${d.description || '[Project/Service]'}", dated ${d.date || '[Date]'}. Amount due: ${fmtMoney(d.amount)}.` },
  };

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const TODAY_STR = todayStr();
  const TODAY = new Date(TODAY_STR + 'T00:00:00');
  const THIS_MONTH_KEY = TODAY_STR.slice(0, 7);

  /* ---------------- helpers ---------------- */

  function addDays(dstr, n) {
    const d = new Date(dstr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtMoney(n) {
    n = Number(n) || 0;
    return '₱' + n.toLocaleString('en-PH');
  }
  function fmtDate(dstr) {
    if (!dstr) return 'No date';
    const d = new Date(dstr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function fmtTime(tstr) {
    if (!tstr) return 'TBD';
    const [h, m] = tstr.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
  }
  function setTimePart(timeStr, part, value) {
    let [hh, mm] = (timeStr || '09:00').split(':').map(Number);
    let hour12 = hh % 12 === 0 ? 12 : hh % 12;
    let meridiem = hh >= 12 ? 'PM' : 'AM';
    if (part === 'hour') hour12 = value;
    if (part === 'minute') mm = value;
    if (part === 'meridiem') meridiem = value;
    const newHH = meridiem === 'PM' ? (hour12 % 12) + 12 : (hour12 % 12);
    return `${String(newHH).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  function daysLeftOf(dstr) {
    if (!dstr) return null;
    const d = new Date(dstr + 'T00:00:00');
    return Math.round((d - TODAY) / 86400000);
  }
  function daysLeftLabelAndColor(days) {
    if (days === null) return { label: 'No date', color: 'oklch(0.55 0.015 150)' };
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: 'oklch(0.58 0.19 25)' };
    if (days === 0) return { label: 'Today', color: 'oklch(0.58 0.19 25)' };
    if (days <= 3) return { label: `${days}d left`, color: 'oklch(0.58 0.19 25)' };
    if (days <= 7) return { label: `${days}d left`, color: 'oklch(0.58 0.16 80)' };
    return { label: `${days}d left`, color: 'oklch(0.48 0.015 150)' };
  }
  function statusMeta(status) { return STATUS_META.find(s => s.value === status) || STATUS_META[0]; }
  function goalIcon(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('car')) return '🚗';
    if (n.includes('emergency')) return '🛟';
    if (n.includes('stock')) return '📈';
    if (n.includes('mp2') || n.includes('pag-ibig') || n.includes('pagibig')) return '🏦';
    if (n.includes('creative')) return '🎬';
    return '🎯';
  }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    const root = Array.isArray(obj) ? obj.slice() : { ...obj };
    let cur = root;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      cur[k] = { ...cur[k] };
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
    return root;
  }
  function buildCalendarCells(year, month, shoots, selectedDate) {
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ blank: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      const dayShoots = shoots.filter(s => s.date === dateStr);
      const isToday = dateStr === TODAY_STR;
      const isSelected = dateStr === selectedDate;
      cells.push({
        dayNum: d, dateStr,
        bg: isSelected ? 'oklch(0.55 0.14 150 / 0.22)' : (isToday ? 'oklch(0 0 0 / 0.06)' : 'oklch(0.97 0.006 150)'),
        border: isSelected ? 'oklch(0.55 0.14 150 / 0.6)' : 'oklch(0 0 0 / 0.05)',
        textColor: isToday ? 'oklch(0.6 0.15 150)' : 'oklch(0.35 0.015 150)',
        dots: dayShoots.slice(0, 4).map(s => statusMeta(s.status).color),
      });
    }
    return cells;
  }

  function buildRangeCalendarCells(year, month, draftFrom, draftTo) {
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ blank: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      const isEndpoint = dateStr === draftFrom || dateStr === draftTo;
      const inRange = draftFrom && draftTo && dateStr > draftFrom && dateStr < draftTo;
      const disabled = dateStr > TODAY_STR;
      cells.push({
        dayNum: d, dateStr, disabled,
        bg: disabled ? 'transparent' : (isEndpoint ? 'oklch(0.45 0.14 150)' : (inRange ? 'oklch(0.55 0.14 150 / 0.18)' : 'transparent')),
        color: disabled ? 'oklch(0.8 0.01 150)' : (isEndpoint ? 'oklch(1 0 0)' : 'oklch(0.3 0.015 150)'),
      });
    }
    return cells;
  }

  /* ---------------- access lock ---------------- */

  const LOCK_PASSWORD_HASH = 'd8b801bcbd0a8be19c2454a45d6600e22e02c81ef8a90e1046a66cd022b0631e';
  const UNLOCK_AT_KEY = 'shoottracker_unlocked_at';
  const UNLOCK_GRACE_MS = 5 * 60 * 1000; // stay unlocked across refreshes for 5 minutes after login

  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function isWithinUnlockGrace() {
    try {
      const at = Number(localStorage.getItem(UNLOCK_AT_KEY));
      return at > 0 && (Date.now() - at) < UNLOCK_GRACE_MS;
    } catch (e) { return false; }
  }
  function markUnlocked() {
    try { localStorage.setItem(UNLOCK_AT_KEY, String(Date.now())); } catch (e) { /* storage unavailable */ }
  }
  function clearUnlocked() {
    try { localStorage.removeItem(UNLOCK_AT_KEY); } catch (e) { /* storage unavailable */ }
  }

  function renderLockScreen(showError) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:20px">
        <form id="lock-form" style="width:320px;max-width:100%;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:28px;display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;justify-content:center;margin-bottom:2px"><div class="logo-badge">pol.</div></div>
          <div class="sg" style="font-weight:700;font-size:16px;text-align:center">Pol Tracker</div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="lock-password" placeholder="Enter password" autocomplete="current-password"/>
          </div>
          ${showError ? `<div style="color:oklch(0.58 0.19 25);font-size:12.5px">Incorrect password. Please try again.</div>` : ''}
          <button type="submit" class="btn-primary" style="text-align:center">Unlock</button>
        </form>
      </div>`;
    const input = document.getElementById('lock-password');
    input.focus();
    document.getElementById('lock-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const hash = await sha256Hex(input.value);
      if (hash === LOCK_PASSWORD_HASH) {
        markUnlocked();
        init();
      } else {
        renderLockScreen(true);
      }
    });
  }

  /* ---------------- state ---------------- */

  const SUPABASE_URL = 'https://lufmszmhflmecvpislwy.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_z8a0uQ0ri_txFoxzPvYV2A_4xRG44N-';
  const SUPABASE_ROW_URL = `${SUPABASE_URL}/rest/v1/tracker_state?id=eq.1`;

  function defaultState() {
    return {
      view: 'dashboard',
      mobileNavOpen: false,
      shoots: [],
      expenses: [],
      loans: [],
      fullTimeIncome: [],
      goals: [],
      clients: [],
      packageRates: { basic: 8000, standard: 10000, premium: 12000, ultimate: 18000 },
      financeTab: 'sidehustle',
      dateRangeFrom: addDays(TODAY_STR, -30),
      dateRangeTo: TODAY_STR,
      financeRangeCalOpen: false,
      financeRangeCalYear: TODAY.getFullYear(),
      financeRangeCalMonth: TODAY.getMonth(),
      financeRangeDraftFrom: null,
      financeRangeDraftTo: null,
      ftDraft: { source: '', amount: '', date: TODAY_STR },
      modal: null,
      draft: null,
      shootAddonsOpen: false,
      shootConfirmCloseOpen: false,
      shootDatePickerOpen: false,
      timePickerOpen: false,
      shootDateCalYear: TODAY.getFullYear(),
      shootDateCalMonth: TODAY.getMonth(),
      shootDeadlinePickerOpen: false,
      shootDeadlineCalYear: TODAY.getFullYear(),
      shootDeadlineCalMonth: TODAY.getMonth(),
      shootsMode: 'board',
      calendarYear: TODAY.getFullYear(),
      calendarMonth: TODAY.getMonth(),
      selectedDate: TODAY_STR,
      telegramModalOpen: false,
      expenseDraft: { description: '', amount: '', date: TODAY_STR },
      expensesRangeFrom: TODAY_STR.slice(0, 7) + '-01',
      expensesRangeTo: TODAY_STR,
      expensesRangeCalOpen: false,
      expensesRangeCalYear: TODAY.getFullYear(),
      expensesRangeCalMonth: TODAY.getMonth(),
      expensesRangeDraftFrom: null,
      expensesRangeDraftTo: null,
      loanModal: null,
      loanDraft: null,
      goalModal: null,
      goalDraft: null,
      clientModal: null,
      clientDraft: null,
      docType: 'contract',
      docDraft: { clientName: '', description: '', amount: '', date: TODAY_STR, notes: '', invoiceNumber: 'INV-2026-001', dueDate: addDays(TODAY_STR, 10), clientContact: '', lineItems: '', paymentDetails: '', paymentStatus: 'Unpaid' },
      insightsPeriod: 'weekly',
      chipModal: null,
      shootsSearch: '', clientsSearch: '', expensesSearch: '', loansSearch: '', goalsSearch: '',
    };
  }

  const PERSIST_KEYS = ['shoots', 'expenses', 'loans', 'fullTimeIncome', 'goals', 'clients', 'packageRates'];
  const PERSIST_COLUMNS = { shoots: 'shoots', expenses: 'expenses', loans: 'loans', fullTimeIncome: 'full_time_income', goals: 'goals', clients: 'clients', packageRates: 'package_rates' };

  async function fetchRemoteState() {
    const cols = Object.values(PERSIST_COLUMNS).join(',');
    const res = await fetch(`${SUPABASE_ROW_URL}&select=${cols}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) throw new Error('Failed to load remote state: ' + res.status);
    const rows = await res.json();
    return rows[0] || null;
  }
  // Persists only the PERSIST_KEYS that actually changed, each to its own column —
  // this way a change to one entity (e.g. clients) can never clobber another (e.g. loans)
  // even if two tabs/devices save at nearly the same time.
  function persist(changedKeys) {
    const payload = {};
    changedKeys.forEach(k => { payload[PERSIST_COLUMNS[k]] = state[k]; });
    fetch(SUPABASE_ROW_URL, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    }).catch(e => console.error('Save failed', e));
  }

  let state = defaultState();
  let draggingId = null;
  let dashboardCountUpDone = false;

  function animateCountUps(root) {
    const els = root.querySelectorAll('[data-count-up]');
    els.forEach(el => {
      const target = Number(el.dataset.countUp) || 0;
      const prefix = el.dataset.countPrefix || '';
      const duration = 900;
      const start = performance.now();
      function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const current = Math.round(target * eased);
        el.textContent = prefix + current.toLocaleString('en-PH');
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  function setState(patch) {
    const partial = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...partial };
    const changedKeys = PERSIST_KEYS.filter(k => k in partial);
    if (changedKeys.length) persist(changedKeys);
    render();
  }

  /* ---------------- derived data ---------------- */

  // Defensive display-time fallbacks for older stored values that no longer exist
  // in this design (also normalized once in-storage on load, see fetchRemoteState callers).
  function normalizeShootStatus(status) {
    if (status === 'reschedule') return 'resched';
    if (status === 'planned') return 'shot';
    if (status === 'edited') return 'shot';
    return status;
  }
  function normalizeScriptStatus(scriptStatus) {
    if (scriptStatus === 'Approved') return 'Final';
    return scriptStatus;
  }
  function normalizeShootType(shootType) {
    return SHOOT_TYPES.includes(shootType) ? shootType : 'General Project';
  }
  function promoteClientToCompleted(clients, clientName) {
    const name = (clientName || '').trim().toLowerCase();
    if (!name) return clients;
    let changed = false;
    const updated = clients.map(c => {
      if (c.name.trim().toLowerCase() === name && c.leadStatus !== 'Client' && c.leadStatus !== 'Lost') {
        changed = true;
        return { ...c, leadStatus: 'Client' };
      }
      return c;
    });
    return changed ? updated : clients;
  }

  function decorate(sh) {
    const status = normalizeShootStatus(sh.status);
    const scriptStatus = normalizeScriptStatus(sh.scriptStatus) || 'Not Started';
    const shootType = normalizeShootType(sh.shootType);
    const sm = statusMeta(status);
    const scm = SCRIPT_STATUS_META[scriptStatus] || SCRIPT_STATUS_META['Not Started'];
    const days = daysLeftOf(sh.deadline || sh.date);
    const pkg = Number(sh.package) || 0;
    const paidAmt = Number(sh.paid) || 0;
    const dl = (status === 'posted' || status === 'approval')
      ? (paidAmt < pkg ? { label: 'Delivered, unpaid', color: 'oklch(0.62 0.17 45)' } : { label: 'Delivered', color: 'oklch(0.45 0.14 150)' })
      : status === 'tentative' ? { label: 'Not confirmed', color: 'oklch(0.5 0.015 150)' }
      : daysLeftLabelAndColor(days);
    const balance = pkg - paidAmt;
    const dpAmt = pkg * 0.2;
    const liveTiers = getLiveTiers(state.packageRates);
    return {
      ...sh,
      status, shootType,
      dateLabel: fmtDate(sh.date),
      timeLabel: fmtTime(sh.time),
      scriptStatusLabel: scriptStatus,
      scriptStatusColor: scm.color, scriptStatusBg: scm.bg,
      showScriptBadge: sh.packageTier !== 'basic' && sh.packageTier !== 'standard',
      showClientScriptBadge: sh.packageTier === 'basic' || sh.packageTier === 'standard',
      showDpBadge: pkg > 0 && paidAmt > 0,
      dpBadgeLabel: paidAmt >= pkg
        ? 'Paid in full ✓'
        : `DP paid: ${fmtMoney(paidAmt)}${paidAmt >= dpAmt ? ' ✓' : ' / ' + fmtMoney(dpAmt)}`,
      packageTierLabel: (liveTiers.find(t => t.value === (sh.packageTier || 'custom')) || PACKAGE_TIERS[4]).label,
      statusLabel: sm.label,
      progressPercent: sm.progress,
      daysLeft: days,
      daysLeftLabel: dl.label, daysLeftColor: dl.color,
      packageLabel: fmtMoney(sh.package), paidLabel: fmtMoney(sh.paid),
      balanceLabel: balance > 0 ? fmtMoney(balance) : 'Paid up',
      balanceColor: balance > 0 ? 'oklch(0.62 0.17 45)' : 'oklch(0.5 0.15 150)',
    };
  }

  function buildCtx() {
    const view = state.view;
    const shoots = state.shoots.map(decorate);

    const navColor = (name) => view === name
      ? { color: 'oklch(0.4 0.13 150)', bg: 'oklch(0.92 0.06 150)' }
      : { color: 'oklch(0.45 0.015 150)', bg: 'transparent' };

    const goalCards = state.goals.map(g => {
      const currency = g.currency || 'PHP';
      return {
        ...g, currency,
        icon: goalIcon(g.name),
        percent: g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0,
        targetLabel: fmtMoney(g.target), currentLabel: fmtMoney(g.current),
        isUSD: currency === 'USD',
        usdCurrentLabel: currency === 'USD' ? `$${Math.round(g.current / USD_TO_PHP).toLocaleString('en-US')}` : '',
        usdTargetLabel: currency === 'USD' ? `$${Math.round(g.target / USD_TO_PHP).toLocaleString('en-US')}` : '',
      };
    });

    const thisMonth = shoots.filter(s => s.date && s.date.slice(0, 7) === THIS_MONTH_KEY);
    const completed = shoots.filter(s => s.status === 'posted');
    const outstanding = shoots.reduce((sum, s) => sum + Math.max((Number(s.package) || 0) - (Number(s.paid) || 0), 0), 0);

    const lastMonthDate = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1);
    const lastMonthKey = lastMonthDate.getFullYear() + '-' + String(lastMonthDate.getMonth() + 1).padStart(2, '0');
    const lastMonthShoots = shoots.filter(s => s.date && s.date.slice(0, 7) === lastMonthKey);
    const shootsThisMonthCount = thisMonth.length;
    const shootsLastMonthCount = lastMonthShoots.length;
    const shootsMomDelta = shootsThisMonthCount - shootsLastMonthCount;
    const shootsMomPct = shootsLastMonthCount > 0 ? Math.round((shootsMomDelta / shootsLastMonthCount) * 100) : (shootsThisMonthCount > 0 ? 100 : 0);
    const shootsMomLabel = shootsMomDelta === 0 ? 'No change' : `${shootsMomDelta > 0 ? '▲' : '▼'} ${Math.abs(shootsMomPct)}%`;
    const shootsMomColor = shootsMomDelta > 0 ? 'oklch(0.45 0.14 150)' : (shootsMomDelta < 0 ? 'oklch(0.58 0.19 25)' : 'oklch(0.5 0.015 150)');
    const shootsMomBg = shootsMomDelta > 0 ? 'oklch(0.5 0.13 150 / 0.14)' : (shootsMomDelta < 0 ? 'oklch(0.58 0.19 25 / 0.14)' : 'oklch(0.91 0.012 150)');
    const shootsMaxCount = Math.max(shootsThisMonthCount, shootsLastMonthCount, 1);
    const shootsThisMonthBarPct = Math.max(8, Math.round((shootsThisMonthCount / shootsMaxCount) * 100));
    const shootsLastMonthBarPct = Math.max(8, Math.round((shootsLastMonthCount / shootsMaxCount) * 100));

    const upcomingList = shoots.filter(s => s.status !== 'posted' && s.daysLeft !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5);
    const nextUpList = upcomingList.slice(0, 4).map(s => ({
      ...s,
      dayNum: s.date ? String(new Date(s.date + 'T00:00:00').getDate()) : '–',
    }));
    const noNextUp = nextUpList.length === 0;

    const shootsSearchLower = state.shootsSearch.toLowerCase();
    const searchedShoots = shootsSearchLower
      ? shoots.filter(s => s.client.toLowerCase().includes(shootsSearchLower) || s.location.toLowerCase().includes(shootsSearchLower))
      : shoots;
    const columns = STATUS_META.map(sm => ({
      status: sm.value, label: sm.label, color: sm.color,
      shoots: searchedShoots.filter(s => s.status === sm.value),
    }));

    const totalPackage = shoots.reduce((sum, s) => sum + (Number(s.package) || 0), 0);
    const totalPaid = shoots.reduce((sum, s) => sum + (Number(s.paid) || 0), 0);

    const loanCards = state.loans.map(l => {
      const paidPercent = l.amount > 0 ? Math.min(100, Math.round(((l.amount - l.remainingBalance) / l.amount) * 100)) : 100;
      const isPaid = l.status === 'paid';
      const dueDays = (!isPaid && l.dueDate) ? daysLeftOf(l.dueDate) : null;
      const dueBadge = dueDays !== null ? daysLeftLabelAndColor(dueDays) : null;
      return {
        ...l, paidPercent,
        statusLabel: isPaid ? 'Paid Off' : 'Ongoing',
        statusColor: isPaid ? 'oklch(0.5 0.15 150)' : 'oklch(0.58 0.16 80)',
        statusBg: isPaid ? 'oklch(0.75 0.15 160 / 0.16)' : 'oklch(0.78 0.14 80 / 0.16)',
        amountLabel: fmtMoney(l.amount), remainingLabel: fmtMoney(l.remainingBalance), monthlyDueLabel: fmtMoney(l.monthlyDue),
        dueLabel: l.dueDate ? `Due ${fmtDate(l.dueDate)}` : 'No active due date',
        showDueBadge: !!dueBadge, dueBadgeLabel: dueBadge ? dueBadge.label : '', dueBadgeColor: dueBadge ? dueBadge.color : '',
      };
    });

    const expenses = state.expenses;
    const todayTotal = expenses.filter(e => e.date === TODAY_STR).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const monthExpenses = expenses.filter(e => e.date && e.date.slice(0, 7) === THIS_MONTH_KEY);
    const monthTotal = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const avgDaily = monthTotal / Math.max(TODAY.getDate(), 1);
    let analysisText, analysisColor;
    if (todayTotal > avgDaily * 1.3) {
      analysisText = `You're spending more today (${fmtMoney(todayTotal)}) compared to your average of ${fmtMoney(Math.round(avgDaily))}/day this month.`;
      analysisColor = 'oklch(0.62 0.17 45)';
    } else if (todayTotal > 0 && todayTotal < avgDaily * 0.7) {
      analysisText = `You're spending less today — only ${fmtMoney(todayTotal)} compared to your average of ${fmtMoney(Math.round(avgDaily))}/day.`;
      analysisColor = 'oklch(0.5 0.15 150)';
    } else {
      analysisText = `Your spending today is in the normal range (${fmtMoney(todayTotal)} vs ${fmtMoney(Math.round(avgDaily))}/day average).`;
      analysisColor = 'oklch(0.45 0.015 150)';
    }
    const decorateExpense = (e) => ({ ...e, dateLabel: fmtDate(e.date), amountLabel: fmtMoney(e.amount) });
    const recentExpenses = expenses.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map(decorateExpense);
    const allExpenseRows = expenses.slice().sort((a, b) => b.date.localeCompare(a.date)).map(decorateExpense);
    const lastExp = expenses.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || { description: '—', amount: 0 };

    const expensesRangeFrom = state.expensesRangeFrom || (THIS_MONTH_KEY + '-01');
    const expensesRangeTo = state.expensesRangeTo || TODAY_STR;
    const expensesRangeLabel = `${fmtDate(expensesRangeFrom)} - ${fmtDate(expensesRangeTo)}`;
    const rangeExpenseRows = allExpenseRows.filter(e => e.date >= expensesRangeFrom && e.date <= expensesRangeTo);
    const rangeExpensesTotal = rangeExpenseRows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const filteredExpenseRows = rangeExpenseRows.filter(e => e.description.toLowerCase().includes(state.expensesSearch.toLowerCase()));

    const monthLabel = new Date(state.calendarYear, state.calendarMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const calendarCells = buildCalendarCells(state.calendarYear, state.calendarMonth, shoots, state.selectedDate);
    const selectedDateShoots = shoots.filter(s => s.date === state.selectedDate);

    const fullTimeIncome = state.fullTimeIncome;
    const totalFullTime = fullTimeIncome.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const monthFullTime = fullTimeIncome.filter(f => f.date && f.date.slice(0, 7) === THIS_MONTH_KEY).reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const fullTimeRows = fullTimeIncome.slice().sort((a, b) => b.date.localeCompare(a.date)).map(f => ({ ...f, dateLabel: fmtDate(f.date), amountLabel: fmtMoney(f.amount) }));
    const combinedTotal = totalFullTime + totalPaid;
    const fullTimeSharePercent = combinedTotal > 0 ? Math.round((totalFullTime / combinedTotal) * 100) : 0;
    const sideHustleSharePercent = combinedTotal > 0 ? 100 - fullTimeSharePercent : 0;

    const dateRangeFrom = state.dateRangeFrom || TODAY_STR;
    const dateRangeTo = state.dateRangeTo || dateRangeFrom;
    const inSelectedRange = (dateStr) => dateStr && dateStr >= dateRangeFrom && dateStr <= dateRangeTo;
    const rangeShoots = shoots.filter(s => inSelectedRange(s.date));
    const rangeFullTimeIncome = fullTimeIncome.filter(f => inSelectedRange(f.date));
    const rangeSideHustleCollected = rangeShoots.reduce((sum, s) => sum + (Number(s.paid) || 0), 0);
    const rangeTotalFullTime = rangeFullTimeIncome.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    const rangeCombinedTotal = rangeTotalFullTime + rangeSideHustleCollected;
    const rangeFullTimeSharePercent = rangeCombinedTotal > 0 ? Math.round((rangeTotalFullTime / rangeCombinedTotal) * 100) : 0;
    const rangeSideHustleSharePercent = rangeCombinedTotal > 0 ? 100 - rangeFullTimeSharePercent : 0;
    const rangeFullTimeRows = rangeFullTimeIncome.slice().sort((a, b) => b.date.localeCompare(a.date)).map(f => ({ ...f, dateLabel: fmtDate(f.date), amountLabel: fmtMoney(f.amount) }));
    const dateRangeLabel = `${fmtDate(dateRangeFrom)} - ${fmtDate(dateRangeTo)}`;

    const clientRows = state.clients.map(c => {
      const lm = LEAD_STATUS_META[c.leadStatus] || LEAD_STATUS_META['New Lead'];
      const linked = shoots.filter(s => s.client.trim().toLowerCase() === c.name.trim().toLowerCase());
      return {
        ...c, statusColor: lm.color, statusBg: lm.bg,
        followUpLabel: c.followUpDate ? fmtDate(c.followUpDate) : 'None set',
        shootCountLabel: linked.length > 0 ? `${linked.length} shoot(s) · ${fmtMoney(linked.reduce((s, x) => s + (Number(x.package) || 0), 0))}` : 'No shoots yet',
        linkedShoots: linked,
      };
    }).filter(c => c.name.toLowerCase().includes(state.clientsSearch.toLowerCase()));
    const activeClients = state.clients.filter(c => c.leadStatus === 'Booked' || c.leadStatus === 'Client').length;

    const monthPaidFromShoots = shoots.filter(s => s.date && s.date.slice(0, 7) === THIS_MONTH_KEY).reduce((s, x) => s + (Number(x.paid) || 0), 0);
    const monthlyRevenue = monthPaidFromShoots + monthFullTime;
    const netProfit = monthlyRevenue - monthTotal;
    const yearlyGoalIncome = 1200000;
    const yearlyProgressPercent = Math.min(100, Math.round((combinedTotal / yearlyGoalIncome) * 100));

    const userFirstName = 'Pol';
    const liveDateTimeLabel = new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

    const WEEK_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const nowForWeek = new Date();
    const weekStart = new Date(nowForWeek); weekStart.setDate(nowForWeek.getDate() - nowForWeek.getDay()); weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    const weekRangeLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const todayISO = nowForWeek.toISOString().slice(0, 10);
    const weekCounts = WEEK_LABELS.map((label, i) => {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
      const dStr = d.toISOString().slice(0, 10);
      const dayShoots = shoots.filter(s => s.date === dStr);
      return { day: label, dateStr: dStr, count: dayShoots.length, isToday: dStr === todayISO, dayShoots };
    });
    const maxWeekCount = Math.max(...weekCounts.map(w => w.count), 1);
    const peakCount = Math.max(...weekCounts.map(w => w.count));
    const weekBars = weekCounts.map(w => ({
      day: w.day, count: w.count,
      dateLabel: fmtDate(w.dateStr),
      tooltip: w.count > 0
        ? `${fmtDate(w.dateStr)}: ${w.dayShoots.map(s => s.client).join(', ')}`
        : `${fmtDate(w.dateStr)}: No shoots`,
      isPeak: w.count > 0 && w.count === peakCount,
      heightPx: w.count > 0 ? Math.max(24, Math.round((w.count / maxWeekCount) * 130)) : 130,
      fill: w.count > 0
        ? (w.isToday ? 'linear-gradient(180deg, oklch(0.6 0.15 150), oklch(0.45 0.14 150))' : 'oklch(0.55 0.14 150)')
        : 'repeating-linear-gradient(135deg, oklch(0.91 0.012 150), oklch(0.91 0.012 150) 4px, oklch(0.95 0.008 150) 4px, oklch(0.95 0.008 150) 8px)',
      labelColor: w.isToday ? 'oklch(0.4 0.13 150)' : 'oklch(0.5 0.015 150)',
    }));

    const statCards = [
      { key: 'thisMonth', label: 'Shoots This Month', value: String(thisMonth.length), sub: 'Booked for this month', hero: true },
      { key: 'completed', label: 'Completed', value: String(completed.length), sub: 'Delivered to clients', hero: false },
      { key: 'activeClients', label: 'Active Clients', value: String(activeClients), sub: 'Booked or ongoing', hero: false },
    ];

    const chipModalKey = state.chipModal;
    const CHIP_MODAL_META = {
      thisMonth: { title: 'Shoots This Month', items: thisMonth.map(s => ({ primary: s.client, secondary: s.dateLabel })) },
      completed: { title: 'Completed Shoots', items: completed.map(s => ({ primary: s.client, secondary: s.dateLabel })) },
      activeClients: { title: 'Active Clients', items: state.clients.filter(c => c.leadStatus === 'Booked' || c.leadStatus === 'Client').map(c => ({ primary: c.name, secondary: c.leadStatus })) },
    };
    let chipModalData = chipModalKey ? CHIP_MODAL_META[chipModalKey] : null;
    if (!chipModalData && chipModalKey && chipModalKey.startsWith('clientshoots:')) {
      const clientId = chipModalKey.slice('clientshoots:'.length);
      const client = state.clients.find(c => c.id === clientId);
      if (client) {
        const linked = shoots.filter(s => s.client.trim().toLowerCase() === client.name.trim().toLowerCase());
        chipModalData = { title: `${client.name}'s Shoots`, items: linked.map(s => ({ primary: s.location, secondary: s.dateLabel })) };
      }
    }

    const insightsPeriod = state.insightsPeriod;
    const periodLabel = insightsPeriod === 'weekly' ? 'this week' : 'this month';
    const goalsAvgPercent = goalCards.length ? Math.round(goalCards.reduce((s, g) => s + g.percent, 0) / goalCards.length) : 0;
    const insightCards = [
      { icon: '💵', title: 'Cash Flow Analysis', text: `You earned ${fmtMoney(monthlyRevenue)} ${periodLabel === 'this week' ? 'this month so far' : 'this month'} against ${fmtMoney(monthTotal)} in expenses — a net profit of ${fmtMoney(netProfit)}. ${netProfit > 0 ? 'Positive cash flow, keep it up.' : 'Expenses are outpacing income, keep an eye on spending.'}` },
      { icon: '📊', title: `${insightsPeriod === 'weekly' ? 'Weekly' : 'Monthly'} Report`, text: outstanding > 0 ? `You have ${fmtMoney(outstanding)} in outstanding balances across your shoots.` : 'No outstanding balance on any shoots — everything is paid up.' },
      { icon: '🎯', title: 'Goal Tracking', text: `Your savings goals are at an average of ${goalsAvgPercent}% completion. Yearly income progress: ${yearlyProgressPercent}% of the ${fmtMoney(yearlyGoalIncome)} target.` },
      { icon: '💡', title: 'Business Recommendations', text: activeClients < 3 ? 'You have relatively few active clients — try following up on leads marked "Contacted" or "Proposal Sent".' : `You have a solid client base (${activeClients} active). Keep following up on pending proposals to maintain momentum.` },
    ];
    const chartMax = Math.max(monthlyRevenue, monthTotal, 1);

    return {
      view, shoots, navColor, goalCards, thisMonth, completed, outstanding,
      upcomingList, nextUpList, noNextUp, columns, totalPackage, totalPaid, loanCards,
      todayTotal, monthTotal, analysisText, analysisColor, recentExpenses, allExpenseRows,
      filteredExpenseRows, lastExp, monthLabel, calendarCells, selectedDateShoots,
      expensesRangeFrom, expensesRangeTo, expensesRangeLabel, rangeExpensesTotal,
      totalFullTime, monthFullTime, fullTimeRows, combinedTotal, fullTimeSharePercent, sideHustleSharePercent,
      dateRangeFrom, dateRangeTo, dateRangeLabel, rangeShoots, rangeSideHustleCollected, rangeTotalFullTime,
      rangeCombinedTotal, rangeFullTimeSharePercent, rangeSideHustleSharePercent, rangeFullTimeRows,
      clientRows, activeClients, monthlyRevenue, netProfit, yearlyGoalIncome, yearlyProgressPercent,
      userFirstName, liveDateTimeLabel, weekRangeLabel, weekBars, statCards,
      chipModalKey, chipModalData, insightsPeriod, insightCards, chartMax,
      shootsThisMonthCount, shootsLastMonthCount, shootsMomLabel, shootsMomColor, shootsMomBg,
      shootsThisMonthBarPct, shootsLastMonthBarPct,
    };
  }

  /* ---------------- small UI atoms ---------------- */

  function badge(label, color, bg) {
    return `<span class="badge" style="background:${bg};color:${color}">${esc(label)}</span>`;
  }
  function progressBar(percent, gradient) {
    const bg = gradient || 'linear-gradient(90deg, oklch(0.55 0.14 150), oklch(0.55 0.12 175))';
    return `<div class="progress"><div style="width:${percent}%;background:${bg}"></div></div>`;
  }

  /* ---------------- sidebar ---------------- */

  function navBtn(view, icon, label, action) {
    const c = ctxGlobal.navColor(view);
    return `<button type="button" class="nav-btn" style="color:${c.color};background:${c.bg}" data-action="nav" data-view="${action || view}">
      <span class="ic">${icon}</span>${esc(label)}
    </button>`;
  }

  function renderSidebar() {
    const open = state.mobileNavOpen;
    return `
    <div class="mobile-topbar">
      <button type="button" class="hamburger-btn" data-action="mobile-nav-toggle"><span></span><span></span><span></span></button>
      <div class="logo-badge" style="padding:6px 10px;font-size:13px">pol.</div>
      <div class="sg" style="font-weight:700;font-size:14px">Pol Tracker</div>
    </div>
    ${open ? `<div class="sidebar-backdrop" data-action="mobile-nav-close"></div>` : ''}
    <aside class="sidebar${open ? ' open' : ''}">
      <div class="logo-wrap"><div class="logo-badge">pol.</div></div>
      <nav class="navlist">
        ${navBtn('dashboard', '▦', 'Dashboard')}
        <div class="nav-section">Production</div>
        ${navBtn('shoots', '▤', 'Shoots')}
        ${navBtn('clients', '◉', 'Clients')}
        <div class="nav-section">Money</div>
        ${navBtn('finances', '₱', 'Income')}
        ${navBtn('expenses', '◔', 'Expenses')}
        ${navBtn('loans', '◫', 'Loans')}
        ${navBtn('goals', '★', 'Goals')}
        <div class="nav-section">Tools</div>
        ${navBtn('docs', '▧', 'Documents')}
        ${navBtn('insights', '✦', 'Insights')}
      </nav>
      <button type="button" class="nav-btn" style="margin-top:auto;color:oklch(0.58 0.19 25)" data-action="logout">
        <span class="ic">⏻</span>Log out
      </button>
    </aside>`;
  }

  /* ---------------- dashboard ---------------- */

  function viewDashboard(ctx) {
    return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:16px">
      <div>
        <div class="sg" style="font-size:30px;font-weight:700;letter-spacing:-0.01em">Welcome Back, <span style="color:oklch(0.4 0.13 150)">${esc(ctx.userFirstName)}</span></div>
        <div class="page-sub">Your production priorities at a glance</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:10px 16px;font-size:13px;font-weight:600;color:oklch(0.4 0.02 150)">🕒 ${esc(ctx.liveDateTimeLabel)}</div>
    </div>

    <div class="dash-hero-grid" style="display:grid;grid-template-columns:1.1fr 1fr;gap:16px;margin-bottom:16px;align-items:stretch">
      <div style="background:linear-gradient(160deg, oklch(0.42 0.14 150), oklch(0.28 0.1 155));border-radius:18px;padding:26px;display:flex;flex-direction:column;justify-content:space-between;color:oklch(1 0 0);min-height:150px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="font-size:12.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:oklch(0.9 0.05 150)">Net Profit This Month</div>
          <div style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:oklch(1 0 0 / 0.18)">${THIS_MONTH_KEY}</div>
        </div>
        <div class="sg" data-count-up="${Math.round(ctx.netProfit)}" data-count-prefix="₱" style="font-size:42px;font-weight:700;margin-top:8px">₱0</div>
        <div style="display:flex;gap:26px;margin-top:14px;flex-wrap:wrap">
          <div><div style="font-size:11px;color:oklch(0.85 0.06 150);text-transform:uppercase;letter-spacing:0.04em">Revenue</div><div data-count-up="${Math.round(ctx.monthlyRevenue)}" data-count-prefix="₱" style="font-size:16px;font-weight:700;margin-top:2px">₱0</div></div>
          <div><div style="font-size:11px;color:oklch(0.85 0.06 150);text-transform:uppercase;letter-spacing:0.04em">Expenses</div><div data-count-up="${Math.round(ctx.monthTotal)}" data-count-prefix="₱" style="font-size:16px;font-weight:700;margin-top:2px">₱0</div></div>
          <div><div style="font-size:11px;color:oklch(0.85 0.06 150);text-transform:uppercase;letter-spacing:0.04em">Pending</div><div data-count-up="${Math.round(ctx.outstanding)}" data-count-prefix="₱" style="font-size:16px;font-weight:700;margin-top:2px">₱0</div></div>
        </div>
      </div>
      <div class="card" style="display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px">
          <div class="card-title" style="margin-bottom:0">Shoots This Week</div>
          <div style="font-size:11.5px;color:oklch(0.5 0.015 150)">${esc(ctx.weekRangeLabel)}</div>
        </div>
        <div style="flex:1;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:0 2px">
          ${ctx.weekBars.map(wb => `
            <div title="${esc(wb.tooltip)}" style="display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;height:100%;justify-content:flex-end;position:relative;cursor:default">
              ${wb.isPeak ? `<div style="position:absolute;top:-4px;transform:translateY(-100%);background:oklch(0.4 0.13 150);color:oklch(1 0 0);font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap">${wb.count}</div>` : ''}
              <div style="width:24px;height:${wb.heightPx}px;border-radius:12px;background:${wb.fill};flex:none"></div>
              <div style="font-size:11px;font-weight:600;color:${wb.labelColor}">${wb.day}</div>
              <div style="font-size:9px;color:oklch(0.55 0.015 150)">${wb.dateLabel.split(' ')[1] || ''}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
      ${ctx.statCards.map(sc => `
        <button type="button" data-action="chip-open" data-key="${sc.key}" style="all:unset;cursor:pointer;min-width:0;border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:10px;${sc.hero
          ? 'background:linear-gradient(160deg, oklch(0.4 0.13 150), oklch(0.3 0.1 150));color:oklch(1 0 0)'
          : 'background:var(--panel);border:1px solid var(--border);color:var(--text)'}">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="font-size:13px;font-weight:600;color:${sc.hero ? 'oklch(0.95 0.03 150)' : 'oklch(0.4 0.02 150)'}">${esc(sc.label)}</div>
            <div style="width:26px;height:26px;border-radius:50%;background:${sc.hero ? 'oklch(1 0 0 / 0.15)' : 'oklch(0.92 0.06 150)'};display:flex;align-items:center;justify-content:center;font-size:12px;color:${sc.hero ? 'oklch(1 0 0)' : 'oklch(0.4 0.13 150)'};flex:none">↗</div>
          </div>
          <div class="sg" data-count-up="${Number(sc.value) || 0}" style="font-size:30px;font-weight:700">0</div>
          <div style="font-size:11.5px;color:${sc.hero ? 'oklch(0.85 0.06 150)' : 'oklch(0.5 0.015 150)'}">${esc(sc.sub)}</div>
        </button>`).join('')}
    </div>

    <div class="card" style="padding:18px 22px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <div class="sg" style="font-weight:700;font-size:13.5px">Yearly Progress</div>
        <div style="font-size:12px;color:oklch(0.48 0.015 150)">${fmtMoney(ctx.combinedTotal)} / ${fmtMoney(ctx.yearlyGoalIncome)}</div>
      </div>
      ${progressBar(ctx.yearlyProgressPercent, 'linear-gradient(90deg, oklch(0.55 0.14 150), oklch(0.55 0.12 175))')}
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-title">Who's Up Next</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${ctx.nextUpList.map(n => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--card2);border-radius:11px;cursor:pointer" data-action="shoot-edit" data-id="${esc(n.id)}">
            <div style="width:38px;height:38px;border-radius:10px;background:oklch(0.92 0.06 150);color:oklch(0.4 0.13 150);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex:none">${esc(n.dayNum)}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.client)}</div>
              <div style="color:oklch(0.5 0.015 150);font-size:11.5px;margin-top:1px">${n.dateLabel} · ${esc(n.location)}</div>
            </div>
            <div style="font-size:11px;font-weight:700;color:${n.daysLeftColor};flex:none">${n.daysLeftLabel}</div>
          </div>`).join('')}
        ${ctx.noNextUp ? `<div style="color:oklch(0.55 0.015 150);font-size:13.5px;padding:8px 4px">No shoots scheduled yet.</div>` : ''}
      </div>
    </div>

    <div style="margin-top:20px">
      <div class="card-title">Goals</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        ${ctx.goalCards.map(g => `
          <div class="card" style="padding:14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
              <div style="font-weight:700;font-size:12.5px;letter-spacing:-0.005em">${g.icon} ${esc(g.name)}</div>
              <div style="font-size:11px;font-weight:700;color:oklch(0.45 0.14 150)">${g.percent}%</div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin:8px 0 6px">
              ${g.isUSD
                ? `<span style="font-size:12px;font-weight:700">${g.usdCurrentLabel}</span><span style="font-size:10.5px;color:oklch(0.5 0.015 150)">/ ${g.usdTargetLabel}</span>`
                : `<span style="font-size:12px;font-weight:700">${g.currentLabel}</span><span style="font-size:10.5px;color:oklch(0.5 0.015 150)">/ ${g.targetLabel}</span>`}
            </div>
            ${progressBar(g.percent, 'linear-gradient(90deg, oklch(0.5 0.13 165), oklch(0.42 0.12 155))')}
          </div>`).join('')}
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <div class="card-title">Loans</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
        ${ctx.loanCards.map(l => `
          <div style="background:var(--card2);border-radius:11px;padding:14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
              <div style="font-weight:700;font-size:13.5px">${esc(l.lender)}</div>
              ${badge(l.statusLabel, l.statusColor, l.statusBg)}
            </div>
            ${progressBar(l.paidPercent, 'oklch(0.55 0.12 175)')}
            <div style="font-size:12px;color:oklch(0.48 0.015 150);margin-top:8px">${l.remainingLabel} left of ${l.amountLabel}</div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  /* ---------------- shoots ---------------- */

  function shootCard(s) {
    return `
    <div class="shoot-card" draggable="true" data-action="shoot-edit" data-id="${esc(s.id)}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
        <div style="font-weight:600;font-size:14px;line-height:1.3">${esc(s.client)}</div>
      </div>
      <div style="color:oklch(0.45 0.015 150);font-size:12.5px;margin-bottom:3px">${esc(s.location)} · ${esc(s.shootType)}</div>
      <div style="color:oklch(0.48 0.015 150);font-size:12px;margin-bottom:8px">${s.dateLabel} · ${s.timeLabel}</div>
      ${s.showScriptBadge ? `<div style="margin-bottom:10px">${badge('Script: ' + s.scriptStatusLabel, s.scriptStatusColor, s.scriptStatusBg)}</div>` : ''}
      ${s.showClientScriptBadge ? `<div style="margin-bottom:10px">${badge('Client Script', 'oklch(0.4 0.13 150)', 'oklch(0.92 0.06 150)')}</div>` : ''}
      ${progressBar(s.progressPercent, 'oklch(0.55 0.12 175)')}
      ${s.showDpBadge ? `<div style="margin-top:8px">${badge(s.dpBadgeLabel, 'oklch(0.4 0.13 150)', 'oklch(0.92 0.06 150)')}</div>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <div style="font-size:11.5px;font-weight:700;color:${s.daysLeftColor}">${s.daysLeftLabel}</div>
        <div style="font-size:11.5px;color:oklch(0.48 0.015 150)">${s.balanceLabel}</div>
      </div>
    </div>`;
  }

  function viewShoots(ctx) {
    const searchClear = state.shootsSearch ? `<button type="button" class="search-clear" data-action="search-clear" data-field="shootsSearch">✕</button>` : '';
    const board = `
      <div class="kanban-scroll">
        ${ctx.columns.map(col => `
          <div class="kanban-col" data-dropzone data-status="${col.status}">
            <div class="kanban-col-head">
              <div style="width:7px;height:7px;border-radius:50%;background:${col.color}"></div>
              <div style="font-weight:700;font-size:13.5px">${col.label}</div>
              <div style="color:oklch(0.5 0.015 150);font-size:12px;margin-left:auto">${col.shoots.length}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;min-height:40px">
              ${col.shoots.map(shootCard).join('')}
            </div>
          </div>`).join('')}
      </div>`;

    const calendar = `
      <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:340px;background:var(--panel2);border-radius:16px;padding:20px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <button type="button" class="btn-ghost" style="padding:6px 10px;border-radius:8px;font-size:15px" data-action="cal-prev">‹</button>
            <div class="sg" style="font-weight:700;font-size:15px">${ctx.monthLabel}</div>
            <button type="button" class="btn-ghost" style="padding:6px 10px;border-radius:8px;font-size:15px" data-action="cal-next">›</button>
          </div>
          <div class="cal-grid" style="margin-bottom:8px">
            ${WEEKDAY_LABELS.map(wd => `<div style="text-align:center;font-size:11px;color:oklch(0.55 0.015 150);font-weight:700;padding-bottom:4px">${wd}</div>`).join('')}
          </div>
          <div class="cal-grid">
            ${ctx.calendarCells.map(c => c.blank
              ? `<div></div>`
              : `<div class="cal-cell" style="background:${c.bg};border:1px solid ${c.border}" data-action="cal-select" data-date="${c.dateStr}">
                  <div style="font-size:12px;font-weight:600;color:${c.textColor}">${c.dayNum}</div>
                  <div style="display:flex;gap:2px;flex-wrap:wrap;justify-content:center">
                    ${c.dots.map(color => `<div style="width:5px;height:5px;border-radius:50%;background:${color}"></div>`).join('')}
                  </div>
                </div>`).join('')}
          </div>
        </div>
        <div style="width:280px;flex:none" class="card">
          <div class="card-title" style="margin-bottom:14px">${state.selectedDate ? fmtDate(state.selectedDate) : 'Select a date'}</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${ctx.selectedDateShoots.map(s => `
              <div style="background:var(--card2);border-radius:10px;padding:11px;cursor:pointer" data-action="shoot-edit" data-id="${esc(s.id)}">
                <div style="font-weight:600;font-size:13.5px;margin-bottom:3px">${esc(s.client)}</div>
                <div style="color:oklch(0.48 0.015 150);font-size:12px">${s.timeLabel} · ${esc(s.location)}</div>
              </div>`).join('')}
            ${ctx.selectedDateShoots.length === 0 ? `<div style="color:oklch(0.55 0.015 150);font-size:13px">No shoots this day.</div>` : ''}
          </div>
        </div>
      </div>`;

    return `
    <div class="page-head">
      <div>
        <div class="page-title sg">Shoots</div>
        <div class="page-sub">Drag cards across stages as production moves</div>
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        <div class="tabbar">
          <button type="button" class="tab-btn" style="color:${state.shootsMode === 'board' ? 'oklch(0.22 0.02 150)' : 'oklch(0.48 0.015 150)'};background:${state.shootsMode === 'board' ? 'oklch(0.92 0.06 150)' : 'transparent'}" data-action="shoots-mode" data-mode="board">Board</button>
          <button type="button" class="tab-btn" style="color:${state.shootsMode === 'calendar' ? 'oklch(0.22 0.02 150)' : 'oklch(0.48 0.015 150)'};background:${state.shootsMode === 'calendar' ? 'oklch(0.92 0.06 150)' : 'transparent'}" data-action="shoots-mode" data-mode="calendar">Calendar</button>
        </div>
        <button type="button" class="btn-primary" data-action="shoot-add-open">+ New Shoot</button>
      </div>
    </div>
    <div class="search-wrap">
      <input type="text" value="${esc(state.shootsSearch)}" data-bind="shootsSearch" placeholder="Search shoots by client or location..."/>
      ${searchClear}
    </div>
    ${state.shootsMode === 'board' ? board : calendar}`;
  }

  /* ---------------- finances ---------------- */

  function viewFinances(ctx) {
    const tab = (key, label) => `<button type="button" class="tab-btn" style="color:${state.financeTab === key ? 'oklch(0.22 0.02 150)' : 'oklch(0.48 0.015 150)'};background:${state.financeTab === key ? 'oklch(0.92 0.06 150)' : 'transparent'}" data-action="finance-tab" data-tab="${key}">${label}</button>`;

    const rangeCalLabel = new Date(state.financeRangeCalYear, state.financeRangeCalMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const rangeCells = buildRangeCalendarCells(state.financeRangeCalYear, state.financeRangeCalMonth, state.financeRangeDraftFrom, state.financeRangeDraftTo);
    const dateRangePicker = `
      <div style="position:relative">
        <button type="button" data-action="finance-range-toggle" style="all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:10px 16px;font-size:13px;font-weight:600;color:oklch(0.4 0.02 150)">
          <span>📅 ${ctx.dateRangeLabel}</span>
          <span style="font-size:11px;color:oklch(0.55 0.015 150)">▾</span>
        </button>
        ${state.financeRangeCalOpen ? `
        <div data-picker-popover style="position:absolute;right:0;top:calc(100% + 8px);background:var(--panel);border:1px solid var(--border3);border-radius:14px;padding:16px;box-shadow:0 12px 28px oklch(0 0 0 / 0.14);z-index:80;min-width:260px">
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
            <button type="button" data-action="finance-range-today" style="all:unset;cursor:pointer;padding:5px 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:var(--card2);color:oklch(0.35 0.02 150)">Today</button>
            <button type="button" data-action="finance-range-this-month" style="all:unset;cursor:pointer;padding:5px 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:var(--card2);color:oklch(0.35 0.02 150)">This Month</button>
            <button type="button" data-action="finance-range-last-month" style="all:unset;cursor:pointer;padding:5px 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:var(--card2);color:oklch(0.35 0.02 150)">Last Month</button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div class="sg" style="font-weight:700;font-size:15px">${rangeCalLabel}</div>
            <div style="display:flex;gap:6px">
              <button type="button" data-action="finance-range-cal-prev" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">‹</button>
              <button type="button" data-action="finance-range-cal-next" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">›</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
            ${WEEKDAY_LABELS.map(w => `<div style="text-align:center;font-size:10.5px;font-weight:700;color:oklch(0.55 0.015 150)">${w}</div>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:12px">
            ${rangeCells.map(c => c.blank ? `<div></div>` : `<div ${c.disabled ? '' : 'data-action="finance-range-pick"'} data-date="${c.dateStr}" style="aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:${c.disabled ? 'default' : 'pointer'};font-size:12.5px;font-weight:600;background:${c.bg};color:${c.color}">${c.dayNum}</div>`).join('')}
          </div>
          <div style="font-size:12px;color:oklch(0.5 0.015 150);margin-bottom:12px">${state.financeRangeDraftFrom ? fmtDate(state.financeRangeDraftFrom) : 'Select start'} – ${state.financeRangeDraftTo ? fmtDate(state.financeRangeDraftTo) : 'Select end'}</div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button type="button" data-action="finance-range-cancel" style="all:unset;cursor:pointer;padding:8px 14px;border-radius:8px;font-size:12.5px;font-weight:600;background:var(--card2);color:oklch(0.35 0.02 150)">Cancel</button>
            <button type="button" data-action="finance-range-ok" style="all:unset;cursor:pointer;padding:8px 16px;border-radius:8px;font-size:12.5px;font-weight:700;background:oklch(0.45 0.14 150);color:oklch(1 0 0)">OK</button>
          </div>
        </div>` : ''}
      </div>`;

    const sideHustle = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:28px">
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Collected</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px;color:oklch(0.5 0.15 150)">${fmtMoney(ctx.rangeSideHustleCollected)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Remaining Balance</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px;color:oklch(0.62 0.17 45)">${fmtMoney(ctx.outstanding)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Total Package Value</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px">${fmtMoney(ctx.totalPackage)}</div></div>
      </div>
      <div class="table-wrap">
        <div class="t-head" style="grid-template-columns:1.6fr 1fr 1fr 1fr 1fr"><div>Client / Project</div><div>Status</div><div>Package</div><div>Paid</div><div>Remaining Balance</div></div>
        ${ctx.rangeShoots.map(s => `
          <div class="t-row" style="grid-template-columns:1.6fr 1fr 1fr 1fr 1fr;cursor:pointer" data-action="shoot-edit" data-id="${esc(s.id)}">
            <div><div style="font-weight:600;font-size:14px">${esc(s.client)}</div><div style="color:oklch(0.48 0.015 150);font-size:12px;margin-top:2px">${esc(s.location)}</div></div>
            <div style="font-size:12.5px;color:oklch(0.4 0.015 150)">${s.statusLabel}</div>
            <div><div style="font-size:13.5px;font-weight:600">${s.packageLabel}</div><div style="color:oklch(0.5 0.015 150);font-size:11px;margin-top:2px">${s.packageTierLabel}</div></div>
            <div style="font-size:13.5px;color:oklch(0.5 0.15 150)">${s.paidLabel}</div>
            <div style="font-size:13.5px;font-weight:700;color:${s.balanceColor}">${s.balanceLabel}</div>
          </div>`).join('')}
        ${ctx.rangeShoots.length === 0 ? `<div style="padding:20px;color:oklch(0.55 0.015 150);font-size:13px">No shoots in this date range.</div>` : ''}
      </div>`;

    const fullTime = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Total Full-Time Income</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px">${fmtMoney(ctx.rangeTotalFullTime)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">This Month</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px">${fmtMoney(ctx.monthFullTime)}</div></div>
      </div>
      <div class="card" style="margin-bottom:24px">
        <div class="card-title">Add Income</div>
        <form data-action="save-fulltime" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
          <div class="field" style="flex:2;min-width:160px"><label>Source</label><input type="text" value="${esc(state.ftDraft.source)}" data-bind="ftDraft.source" placeholder="e.g. Salary - 1st Cutoff"/></div>
          <div class="field" style="flex:1;min-width:110px"><label>Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(state.ftDraft.amount)}" data-bind="ftDraft.amount" placeholder="0"/></div>
          <div class="field" style="flex:1;min-width:130px"><label>Date</label><input type="date" value="${esc(state.ftDraft.date)}" data-bind="ftDraft.date"/></div>
          <button type="submit" class="btn-primary">Add</button>
        </form>
      </div>
      <div class="table-wrap">
        <div class="t-head" style="grid-template-columns:2fr 1fr 1fr 32px"><div>Source</div><div>Date</div><div>Amount</div><div></div></div>
        ${ctx.rangeFullTimeRows.map(f => `
          <div class="t-row" style="grid-template-columns:2fr 1fr 1fr 32px">
            <div style="font-weight:600;font-size:14px">${esc(f.source)}</div>
            <div style="font-size:12.5px;color:oklch(0.45 0.015 150)">${f.dateLabel}</div>
            <div style="font-size:13.5px;font-weight:600;color:oklch(0.5 0.15 150)">${f.amountLabel}</div>
            <button type="button" style="all:unset;cursor:pointer;color:oklch(0.48 0.015 150);font-size:14px;text-align:right" data-action="fulltime-delete" data-id="${esc(f.id)}" title="Delete">✕</button>
          </div>`).join('')}
        ${ctx.rangeFullTimeRows.length === 0 ? `<div style="padding:20px;color:oklch(0.55 0.015 150);font-size:13px">No income entries in this date range.</div>` : ''}
      </div>`;

    const combined = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Full-Time</div><div class="sg" style="font-size:24px;font-weight:700;margin-top:8px">${fmtMoney(ctx.rangeTotalFullTime)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Side Hustle Collected</div><div class="sg" style="font-size:24px;font-weight:700;margin-top:8px">${fmtMoney(ctx.rangeSideHustleCollected)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Combined Income</div><div class="sg" style="font-size:24px;font-weight:700;margin-top:8px;color:oklch(0.55 0.12 175)">${fmtMoney(ctx.rangeCombinedTotal)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Remaining Balance</div><div class="sg" style="font-size:24px;font-weight:700;margin-top:8px;color:oklch(0.62 0.17 45)">${fmtMoney(ctx.outstanding)}</div></div>
      </div>
      <div class="card">
        <div class="card-title">Income Split</div>
        <div style="height:14px;border-radius:8px;overflow:hidden;display:flex;background:oklch(0.91 0.012 150)">
          <div style="width:${ctx.rangeFullTimeSharePercent}%;background:oklch(0.55 0.12 175)"></div>
          <div style="width:${ctx.rangeSideHustleSharePercent}%;background:oklch(0.55 0.14 150)"></div>
        </div>
        <div style="display:flex;gap:20px;margin-top:12px;font-size:12.5px">
          <div style="display:flex;align-items:center;gap:6px;color:oklch(0.42 0.015 150)"><span style="width:9px;height:9px;border-radius:50%;background:oklch(0.55 0.12 175)"></span>Full-Time (${ctx.rangeFullTimeSharePercent}%)</div>
          <div style="display:flex;align-items:center;gap:6px;color:oklch(0.42 0.015 150)"><span style="width:9px;height:9px;border-radius:50%;background:oklch(0.55 0.14 150)"></span>Side Hustle (${ctx.rangeSideHustleSharePercent}%)</div>
        </div>
      </div>`;

    return `
    <div class="page-head">
      <div><div class="page-title sg">Finances</div><div class="page-sub">Package value vs. what's been collected</div></div>
      ${dateRangePicker}
    </div>
    <div class="tabbar" style="margin-bottom:24px">
      ${tab('sidehustle', 'Side Hustle')}${tab('fulltime', 'Full-Time')}${tab('combined', 'Combined')}
    </div>
    ${state.financeTab === 'sidehustle' ? sideHustle : state.financeTab === 'fulltime' ? fullTime : combined}`;
  }

  /* ---------------- expenses ---------------- */

  function viewExpenses(ctx) {
    const searchClear = state.expensesSearch ? `<button type="button" class="search-clear" data-action="search-clear" data-field="expensesSearch">✕</button>` : '';

    const rangeCalLabel = new Date(state.expensesRangeCalYear, state.expensesRangeCalMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const rangeCells = buildRangeCalendarCells(state.expensesRangeCalYear, state.expensesRangeCalMonth, state.expensesRangeDraftFrom, state.expensesRangeDraftTo);
    const expensesRangePicker = `
      <div style="position:relative">
        <button type="button" data-action="expenses-range-toggle" style="all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:10px 16px;font-size:13px;font-weight:600;color:oklch(0.4 0.02 150)">
          <span>📅 ${ctx.expensesRangeLabel}</span>
          <span style="font-size:11px;color:oklch(0.55 0.015 150)">▾</span>
        </button>
        ${state.expensesRangeCalOpen ? `
        <div data-picker-popover style="position:absolute;right:0;top:calc(100% + 8px);background:var(--panel);border:1px solid var(--border3);border-radius:14px;padding:16px;box-shadow:0 12px 28px oklch(0 0 0 / 0.14);z-index:80;min-width:260px">
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
            <button type="button" data-action="expenses-range-today" style="all:unset;cursor:pointer;padding:5px 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:var(--card2);color:oklch(0.35 0.02 150)">Today</button>
            <button type="button" data-action="expenses-range-this-month" style="all:unset;cursor:pointer;padding:5px 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:var(--card2);color:oklch(0.35 0.02 150)">This Month</button>
            <button type="button" data-action="expenses-range-last-month" style="all:unset;cursor:pointer;padding:5px 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:var(--card2);color:oklch(0.35 0.02 150)">Last Month</button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div class="sg" style="font-weight:700;font-size:15px">${rangeCalLabel}</div>
            <div style="display:flex;gap:6px">
              <button type="button" data-action="expenses-range-cal-prev" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">‹</button>
              <button type="button" data-action="expenses-range-cal-next" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">›</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
            ${WEEKDAY_LABELS.map(w => `<div style="text-align:center;font-size:10.5px;font-weight:700;color:oklch(0.55 0.015 150)">${w}</div>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:12px">
            ${rangeCells.map(c => c.blank ? `<div></div>` : `<div ${c.disabled ? '' : 'data-action="expenses-range-pick"'} data-date="${c.dateStr}" style="aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:${c.disabled ? 'default' : 'pointer'};font-size:12.5px;font-weight:600;background:${c.bg};color:${c.color}">${c.dayNum}</div>`).join('')}
          </div>
          <div style="font-size:12px;color:oklch(0.5 0.015 150);margin-bottom:12px">${state.expensesRangeDraftFrom ? fmtDate(state.expensesRangeDraftFrom) : 'Select start'} – ${state.expensesRangeDraftTo ? fmtDate(state.expensesRangeDraftTo) : 'Select end'}</div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button type="button" data-action="expenses-range-cancel" style="all:unset;cursor:pointer;padding:8px 14px;border-radius:8px;font-size:12.5px;font-weight:600;background:var(--card2);color:oklch(0.35 0.02 150)">Cancel</button>
            <button type="button" data-action="expenses-range-ok" style="all:unset;cursor:pointer;padding:8px 16px;border-radius:8px;font-size:12.5px;font-weight:700;background:oklch(0.45 0.14 150);color:oklch(1 0 0)">OK</button>
          </div>
        </div>` : ''}
      </div>`;

    return `
    <div class="page-head">
      <div><div class="page-title sg">Expenses</div><div class="page-sub">Everything you've spent, logged via Telegram or manually</div></div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        ${expensesRangePicker}
        <button type="button" class="btn-telegram" data-action="telegram-open">+ Add Expense</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
      <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">${ctx.expensesRangeLabel}</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px">${fmtMoney(ctx.rangeExpensesTotal)}</div></div>
    </div>
    <div class="search-wrap">
      <input type="text" value="${esc(state.expensesSearch)}" data-bind="expensesSearch" placeholder="Search expenses..."/>
      ${searchClear}
    </div>
    <div class="table-wrap">
      <div class="t-head" style="grid-template-columns:2fr 1fr 1fr 32px"><div>Description</div><div>Date</div><div>Amount</div><div></div></div>
      ${ctx.filteredExpenseRows.map(ex => `
        <div class="t-row" style="grid-template-columns:2fr 1fr 1fr 32px">
          <div style="font-weight:600;font-size:14px">${esc(ex.description)}</div>
          <div style="font-size:12.5px;color:oklch(0.45 0.015 150)">${ex.dateLabel}</div>
          <div style="font-size:13.5px;font-weight:600">${ex.amountLabel}</div>
          <button type="button" style="all:unset;cursor:pointer;color:oklch(0.48 0.015 150);font-size:14px;text-align:right" data-action="expense-delete" data-id="${esc(ex.id)}" title="Delete">✕</button>
        </div>`).join('')}
      ${ctx.filteredExpenseRows.length === 0 ? `<div style="padding:24px 20px;color:oklch(0.55 0.015 150);font-size:13.5px">No expenses in this range.</div>` : ''}
    </div>`;
  }

  /* ---------------- loans ---------------- */

  function viewLoans(ctx) {
    const filtered = ctx.loanCards.filter(l => l.lender.toLowerCase().includes(state.loansSearch.toLowerCase()));
    const searchClear = state.loansSearch ? `<button type="button" class="search-clear" data-action="search-clear" data-field="loansSearch">✕</button>` : '';
    return `
    <div class="page-head">
      <div><div class="page-title sg">Loans</div><div class="page-sub">Track balances and monthly dues</div></div>
      <button type="button" class="btn-primary" data-action="loan-add-open">+ Add Loan</button>
    </div>
    <div class="search-wrap">
      <input type="text" value="${esc(state.loansSearch)}" data-bind="loansSearch" placeholder="Search loans by lender..."/>
      ${searchClear}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
      ${filtered.map(l => `
        <div style="background:oklch(1 0 0);border:1px solid oklch(0 0 0 / 0.06);border-radius:20px;padding:24px;cursor:pointer;box-shadow:0 1px 3px oklch(0 0 0 / 0.04)" data-action="loan-edit" data-id="${esc(l.id)}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <div style="font-weight:800;font-size:17px;letter-spacing:-0.01em">${esc(l.lender)}</div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;padding:5px 12px;border-radius:20px;background:${l.statusBg};color:${l.statusColor};flex:none">${l.statusLabel}</div>
          </div>
          <div style="color:oklch(0.5 0.015 150);font-size:13.5px;margin-bottom:18px">${esc(l.dueLabel)}</div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <span style="font-size:15px;font-weight:700">${l.remainingLabel} <span style="font-weight:500;color:oklch(0.5 0.015 150);font-size:12.5px">left</span></span>
            <span style="font-size:13px;color:oklch(0.5 0.015 150)">${l.amountLabel} total</span>
          </div>
          <div style="height:8px;background:oklch(0.91 0.012 150);border-radius:5px;overflow:hidden;margin-bottom:18px">
            <div style="height:100%;width:${l.paidPercent}%;background:linear-gradient(90deg, oklch(0.5 0.13 165), oklch(0.42 0.12 155));border-radius:5px"></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:13.5px;color:oklch(0.45 0.015 150)">Monthly due: <span style="color:oklch(0.2 0.02 150);font-weight:700">${l.monthlyDueLabel}</span></div>
            ${l.showDueBadge ? `<div style="font-size:12px;font-weight:700;color:${l.dueBadgeColor}">${l.dueBadgeLabel}</div>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
  }

  /* ---------------- clients ---------------- */

  function viewClients(ctx) {
    const searchClear = state.clientsSearch ? `<button type="button" class="search-clear" data-action="search-clear" data-field="clientsSearch">✕</button>` : '';
    return `
    <div class="page-head">
      <div><div class="page-title sg">Clients</div><div class="page-sub">Leads, contacts, and follow-ups</div></div>
      <button type="button" class="btn-primary" data-action="client-add-open">+ Add Client</button>
    </div>
    <div class="search-wrap">
      <input type="text" value="${esc(state.clientsSearch)}" data-bind="clientsSearch" placeholder="Search clients..."/>
      ${searchClear}
    </div>
    <div class="table-wrap">
      <div class="t-head" style="grid-template-columns:1.6fr 1.2fr 1fr 1fr 0.6fr"><div>Name</div><div>Contact</div><div>Status</div><div>Follow-up</div><div></div></div>
      ${ctx.clientRows.map(c => `
        <div class="t-row" style="grid-template-columns:1.6fr 1.2fr 1fr 1fr 0.6fr">
          <div style="font-weight:600;font-size:14px;cursor:pointer" data-action="client-edit" data-id="${esc(c.id)}">${esc(c.name)}</div>
          <div style="cursor:pointer" data-action="client-edit" data-id="${esc(c.id)}">
            <div style="font-size:12.5px;color:oklch(0.4 0.015 150)">${esc(c.phone)}</div>
            <div style="font-size:11.5px;color:oklch(0.5 0.015 150);margin-top:1px">${esc(c.email)}</div>
          </div>
          <div style="cursor:pointer" data-action="client-edit" data-id="${esc(c.id)}">${badge(c.leadStatus, c.statusColor, c.statusBg)}</div>
          <div style="cursor:pointer" data-action="client-edit" data-id="${esc(c.id)}"><div style="font-size:12.5px;color:oklch(0.45 0.015 150)">${c.followUpLabel}</div></div>
          <button type="button" style="all:unset;cursor:pointer;font-size:11.5px;color:oklch(0.55 0.14 150);text-decoration:underline" data-action="client-view-shoots" data-id="${esc(c.id)}">${esc(c.shootCountLabel)}</button>
        </div>`).join('')}
      ${ctx.clientRows.length === 0 ? `<div style="padding:24px 20px;color:oklch(0.55 0.015 150);font-size:13.5px">No clients match your search.</div>` : ''}
    </div>`;
  }

  /* ---------------- documents ---------------- */

  function viewDocs(ctx) {
    const d = state.docDraft;
    const docType = state.docType;
    const meta = DOC_TYPE_META[docType];
    const isInvoice = docType === 'invoice';
    const paymentStatusColor = d.paymentStatus === 'Paid' ? 'oklch(0.45 0.13 150)' : d.paymentStatus === 'Partial' ? 'oklch(0.55 0.14 80)' : 'oklch(0.55 0.18 25)';
    const paymentStatusBg = d.paymentStatus === 'Paid' ? 'oklch(0.92 0.06 150)' : d.paymentStatus === 'Partial' ? 'oklch(0.93 0.07 80)' : 'oklch(0.92 0.08 25)';
    const packageRateRows = [
      { key: 'basic', label: 'Package 1 - Basic' },
      { key: 'standard', label: 'Package 2 - Standard' },
      { key: 'premium', label: 'Package 3 - Premium' },
      { key: 'ultimate', label: 'Package 4 - Ultimate' },
    ];
    const tab = (key, label) => `<button type="button" class="tab-btn" style="color:${docType === key ? 'oklch(0.22 0.02 150)' : 'oklch(0.48 0.015 150)'};background:${docType === key ? 'oklch(0.92 0.06 150)' : 'transparent'}" data-action="doc-type" data-doctype="${key}">${label}</button>`;

    return `
    <div class="page-head"><div><div class="page-title sg">Documents</div><div class="page-sub">Generate contracts, quotations, and invoices</div></div></div>
    <div class="tabbar" style="margin-bottom:24px">${tab('contract', 'Contract')}${tab('quotation', 'Quotation')}${tab('invoice', 'Invoice')}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
      <div class="card" style="display:flex;flex-direction:column;gap:14px">
        <div class="field"><label>Select Existing Client (optional)</label>
          <select data-action-change="doc-client-pick">
            <option value="">— Choose from Clients —</option>
            ${state.clients.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Client Name</label><input type="text" value="${esc(d.clientName)}" data-bind="docDraft.clientName" placeholder="e.g. Nadine Reyes"/></div>
        <div class="field"><label>Project / Service</label><input type="text" value="${esc(d.description)}" data-bind="docDraft.description" placeholder="e.g. Vlog Collab - Tagaytay"/></div>
        <div class="row-2">
          <div class="field"><label>Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(d.amount)}" data-bind="docDraft.amount"/></div>
          <div class="field"><label>Date</label><input type="date" value="${esc(d.date)}" data-bind="docDraft.date"/></div>
        </div>
        <div class="field"><label>Terms / Notes</label><input type="text" value="${esc(d.notes)}" data-bind="docDraft.notes" placeholder="e.g. 50% downpayment, balance on delivery"/></div>
        ${isInvoice ? `
        <div style="border-top:1px solid oklch(0 0 0 / 0.07);margin-top:4px;padding-top:14px;display:flex;flex-direction:column;gap:14px">
          <div class="row-2">
            <div class="field"><label>Invoice Number</label><input type="text" value="${esc(d.invoiceNumber)}" data-bind="docDraft.invoiceNumber" placeholder="e.g. INV-2026-014"/></div>
            <div class="field"><label>Due Date</label><input type="date" value="${esc(d.dueDate)}" data-bind="docDraft.dueDate"/></div>
          </div>
          <div class="field"><label>Client Address / Contact</label><input type="text" value="${esc(d.clientContact)}" data-bind="docDraft.clientContact" placeholder="Address, phone, or email"/></div>
          <div class="field"><label>Line Items Breakdown</label><input type="text" value="${esc(d.lineItems)}" data-bind="docDraft.lineItems" placeholder="e.g. Package fee ₱10,000, Transport ₱1,000"/></div>
          <div class="field"><label>Payment Details</label><input type="text" value="${esc(d.paymentDetails)}" data-bind="docDraft.paymentDetails" placeholder="e.g. GCash 09XX XXX XXXX - Your Name"/></div>
          <div class="field"><label>Payment Status</label>
            <select data-bind="docDraft.paymentStatus">
              <option value="Unpaid" ${d.paymentStatus === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
              <option value="Partial" ${d.paymentStatus === 'Partial' ? 'selected' : ''}>Partial</option>
              <option value="Paid" ${d.paymentStatus === 'Paid' ? 'selected' : ''}>Paid</option>
            </select>
          </div>
        </div>` : ''}
        <button type="button" class="btn-primary" style="text-align:center;margin-top:4px" data-action="doc-generate">Generate ${meta.title}</button>
      </div>
      <div id="doc-preview-panel" style="background:oklch(0.99 0 0);color:oklch(0.28 0.02 150);border-radius:16px;padding:32px;min-height:360px">
        <div class="sg" style="font-weight:700;font-size:20px;letter-spacing:-0.02em;margin-bottom:16px">pol.</div>
        <div class="sg" style="font-weight:700;font-size:18px;margin-bottom:4px">${meta.title}</div>
        <div style="font-size:12px;color:oklch(0.4 0.02 150);margin-bottom:20px">Pol Film Productions · ${esc(d.date)}</div>
        ${isInvoice ? `
          <div style="font-size:12.5px;color:oklch(0.55 0.015 150);margin-bottom:14px">Invoice #${esc(d.invoiceNumber)} · Due ${esc(d.dueDate)}</div>
          <div style="font-size:13px;color:oklch(0.5 0.02 150);margin-bottom:14px">${esc(d.clientContact)}</div>` : ''}
        <div style="font-size:13.5px;line-height:1.7">${esc(meta.body(d))}</div>
        ${isInvoice ? `
          <div style="margin-top:16px;font-size:13px;line-height:1.7;color:oklch(0.55 0.02 150)"><div style="font-weight:700;margin-bottom:4px">Breakdown</div><div>${esc(d.lineItems)}</div></div>
          <div style="margin-top:16px;font-size:13px;line-height:1.7"><div style="font-weight:700;margin-bottom:4px">Payment Details</div><div>${esc(d.paymentDetails)}</div></div>
          <div style="margin-top:12px;font-size:12.5px;font-weight:700;display:inline-block;padding:4px 10px;border-radius:6px;background:${paymentStatusBg};color:${paymentStatusColor}">${esc(d.paymentStatus)}</div>` : ''}
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid oklch(0.3 0 0);font-size:13px;color:oklch(0.42 0.02 150)">${esc(d.notes)}</div>
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-title" style="margin-bottom:4px">Package Rates</div>
      <div style="color:oklch(0.5 0.015 150);font-size:12.5px;margin-bottom:16px">Update your pricing here — changes apply to new shoots only. Shoots already booked keep their locked-in price.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px">
        ${packageRateRows.map(pr => `
          <div class="field"><label>${pr.label}</label><input type="text" inputmode="decimal" value="${esc(state.packageRates[pr.key])}" data-bind="packageRates.${pr.key}" data-special="packageRate" data-key="${pr.key}"/></div>`).join('')}
      </div>
    </div>`;
  }

  /* ---------------- insights ---------------- */

  function viewInsights(ctx) {
    const tab = (key, label) => `<button type="button" class="tab-btn" style="color:${ctx.insightsPeriod === key ? 'oklch(0.22 0.02 150)' : 'oklch(0.48 0.015 150)'};background:${ctx.insightsPeriod === key ? 'oklch(0.92 0.06 150)' : 'transparent'}" data-action="insights-period" data-period="${key}">${label}</button>`;
    return `
    <div class="page-head">
      <div><div class="page-title sg">Insights</div><div class="page-sub">AI-generated analysis of your business</div></div>
      <div class="tabbar">${tab('weekly', 'Weekly')}${tab('monthly', 'Monthly')}</div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:14px">Shoots: This Month vs Last Month</div>
      <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:14px">
        <div class="sg" style="font-size:34px;font-weight:700">${ctx.shootsThisMonthCount}</div>
        <div style="font-size:13px;font-weight:700;color:${ctx.shootsMomColor};background:${ctx.shootsMomBg};padding:4px 10px;border-radius:20px">${ctx.shootsMomLabel}</div>
        <div style="font-size:12.5px;color:oklch(0.5 0.015 150)">vs ${ctx.shootsLastMonthCount} last month</div>
      </div>
      <div style="display:flex;align-items:flex-end;gap:16px;height:70px">
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end">
          <div style="width:60%;background:oklch(0.85 0.02 150);border-radius:8px 8px 0 0;height:${ctx.shootsLastMonthBarPct}%"></div>
          <div style="font-size:11px;color:oklch(0.5 0.015 150)">Last Month</div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end">
          <div style="width:60%;background:oklch(0.5 0.14 150);border-radius:8px 8px 0 0;height:${ctx.shootsThisMonthBarPct}%"></div>
          <div style="font-size:11px;color:oklch(0.5 0.015 150)">This Month</div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:14px">Revenue vs Expenses</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span style="color:oklch(0.42 0.015 150)">Revenue</span><span style="font-weight:700">${fmtMoney(ctx.monthlyRevenue)}</span></div>
          <div style="height:10px;background:oklch(0.91 0.012 150);border-radius:5px;overflow:hidden"><div style="height:100%;width:${Math.round((ctx.monthlyRevenue / ctx.chartMax) * 100)}%;background:oklch(0.55 0.12 175);border-radius:5px"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span style="color:oklch(0.42 0.015 150)">Expenses</span><span style="font-weight:700">${fmtMoney(ctx.monthTotal)}</span></div>
          <div style="height:10px;background:oklch(0.91 0.012 150);border-radius:5px;overflow:hidden"><div style="height:100%;width:${Math.round((ctx.monthTotal / ctx.chartMax) * 100)}%;background:oklch(0.62 0.17 45);border-radius:5px"></div></div>
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      ${ctx.insightCards.map(ic => `
        <div class="card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="color:oklch(0.55 0.14 150)">${ic.icon}</span><div class="sg" style="font-weight:700;font-size:15px">${esc(ic.title)}</div></div>
          <div style="font-size:13.5px;line-height:1.6;color:oklch(0.32 0.015 150)">${esc(ic.text)}</div>
        </div>`).join('')}
    </div>`;
  }

  /* ---------------- goals ---------------- */

  function viewGoals(ctx) {
    const filtered = ctx.goalCards.filter(g => g.name.toLowerCase().includes(state.goalsSearch.toLowerCase()));
    const searchClear = state.goalsSearch ? `<button type="button" class="search-clear" data-action="search-clear" data-field="goalsSearch">✕</button>` : '';
    return `
    <div class="page-head">
      <div><div class="page-title sg">Goals</div><div class="page-sub">Savings and investment targets</div></div>
      <button type="button" class="btn-primary" data-action="goal-add-open">+ Add Goal</button>
    </div>
    <div class="search-wrap">
      <input type="text" value="${esc(state.goalsSearch)}" data-bind="goalsSearch" placeholder="Search goals..."/>
      ${searchClear}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
      ${filtered.map(g => `
        <div class="card" style="padding:20px;cursor:pointer" data-action="goal-edit" data-id="${esc(g.id)}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:34px;height:34px;border-radius:10px;background:oklch(0.92 0.06 150);display:flex;align-items:center;justify-content:center;font-size:16px;flex:none">${g.icon}</div>
              <div style="font-weight:700;font-size:14.5px">${esc(g.name)}</div>
            </div>
            <div style="font-size:12px;font-weight:700;color:oklch(0.55 0.12 175)">${g.percent}%</div>
          </div>
          ${progressBar(g.percent)}
          <div style="display:flex;justify-content:space-between;font-size:12.5px;color:oklch(0.45 0.015 150);margin-top:10px"><span>${g.currentLabel} saved</span><span>${g.targetLabel} goal</span></div>
        </div>`).join('')}
    </div>`;
  }

  /* ---------------- modals ---------------- */

  function modalShoot() {
    if (!state.modal) return '';
    const d = state.draft;
    const isEdit = state.modal.mode === 'edit';
    const isRealEstate = d.shootType === 'Real Estate';
    const liveTiers = getLiveTiers(state.packageRates);
    const isCustomPackage = isRealEstate && (d.packageTier || 'custom') === 'custom';
    const isScriptedShootType = isRealEstate && d.packageTier !== 'basic' && d.packageTier !== 'standard';
    const draftPackageAmount = (!isRealEstate || d.packageTier === 'custom')
      ? (Number(d.package) || 0)
      : ((liveTiers.find(t => t.value === d.packageTier) || {}).price || 0);
    const draftAddons = d.addons || {};
    const addonsTotal = ADDON_DEFS.reduce((sum, ad) => sum + (draftAddons[ad.key] || 0) * ad.price, 0);
    const draftGrandTotal = draftPackageAmount + addonsTotal;
    const hasAddons = addonsTotal > 0;
    const draftPaidAmount = Number(d.paid) || 0;
    const showPaymentTerms = isRealEstate && draftGrandTotal > 0;
    const showSimpleTotal = !isRealEstate && draftGrandTotal > 0;
    const draftGrandTotalLabel = fmtMoney(draftGrandTotal);
    const draftBalanceLabel = fmtMoney(Math.max(draftGrandTotal - draftPaidAmount, 0));

    const milestoneDefs = [
      { key: 'dp', label: '20% Down Payment', shortLabel: '20% DP', weight: 20, portion: draftGrandTotal * 0.2, target: draftGrandTotal * 0.2 },
      { key: 'shoot', label: '30% After Shoot', shortLabel: '30% Shoot', weight: 30, portion: draftGrandTotal * 0.3, target: draftGrandTotal * 0.5 },
      { key: 'final', label: '50% Final Delivery', shortLabel: '50% Final', weight: 50, portion: draftGrandTotal * 0.5, target: draftGrandTotal },
    ];
    const paymentMilestones = milestoneDefs.map(m => {
      const covered = draftPaidAmount >= m.target;
      return {
        ...m,
        mark: covered ? '✓' : '',
        barColor: covered ? 'oklch(0.45 0.14 150)' : 'oklch(0.88 0.012 150)',
        labelColor: covered ? 'oklch(0.45 0.14 150)' : 'oklch(0.55 0.015 150)',
        chipBg: covered ? 'oklch(0.92 0.06 150)' : 'oklch(1 0 0)',
        chipBorder: covered ? 'oklch(0.45 0.14 150 / 0.3)' : 'oklch(0 0 0 / 0.08)',
        amountLabel: fmtMoney(m.portion),
      };
    });

    const shootTypePills = [
      { value: 'Real Estate', label: 'Real Estate', icon: '🏠' },
      { value: 'General Project', label: 'General Project', icon: '🎬' },
    ].map(tp => {
      const active = d.shootType === tp.value;
      const accent = tp.value === 'Real Estate' ? { color: 'oklch(0.5 0.16 235)', bg: 'oklch(0.55 0.15 240 / 0.16)' } : { color: 'oklch(0.45 0.14 150)', bg: 'oklch(0.5 0.13 150 / 0.14)' };
      return { ...tp, bg: active ? accent.bg : 'oklch(0.97 0.006 150)', color: active ? accent.color : 'oklch(0.5 0.015 150)', border: active ? accent.color : 'oklch(0 0 0 / 0.08)' };
    });

    const statusOptions = (isEdit ? STATUS_META : STATUS_META.filter(sm => sm.value === 'tentative' || sm.value === 'idea'));

    const shootDateDisplayLabel = d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date';
    const pickerMonthLabel = new Date(state.shootDateCalYear, state.shootDateCalMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const pickerCells = buildCalendarCells(state.shootDateCalYear, state.shootDateCalMonth, state.shoots, d.date);
    const deadlineDisplayLabel = d.deadline ? new Date(d.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline set';
    const deadlinePickerMonthLabel = new Date(state.shootDeadlineCalYear, state.shootDeadlineCalMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const deadlinePickerCells = buildCalendarCells(state.shootDeadlineCalYear, state.shootDeadlineCalMonth, [], d.deadline);
    const timeDisplayLabel = fmtTime(d.time || '09:00');
    const [curHH, curMM] = (d.time || '09:00').split(':').map(Number);
    const curHour12 = curHH % 12 === 0 ? 12 : curHH % 12;
    const curMeridiem = curHH >= 12 ? 'PM' : 'AM';

    return `
    <div class="modal-backdrop" data-action="modal-backdrop-close" data-which="shoot">
      <form class="modal-box" style="width:460px" data-stop data-action="save-shoot">
        <div class="modal-head"><div class="modal-title">${isEdit ? 'Edit Shoot' : 'New Shoot'}</div><button type="button" class="modal-close" data-action="modal-close" data-which="shoot">✕</button></div>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          ${shootTypePills.map(tp => `<button type="button" data-action="shoot-type-pick" data-type="${esc(tp.value)}" style="all:unset;cursor:pointer;flex:1;text-align:center;padding:10px 8px;border-radius:10px;font-weight:700;font-size:13px;background:${tp.bg};color:${tp.color};border:1px solid ${tp.border}">${tp.icon} ${esc(tp.label)}</button>`).join('')}
        </div>
        <div class="modal-fields">
          <div class="field"><label>Client / Project</label><input type="text" list="clientNamesList" value="${esc(d.client)}" data-bind="draft.client" placeholder="e.g. Globe Telecom Anthem"/>
            <datalist id="clientNamesList">${state.clients.map(c => `<option value="${esc(c.name)}"></option>`).join('')}</datalist>
          </div>
          <div class="field"><label>Location / Venue</label><input type="text" value="${esc(d.location)}" data-bind="draft.location" placeholder="e.g. BGC Studio"/></div>
          <div class="row-2">
            <div class="field" style="position:relative">
              <label>Date</label>
              <button type="button" data-action="date-picker-toggle" style="all:unset;cursor:pointer;width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--border3);border-radius:9px;padding:10px 12px;color:inherit;font-size:14px;font-family:inherit;display:flex;align-items:center;justify-content:space-between">
                <span>${shootDateDisplayLabel}</span>
              </button>
              ${state.shootDatePickerOpen ? `
              <div data-picker-popover style="position:absolute;left:0;top:calc(100% + 6px);background:var(--panel);border:1px solid var(--border3);border-radius:14px;padding:16px;box-shadow:0 12px 28px oklch(0 0 0 / 0.14);z-index:80;min-width:260px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                  <div class="sg" style="font-weight:700;font-size:15px">${pickerMonthLabel}</div>
                  <div style="display:flex;gap:6px">
                    <button type="button" data-action="shoot-date-cal-prev" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">‹</button>
                    <button type="button" data-action="shoot-date-cal-next" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">›</button>
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
                  ${WEEKDAY_LABELS.map(w => `<div style="text-align:center;font-size:10.5px;font-weight:700;color:oklch(0.55 0.015 150)">${w}</div>`).join('')}
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
                  ${pickerCells.map(c => c.blank ? `<div></div>` : `
                    <div data-action="date-picker-pick" data-date="${c.dateStr}" style="aspect-ratio:1;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;font-size:12.5px;font-weight:600;background:${c.bg};border:1px solid ${c.border};color:${c.textColor}">
                      <span>${c.dayNum}</span>
                      <span style="display:flex;gap:2px">${c.dots.map(color => `<span style="width:4px;height:4px;border-radius:50%;background:${color}"></span>`).join('')}</span>
                    </div>`).join('')}
                </div>
              </div>` : ''}
            </div>
            <div class="field" style="position:relative">
              <label>Time</label>
              <button type="button" data-action="time-picker-toggle" style="all:unset;cursor:pointer;width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--border3);border-radius:9px;padding:10px 12px;color:inherit;font-size:14px;font-family:inherit;display:flex;align-items:center;justify-content:space-between">
                <span>${timeDisplayLabel}</span>
              </button>
              ${state.timePickerOpen ? `
              <div data-picker-popover style="position:absolute;left:0;top:calc(100% + 6px);background:var(--panel);border:1px solid var(--border3);border-radius:14px;padding:10px;box-shadow:0 12px 28px oklch(0 0 0 / 0.14);z-index:80;min-width:190px;display:flex;gap:6px">
                <div style="display:flex;flex-direction:column;gap:4px;max-height:180px;overflow-y:auto;flex:1">
                  ${Array.from({ length: 12 }, (_, i) => i + 1).map(h => `<button type="button" data-action="time-part-pick" data-part="hour" data-value="${h}" style="all:unset;cursor:pointer;text-align:center;padding:7px 0;border-radius:8px;font-weight:700;font-size:13px;background:${h === curHour12 ? 'oklch(0.45 0.14 150)' : 'transparent'};color:${h === curHour12 ? 'oklch(1 0 0)' : 'oklch(0.25 0.02 150)'}">${String(h).padStart(2, '0')}</button>`).join('')}
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;max-height:180px;overflow-y:auto;flex:1">
                  ${[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => `<button type="button" data-action="time-part-pick" data-part="minute" data-value="${m}" style="all:unset;cursor:pointer;text-align:center;padding:7px 0;border-radius:8px;font-weight:700;font-size:13px;background:${m === curMM ? 'oklch(0.45 0.14 150)' : 'transparent'};color:${m === curMM ? 'oklch(1 0 0)' : 'oklch(0.25 0.02 150)'}">${String(m).padStart(2, '0')}</button>`).join('')}
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;flex:0.8">
                  ${['AM', 'PM'].map(mo => `<button type="button" data-action="time-part-pick" data-part="meridiem" data-value="${mo}" style="all:unset;cursor:pointer;text-align:center;padding:7px 0;border-radius:8px;font-weight:700;font-size:13px;background:${mo === curMeridiem ? 'oklch(0.45 0.14 150)' : 'transparent'};color:${mo === curMeridiem ? 'oklch(1 0 0)' : 'oklch(0.25 0.02 150)'}">${mo}</button>`).join('')}
                </div>
              </div>` : ''}
            </div>
          </div>
          <div class="field"><label>Status</label>
            <select data-bind="draft.status" data-special="shootStatus">${statusOptions.map(sm => `<option value="${sm.value}" ${d.status === sm.value ? 'selected' : ''}>${sm.label}</option>`).join('')}</select>
          </div>
          <div class="field" style="position:relative">
            <label>Deadline (edit / delivery)</label>
            <button type="button" data-action="deadline-picker-toggle" style="all:unset;cursor:pointer;width:100%;box-sizing:border-box;background:var(--card);border:1px solid oklch(0.58 0.19 25 / 0.45);border-radius:9px;padding:10px 12px;color:inherit;font-size:14px;font-family:inherit;display:flex;align-items:center;justify-content:space-between">
              <span>${deadlineDisplayLabel}</span>
            </button>
            <div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:4px">Optional — if set, "overdue" is based on this instead of the shoot date. ${d.deadline ? `<span data-action="deadline-clear" style="cursor:pointer;color:oklch(0.55 0.14 150);text-decoration:underline">Clear</span>` : ''}</div>
            ${state.shootDeadlinePickerOpen ? `
            <div data-picker-popover style="position:absolute;left:0;top:calc(100% + 6px);background:var(--panel);border:1px solid var(--border3);border-radius:14px;padding:16px;box-shadow:0 12px 28px oklch(0 0 0 / 0.14);z-index:80;min-width:260px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                <div class="sg" style="font-weight:700;font-size:15px">${deadlinePickerMonthLabel}</div>
                <div style="display:flex;gap:6px">
                  <button type="button" data-action="shoot-deadline-cal-prev" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">‹</button>
                  <button type="button" data-action="shoot-deadline-cal-next" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">›</button>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
                ${WEEKDAY_LABELS.map(w => `<div style="text-align:center;font-size:10.5px;font-weight:700;color:oklch(0.55 0.015 150)">${w}</div>`).join('')}
              </div>
              <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
                ${deadlinePickerCells.map(c => c.blank ? `<div></div>` : `
                  <div data-action="deadline-picker-pick" data-date="${c.dateStr}" style="aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12.5px;font-weight:600;background:${c.bg};border:1px solid ${c.border};color:${c.textColor}">${c.dayNum}</div>`).join('')}
              </div>
            </div>` : ''}
          </div>
          <div class="row-2">
            ${isRealEstate ? `
            <div class="field"><label>Package</label>
              <select data-bind="draft.packageTier" data-special="packageTier">${liveTiers.map(t => `<option value="${t.value}" ${d.packageTier === t.value ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select>
            </div>` : `
            <div class="field"><label>Project Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(d.package)}" data-bind="draft.package" placeholder="0"/></div>`}
            <div class="field"><label>Amount Received (₱)</label><input type="text" inputmode="decimal" value="${esc(d.paid)}" data-bind="draft.paid" placeholder="0"/></div>
          </div>
          ${isCustomPackage ? `<div class="field"><label>Custom Package Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(d.package)}" data-bind="draft.package" placeholder="0"/></div>` : ''}
          ${isRealEstate ? `
          <div style="background:var(--card2);border:1px solid var(--border3);border-radius:12px;padding:14px 16px">
            <button type="button" data-action="shoot-addons-toggle" style="all:unset;cursor:pointer;display:flex;align-items:center;justify-content:space-between;width:100%">
              <span style="font-size:12.5px;font-weight:700;color:oklch(0.25 0.02 150)">Add-ons ${(!state.shootAddonsOpen && hasAddons) ? `· ${addonsTotal.toLocaleString('en-US')} added` : '(optional)'}</span>
              <span style="font-size:12px;color:oklch(0.5 0.015 150)">${state.shootAddonsOpen ? '▾' : '▸'}</span>
            </button>
            ${state.shootAddonsOpen ? `
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
              ${ADDON_DEFS.map(ad => {
                const qty = draftAddons[ad.key] || 0;
                const subtotalLabel = qty > 0 ? fmtMoney(qty * ad.price) : '—';
                const subtotalColor = qty > 0 ? 'oklch(0.4 0.13 150)' : 'oklch(0.6 0.015 150)';
                return `
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:600;color:oklch(0.25 0.02 150)">${esc(ad.label)}</div>
                    <div style="font-size:11.5px;color:oklch(0.5 0.015 150)">₱${ad.price.toLocaleString('en-US')} ${esc(ad.unitLabel)}</div>
                  </div>
                  <button type="button" data-action="shoot-addon-dec" data-key="${ad.key}" style="all:unset;cursor:pointer;width:26px;height:26px;border-radius:7px;background:oklch(0.91 0.012 150);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:oklch(0.35 0.02 150)">−</button>
                  <div style="width:22px;text-align:center;font-weight:700;font-size:13.5px">${qty}</div>
                  <button type="button" data-action="shoot-addon-inc" data-key="${ad.key}" style="all:unset;cursor:pointer;width:26px;height:26px;border-radius:7px;background:oklch(0.92 0.06 150);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:oklch(0.4 0.13 150)">+</button>
                  <div style="width:70px;text-align:right;font-size:13px;font-weight:700;color:${subtotalColor}">${subtotalLabel}</div>
                </div>`;
              }).join('')}
            </div>
            ${hasAddons ? `
            <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid var(--border3)">
              <div style="font-size:12.5px;color:oklch(0.5 0.015 150)">Add-ons Subtotal</div>
              <div style="font-size:13px;font-weight:700;color:oklch(0.4 0.13 150)">${fmtMoney(addonsTotal)}</div>
            </div>` : ''}
            ` : ''}
          </div>` : ''}
          ${showPaymentTerms ? `
          <div style="background:var(--card2);border:1px solid var(--border3);border-radius:12px;padding:16px">
            <div style="font-size:12.5px;font-weight:700;color:oklch(0.25 0.02 150);margin-bottom:12px">Payment Terms</div>
            <div style="display:flex;gap:3px;height:8px;border-radius:5px;overflow:hidden;margin-bottom:12px">
              ${paymentMilestones.map(pm => `<div style="flex:${pm.weight};background:${pm.barColor};border-radius:5px"></div>`).join('')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
              ${paymentMilestones.map(pm => `
              <div data-action="shoot-milestone-pick" data-amount="${Math.round(pm.target)}" style="text-align:center;cursor:pointer;background:${pm.chipBg};border:1px solid ${pm.chipBorder};border-radius:9px;padding:8px 4px">
                <div style="font-size:10.5px;font-weight:700;color:${pm.labelColor};margin-bottom:2px">${pm.shortLabel} ${pm.mark}</div>
                <div style="font-size:12.5px;font-weight:700;color:oklch(0.25 0.02 150)">${pm.amountLabel}</div>
              </div>`).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--border3)">
              <div style="font-size:12.5px;color:oklch(0.5 0.015 150)">Total (${draftGrandTotalLabel}) · Remaining Balance</div>
              <div style="font-size:15px;font-weight:800;color:oklch(0.62 0.17 45)">${draftBalanceLabel}</div>
            </div>
          </div>` : ''}
          ${showSimpleTotal ? `
          <div style="background:var(--card2);border:1px solid var(--border3);border-radius:12px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:11.5px;color:oklch(0.5 0.015 150)">Total Project Amount</div>
              <div style="font-size:15px;font-weight:800;color:oklch(0.25 0.02 150)">${draftGrandTotalLabel}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11.5px;color:oklch(0.5 0.015 150)">Remaining Balance</div>
              <div style="font-size:15px;font-weight:800;color:oklch(0.62 0.17 45)">${draftBalanceLabel}</div>
            </div>
          </div>` : ''}
          ${isRealEstate && isScriptedShootType ? `
          <div class="field"><label>Script Status</label>
            <select data-bind="draft.scriptStatus">${Object.keys(SCRIPT_STATUS_META).map(v => `<option value="${v}" ${d.scriptStatus === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
          </div>` : ''}
          ${isRealEstate && !isScriptedShootType ? `<div style="background:oklch(0.92 0.06 150 / 0.4);border-radius:9px;padding:10px 12px;font-size:12.5px;color:oklch(0.4 0.13 150)">📝 Script is provided by the client for this package tier.</div>` : ''}
          <div class="field"><input type="text" value="${esc(d.notes)}" data-bind="draft.notes" placeholder="Notes (optional)"/></div>
        </div>
        <div class="modal-actions">
          ${isEdit ? `<button type="button" class="btn-danger" data-action="shoot-delete">Delete</button>` : ''}
          <button type="submit" class="btn-primary" style="flex:1;text-align:center">${isEdit ? 'Save Changes' : 'Add Shoot'}</button>
        </div>
      </form>
    </div>`;
  }

  function modalShootConfirmClose() {
    if (!state.shootConfirmCloseOpen) return '';
    return `
    <div class="modal-backdrop chip" style="z-index:70">
      <div class="modal-box" style="width:340px;padding:24px">
        <div class="modal-title" style="margin-bottom:8px">Discard this shoot?</div>
        <div style="font-size:13.5px;color:oklch(0.48 0.015 150);margin-bottom:20px;line-height:1.5">Are you sure you want to close this? Any details you've entered will be lost.</div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button type="button" style="all:unset;cursor:pointer;padding:9px 16px;border-radius:9px;background:var(--card2);color:oklch(0.35 0.02 150);font-weight:600;font-size:13px" data-action="shoot-confirm-close-cancel">Cancel</button>
          <button type="button" style="all:unset;cursor:pointer;padding:9px 16px;border-radius:9px;background:oklch(0.58 0.19 25);color:oklch(1 0 0);font-weight:700;font-size:13px" data-action="shoot-confirm-close-confirm">Yes, close</button>
        </div>
      </div>
    </div>`;
  }

  function modalTelegram(ctx) {
    if (!state.telegramModalOpen) return '';
    const d = state.expenseDraft;
    return `
    <div class="modal-backdrop chip" data-action="modal-backdrop-close" data-which="telegram">
      <div class="modal-box" style="width:420px" data-stop>
        <div class="modal-head"><div class="modal-title">Add Expense</div><button type="button" class="modal-close" data-action="modal-close" data-which="telegram">✕</button></div>
        <form data-action="save-telegram-expense" style="display:flex;flex-direction:column;gap:12px">
          <div class="field"><label>What did you spend on?</label><input type="text" value="${esc(d.description)}" data-bind="expenseDraft.description" placeholder="e.g. Grab to BGC shoot"/></div>
          <div class="row-2">
            <div class="field"><label>Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(d.amount)}" data-bind="expenseDraft.amount" placeholder="0"/></div>
            <div class="field"><label>Date</label><input type="date" value="${esc(d.date)}" data-bind="expenseDraft.date"/></div>
          </div>
          <button type="submit" class="btn-primary" style="text-align:center;margin-top:4px">Add Expense</button>
        </form>
      </div>
    </div>`;
  }

  function modalLoan() {
    if (!state.loanModal) return '';
    const d = state.loanDraft;
    const isEdit = state.loanModal.mode === 'edit';
    return `
    <div class="modal-backdrop chip" data-action="modal-backdrop-close" data-which="loan">
      <form class="modal-box" style="width:420px" data-stop data-action="save-loan">
        <div class="modal-head"><div class="modal-title">${isEdit ? 'Edit Loan' : 'Add Loan'}</div><button type="button" class="modal-close" data-action="modal-close" data-which="loan">✕</button></div>
        <div class="modal-fields">
          <div class="field"><label>Lender / Source</label><input type="text" value="${esc(d.lender)}" data-bind="loanDraft.lender" placeholder="e.g. BPI Personal Loan"/></div>
          <div class="row-2">
            <div class="field"><label>Loan Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(d.amount)}" data-bind="loanDraft.amount"/></div>
            <div class="field"><label>Remaining Balance (₱)</label><input type="text" inputmode="decimal" value="${esc(d.remainingBalance)}" data-bind="loanDraft.remainingBalance"/></div>
          </div>
          <div class="row-2">
            <div class="field"><label>Monthly Due (₱)</label><input type="text" inputmode="decimal" value="${esc(d.monthlyDue)}" data-bind="loanDraft.monthlyDue"/></div>
            <div class="field"><label>Due Date</label><input type="date" value="${esc(d.dueDate)}" data-bind="loanDraft.dueDate"/></div>
          </div>
          <div class="field"><label>Status</label>
            <select data-bind="loanDraft.status">
              <option value="ongoing" ${d.status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
              <option value="paid" ${d.status === 'paid' ? 'selected' : ''}>Paid Off</option>
            </select>
          </div>
        </div>
        <div class="modal-actions">
          ${isEdit ? `<button type="button" class="btn-danger" data-action="loan-delete">Delete</button>` : ''}
          <button type="submit" class="btn-primary" style="flex:1;text-align:center">${isEdit ? 'Save Changes' : 'Add Loan'}</button>
        </div>
      </form>
    </div>`;
  }

  function modalGoal() {
    if (!state.goalModal) return '';
    const d = state.goalDraft;
    const isEdit = state.goalModal.mode === 'edit';
    const isUSD = d.currency === 'USD';
    const currencySymbol = isUSD ? '$' : '₱';
    const targetPhpPreview = fmtMoney((Number(d.target) || 0) * USD_TO_PHP);
    const currentPhpPreview = fmtMoney((Number(d.current) || 0) * USD_TO_PHP);
    return `
    <div class="modal-backdrop chip" data-action="modal-backdrop-close" data-which="goal">
      <form class="modal-box" style="width:400px" data-stop data-action="save-goal">
        <div class="modal-head"><div class="modal-title">${isEdit ? 'Edit Goal' : 'Add Goal'}</div><button type="button" class="modal-close" data-action="modal-close" data-which="goal">✕</button></div>
        <div class="modal-fields">
          <div class="field"><label>Goal Name</label><input type="text" value="${esc(d.name)}" data-bind="goalDraft.name" placeholder="e.g. Car Fund"/></div>
          <div style="display:flex;gap:8px">
            <button type="button" data-action="goal-currency-pick" data-currency="PHP" style="all:unset;cursor:pointer;padding:6px 14px;border-radius:8px;font-size:12.5px;font-weight:700;background:${!isUSD ? 'oklch(0.45 0.14 150)' : 'oklch(0.91 0.012 150)'};color:${!isUSD ? 'oklch(1 0 0)' : 'oklch(0.4 0.02 150)'}">₱ PHP</button>
            <button type="button" data-action="goal-currency-pick" data-currency="USD" style="all:unset;cursor:pointer;padding:6px 14px;border-radius:8px;font-size:12.5px;font-weight:700;background:${isUSD ? 'oklch(0.45 0.14 150)' : 'oklch(0.91 0.012 150)'};color:${isUSD ? 'oklch(1 0 0)' : 'oklch(0.4 0.02 150)'}">$ USD</button>
          </div>
          <div class="row-2">
            <div class="field"><label>Target Amount (${currencySymbol})</label><input type="text" inputmode="decimal" value="${esc(d.target)}" data-bind="goalDraft.target"/>
              ${isUSD ? `<div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:4px">≈ ${targetPhpPreview}</div>` : ''}
            </div>
            <div class="field"><label>Current Amount (${currencySymbol})</label><input type="text" inputmode="decimal" value="${esc(d.current)}" data-bind="goalDraft.current"/>
              ${isUSD ? `<div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:4px">≈ ${currentPhpPreview}</div>` : ''}
            </div>
          </div>
        </div>
        <div class="modal-actions">
          ${isEdit ? `<button type="button" class="btn-danger" data-action="goal-delete">Delete</button>` : ''}
          <button type="submit" class="btn-primary" style="flex:1;text-align:center">${isEdit ? 'Save Changes' : 'Add Goal'}</button>
        </div>
      </form>
    </div>`;
  }

  function modalClient() {
    if (!state.clientModal) return '';
    const d = state.clientDraft;
    const isEdit = state.clientModal.mode === 'edit';
    return `
    <div class="modal-backdrop chip" data-action="modal-backdrop-close" data-which="client">
      <form class="modal-box" style="width:420px" data-stop data-action="save-client">
        <div class="modal-head"><div class="modal-title">${isEdit ? 'Edit Client' : 'Add Client'}</div><button type="button" class="modal-close" data-action="modal-close" data-which="client">✕</button></div>
        <div class="modal-fields">
          <div class="field"><label>Name</label><input type="text" value="${esc(d.name)}" data-bind="clientDraft.name" placeholder="e.g. Nadine Reyes"/></div>
          <div class="row-2">
            <div class="field"><label>Phone</label><input type="text" value="${esc(d.phone)}" data-bind="clientDraft.phone" placeholder="09XX XXX XXXX"/></div>
            <div class="field"><label>Email</label><input type="text" value="${esc(d.email)}" data-bind="clientDraft.email" placeholder="email@example.com"/></div>
          </div>
          <div class="row-2">
            <div class="field"><label>Lead Status</label>
              <select data-bind="clientDraft.leadStatus">${LEAD_STATUSES.map(v => `<option value="${v}" ${d.leadStatus === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Follow-up Date</label><input type="date" value="${esc(d.followUpDate)}" data-bind="clientDraft.followUpDate"/></div>
          </div>
          <div class="field"><label>Notes</label><input type="text" value="${esc(d.notes)}" data-bind="clientDraft.notes" placeholder="Optional notes"/></div>
        </div>
        <div class="modal-actions">
          ${isEdit ? `<button type="button" class="btn-danger" data-action="client-delete">Delete</button>` : ''}
          <button type="submit" class="btn-primary" style="flex:1;text-align:center">${isEdit ? 'Save Changes' : 'Add Client'}</button>
        </div>
      </form>
    </div>`;
  }

  function modalChip(ctx) {
    if (!ctx.chipModalKey) return '';
    const data = ctx.chipModalData;
    return `
    <div class="modal-backdrop chip" data-action="modal-backdrop-close" data-which="chip">
      <div class="modal-box" style="width:380px" data-stop>
        <div class="modal-head"><div class="modal-title">${esc(data ? data.title : '')}</div><button type="button" class="modal-close" data-action="modal-close" data-which="chip">✕</button></div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${(data ? data.items : []).map(it => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid oklch(0 0 0 / 0.06)">
              <span style="font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.primary)}</span>
              <span style="font-size:12px;color:oklch(0.48 0.015 150);flex:none">${esc(it.secondary)}</span>
            </div>`).join('')}
          ${(!data || data.items.length === 0) ? `<div style="color:oklch(0.55 0.015 150);font-size:13px;padding:6px 4px">Nothing here yet.</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  /* ---------------- root render ---------------- */

  let ctxGlobal = null;

  function render() {
    const active = document.activeElement;
    const activeBind = active && active.dataset ? active.dataset.bind : null;
    const selStart = active && 'selectionStart' in active ? active.selectionStart : null;
    const selEnd = active && 'selectionEnd' in active ? active.selectionEnd : null;
    const scrollTop = document.querySelector('.main') ? document.querySelector('.main').scrollTop : 0;
    const modalBoxScrollTop = document.querySelector('.modal-box') ? document.querySelector('.modal-box').scrollTop : null;

    const ctx = buildCtx();
    ctxGlobal = ctx;

    const pageMap = {
      dashboard: viewDashboard, shoots: viewShoots, finances: viewFinances,
      expenses: viewExpenses, loans: viewLoans, clients: viewClients,
      docs: viewDocs, insights: viewInsights, goals: viewGoals,
    };
    const pageFn = pageMap[state.view] || viewDashboard;

    const html = `
      <div class="app-shell">
        ${renderSidebar()}
        <main class="main">${pageFn(ctx)}</main>
      </div>
      ${modalChip(ctx)}
      ${modalShoot()}
      ${modalShootConfirmClose()}
      ${modalTelegram(ctx)}
      ${modalLoan()}
      ${modalGoal()}
      ${modalClient()}
    `;

    const app = document.getElementById('app');
    app.innerHTML = html;

    if (state.view === 'dashboard') {
      if (!dashboardCountUpDone) {
        dashboardCountUpDone = true;
        animateCountUps(app);
      }
    } else {
      dashboardCountUpDone = false;
    }

    const mainEl = app.querySelector('.main');
    if (mainEl) mainEl.scrollTop = scrollTop;
    const modalBoxEl = app.querySelector('.modal-box');
    if (modalBoxEl && modalBoxScrollTop != null) modalBoxEl.scrollTop = modalBoxScrollTop;

    if (activeBind) {
      const el = app.querySelector(`[data-bind="${activeBind}"]`);
      if (el) {
        el.focus();
        if (selStart != null && el.setSelectionRange) {
          try { el.setSelectionRange(selStart, selEnd); } catch (e) { /* not a text-like input */ }
        }
      }
    }
  }

  /* ---------------- actions ---------------- */

  function openAddShoot() {
    setState({
      modal: { mode: 'add' }, shootAddonsOpen: false, shootDatePickerOpen: false, timePickerOpen: false, shootDeadlinePickerOpen: false,
      shootDateCalYear: TODAY.getFullYear(), shootDateCalMonth: TODAY.getMonth(),
      shootDeadlineCalYear: TODAY.getFullYear(), shootDeadlineCalMonth: TODAY.getMonth(),
      draft: { id: null, client: '', location: '', date: TODAY_STR, deadline: '', time: '09:00', status: 'idea', scriptStatus: 'Not Started', shootType: 'Real Estate', notes: '', packageTier: 'basic', package: '', paid: '', addons: {} },
    });
  }
  function openEditShoot(id) {
    const sh = state.shoots.find(s => s.id === id);
    if (!sh) return;
    const calBase = new Date((sh.date || TODAY_STR) + 'T00:00:00');
    const deadlineCalBase = new Date((sh.deadline || sh.date || TODAY_STR) + 'T00:00:00');
    setState({
      modal: { mode: 'edit', id }, shootAddonsOpen: false, shootDatePickerOpen: false, timePickerOpen: false, shootDeadlinePickerOpen: false,
      shootDateCalYear: calBase.getFullYear(), shootDateCalMonth: calBase.getMonth(),
      shootDeadlineCalYear: deadlineCalBase.getFullYear(), shootDeadlineCalMonth: deadlineCalBase.getMonth(),
      draft: { packageTier: 'custom', shootType: 'General Project', addons: {}, ...sh },
    });
  }
  function openEditLoan(id) {
    const l = state.loans.find(x => x.id === id);
    if (!l) return;
    setState({ loanModal: { mode: 'edit', id }, loanDraft: { ...l } });
  }
  function openEditGoal(id) {
    const g = state.goals.find(x => x.id === id);
    if (!g) return;
    const currency = g.currency || 'PHP';
    const target = currency === 'USD' ? (g.target ? +(Number(g.target) / USD_TO_PHP).toFixed(2) : '') : g.target;
    const current = currency === 'USD' ? (g.current ? +(Number(g.current) / USD_TO_PHP).toFixed(2) : '') : g.current;
    setState({ goalModal: { mode: 'edit', id }, goalDraft: { ...g, currency, target, current } });
  }
  function openEditClient(id) {
    const c = state.clients.find(x => x.id === id);
    if (!c) return;
    setState({ clientModal: { mode: 'edit', id }, clientDraft: { ...c } });
  }

  function handleAction(action, el, ev) {
    const id = el.dataset.id;
    switch (action) {
      case 'nav':
        try { localStorage.setItem('shoottracker_last_view', el.dataset.view); } catch (e) { /* storage unavailable */ }
        setState({ view: el.dataset.view, mobileNavOpen: false });
        break;
      case 'mobile-nav-toggle': setState(s => ({ mobileNavOpen: !s.mobileNavOpen })); break;
      case 'mobile-nav-close': setState({ mobileNavOpen: false }); break;
      case 'logout': clearUnlocked(); renderLockScreen(false); break;
      case 'chip-open': setState({ chipModal: el.dataset.key }); break;
      case 'telegram-open': setState({ telegramModalOpen: true, expenseDraft: { description: '', amount: '', date: TODAY_STR } }); break;
      case 'search-clear': setState({ [el.dataset.field]: '' }); break;

      case 'shoot-add-open': openAddShoot(); break;
      case 'shoot-edit': openEditShoot(id); break;
      case 'shoot-delete': setState(s => ({ shoots: s.shoots.filter(sh => sh.id !== s.draft.id), modal: null, draft: null })); break;
      case 'shoot-type-pick': setState(s => ({ draft: { ...s.draft, shootType: el.dataset.type } })); break;
      case 'shoot-addons-toggle': setState(s => ({ shootAddonsOpen: !s.shootAddonsOpen })); break;
      case 'shoot-addon-inc': setState(s => ({ draft: { ...s.draft, addons: { ...s.draft.addons, [el.dataset.key]: ((s.draft.addons && s.draft.addons[el.dataset.key]) || 0) + 1 } } })); break;
      case 'shoot-addon-dec': setState(s => ({ draft: { ...s.draft, addons: { ...s.draft.addons, [el.dataset.key]: Math.max(0, ((s.draft.addons && s.draft.addons[el.dataset.key]) || 0) - 1) } } })); break;
      case 'shoot-milestone-pick': setState(s => ({ draft: { ...s.draft, paid: Number(el.dataset.amount) || 0 } })); break;
      case 'date-picker-toggle': setState(s => ({ shootDatePickerOpen: !s.shootDatePickerOpen, timePickerOpen: false })); break;
      case 'time-picker-toggle': setState(s => ({ timePickerOpen: !s.timePickerOpen, shootDatePickerOpen: false })); break;
      case 'shoot-date-cal-prev': setState(s => { let m = s.shootDateCalMonth - 1, y = s.shootDateCalYear; if (m < 0) { m = 11; y--; } return { shootDateCalMonth: m, shootDateCalYear: y }; }); break;
      case 'shoot-date-cal-next': setState(s => { let m = s.shootDateCalMonth + 1, y = s.shootDateCalYear; if (m > 11) { m = 0; y++; } return { shootDateCalMonth: m, shootDateCalYear: y }; }); break;
      case 'date-picker-pick': setState(s => ({ draft: { ...s.draft, date: el.dataset.date }, shootDatePickerOpen: false })); break;
      case 'deadline-picker-toggle': setState(s => ({ shootDeadlinePickerOpen: !s.shootDeadlinePickerOpen, shootDatePickerOpen: false, timePickerOpen: false })); break;
      case 'shoot-deadline-cal-prev': setState(s => { let m = s.shootDeadlineCalMonth - 1, y = s.shootDeadlineCalYear; if (m < 0) { m = 11; y--; } return { shootDeadlineCalMonth: m, shootDeadlineCalYear: y }; }); break;
      case 'shoot-deadline-cal-next': setState(s => { let m = s.shootDeadlineCalMonth + 1, y = s.shootDeadlineCalYear; if (m > 11) { m = 0; y++; } return { shootDeadlineCalMonth: m, shootDeadlineCalYear: y }; }); break;
      case 'deadline-picker-pick': setState(s => ({ draft: { ...s.draft, deadline: el.dataset.date }, shootDeadlinePickerOpen: false })); break;
      case 'deadline-clear': setState(s => ({ draft: { ...s.draft, deadline: '' } })); break;
      case 'time-part-pick': {
        const part = el.dataset.part;
        const value = part === 'meridiem' ? el.dataset.value : Number(el.dataset.value);
        setState(s => ({ draft: { ...s.draft, time: setTimePart(s.draft.time, part, value) } }));
        break;
      }
      case 'shoots-mode': setState({ shootsMode: el.dataset.mode }); break;
      case 'cal-prev': setState(s => { let m = s.calendarMonth - 1, y = s.calendarYear; if (m < 0) { m = 11; y--; } return { calendarMonth: m, calendarYear: y }; }); break;
      case 'cal-next': setState(s => { let m = s.calendarMonth + 1, y = s.calendarYear; if (m > 11) { m = 0; y++; } return { calendarMonth: m, calendarYear: y }; }); break;
      case 'cal-select': setState({ selectedDate: el.dataset.date }); break;

      case 'finance-tab': setState({ financeTab: el.dataset.tab }); break;
      case 'finance-range-toggle': setState(s => {
        if (s.financeRangeCalOpen) return { financeRangeCalOpen: false };
        const base = new Date((s.dateRangeFrom || TODAY_STR) + 'T00:00:00');
        return {
          financeRangeCalOpen: true,
          financeRangeCalYear: base.getFullYear(),
          financeRangeCalMonth: base.getMonth(),
          financeRangeDraftFrom: s.dateRangeFrom,
          financeRangeDraftTo: s.dateRangeTo,
        };
      }); break;
      case 'finance-range-cal-prev': setState(s => { let m = s.financeRangeCalMonth - 1, y = s.financeRangeCalYear; if (m < 0) { m = 11; y--; } return { financeRangeCalMonth: m, financeRangeCalYear: y }; }); break;
      case 'finance-range-cal-next': setState(s => { let m = s.financeRangeCalMonth + 1, y = s.financeRangeCalYear; if (m > 11) { m = 0; y++; } return { financeRangeCalMonth: m, financeRangeCalYear: y }; }); break;
      case 'finance-range-pick': setState(s => {
        const date = el.dataset.date;
        if (!s.financeRangeDraftFrom || s.financeRangeDraftTo) {
          return { financeRangeDraftFrom: date, financeRangeDraftTo: null };
        }
        if (date < s.financeRangeDraftFrom) {
          return { financeRangeDraftFrom: date, financeRangeDraftTo: s.financeRangeDraftFrom };
        }
        return { financeRangeDraftTo: date };
      }); break;
      case 'finance-range-cancel': setState({ financeRangeCalOpen: false }); break;
      case 'finance-range-ok': setState(s => ({
        dateRangeFrom: s.financeRangeDraftFrom || s.dateRangeFrom,
        dateRangeTo: s.financeRangeDraftTo || s.financeRangeDraftFrom || s.dateRangeTo,
        financeRangeCalOpen: false,
      })); break;
      case 'finance-range-today': setState({ dateRangeFrom: TODAY_STR, dateRangeTo: TODAY_STR, financeRangeCalOpen: false }); break;
      case 'finance-range-this-month': setState({ dateRangeFrom: THIS_MONTH_KEY + '-01', dateRangeTo: TODAY_STR, financeRangeCalOpen: false }); break;
      case 'finance-range-last-month': setState(() => {
        const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1);
        const y = d.getFullYear(), m = d.getMonth();
        const lastDay = new Date(y, m + 1, 0).getDate();
        const mm = String(m + 1).padStart(2, '0');
        return {
          dateRangeFrom: `${y}-${mm}-01`,
          dateRangeTo: `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
          financeRangeCalOpen: false,
        };
      }); break;
      case 'fulltime-delete': setState(s => ({ fullTimeIncome: s.fullTimeIncome.filter(f => f.id !== id) })); break;
      case 'expense-delete': setState(s => ({ expenses: s.expenses.filter(e => e.id !== id) })); break;

      case 'expenses-range-toggle': setState(s => {
        if (s.expensesRangeCalOpen) return { expensesRangeCalOpen: false };
        const base = new Date((s.expensesRangeFrom || TODAY_STR) + 'T00:00:00');
        return {
          expensesRangeCalOpen: true,
          expensesRangeCalYear: base.getFullYear(),
          expensesRangeCalMonth: base.getMonth(),
          expensesRangeDraftFrom: s.expensesRangeFrom,
          expensesRangeDraftTo: s.expensesRangeTo,
        };
      }); break;
      case 'expenses-range-cal-prev': setState(s => { let m = s.expensesRangeCalMonth - 1, y = s.expensesRangeCalYear; if (m < 0) { m = 11; y--; } return { expensesRangeCalMonth: m, expensesRangeCalYear: y }; }); break;
      case 'expenses-range-cal-next': setState(s => { let m = s.expensesRangeCalMonth + 1, y = s.expensesRangeCalYear; if (m > 11) { m = 0; y++; } return { expensesRangeCalMonth: m, expensesRangeCalYear: y }; }); break;
      case 'expenses-range-pick': setState(s => {
        const date = el.dataset.date;
        if (!s.expensesRangeDraftFrom || s.expensesRangeDraftTo) {
          return { expensesRangeDraftFrom: date, expensesRangeDraftTo: null };
        }
        if (date < s.expensesRangeDraftFrom) {
          return { expensesRangeDraftFrom: date, expensesRangeDraftTo: s.expensesRangeDraftFrom };
        }
        return { expensesRangeDraftTo: date };
      }); break;
      case 'expenses-range-cancel': setState({ expensesRangeCalOpen: false }); break;
      case 'expenses-range-ok': setState(s => ({
        expensesRangeFrom: s.expensesRangeDraftFrom || s.expensesRangeFrom,
        expensesRangeTo: s.expensesRangeDraftTo || s.expensesRangeDraftFrom || s.expensesRangeTo,
        expensesRangeCalOpen: false,
      })); break;
      case 'expenses-range-today': setState({ expensesRangeFrom: TODAY_STR, expensesRangeTo: TODAY_STR, expensesRangeCalOpen: false }); break;
      case 'expenses-range-this-month': setState({ expensesRangeFrom: THIS_MONTH_KEY + '-01', expensesRangeTo: TODAY_STR, expensesRangeCalOpen: false }); break;
      case 'expenses-range-last-month': setState(() => {
        const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1);
        const y = d.getFullYear(), m = d.getMonth();
        const lastDay = new Date(y, m + 1, 0).getDate();
        const mm = String(m + 1).padStart(2, '0');
        return {
          expensesRangeFrom: `${y}-${mm}-01`,
          expensesRangeTo: `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
          expensesRangeCalOpen: false,
        };
      }); break;

      case 'loan-add-open': setState({ loanModal: { mode: 'add' }, loanDraft: { id: null, lender: '', amount: '', monthlyDue: '', remainingBalance: '', dueDate: '', status: 'ongoing' } }); break;
      case 'loan-edit': openEditLoan(id); break;
      case 'loan-delete':
        if (!confirm(`Are you sure you want to delete the loan "${state.loanDraft.lender || 'this loan'}"? This cannot be undone.`)) break;
        setState(s => ({ loans: s.loans.filter(l => l.id !== s.loanDraft.id), loanModal: null, loanDraft: null }));
        break;

      case 'goal-add-open': setState({ goalModal: { mode: 'add' }, goalDraft: { id: null, name: '', target: '', current: '', currency: 'PHP' } }); break;
      case 'goal-currency-pick': setState(s => {
        const newCurrency = el.dataset.currency;
        if (newCurrency === (s.goalDraft.currency || 'PHP')) return {};
        const factor = newCurrency === 'USD' ? (1 / USD_TO_PHP) : USD_TO_PHP;
        const target = s.goalDraft.target ? +(Number(s.goalDraft.target) * factor).toFixed(2) : '';
        const current = s.goalDraft.current ? +(Number(s.goalDraft.current) * factor).toFixed(2) : '';
        return { goalDraft: { ...s.goalDraft, currency: newCurrency, target, current } };
      }); break;
      case 'goal-edit': openEditGoal(id); break;
      case 'goal-delete':
        if (!confirm(`Are you sure you want to delete the goal "${state.goalDraft.name || 'this goal'}"? This cannot be undone.`)) break;
        setState(s => ({ goals: s.goals.filter(g => g.id !== s.goalDraft.id), goalModal: null, goalDraft: null }));
        break;

      case 'client-add-open': setState({ clientModal: { mode: 'add' }, clientDraft: { id: null, name: '', phone: '', email: '', leadStatus: 'New Lead', followUpDate: '', notes: '' } }); break;
      case 'client-edit': openEditClient(id); break;
      case 'client-delete': setState(s => ({ clients: s.clients.filter(c => c.id !== s.clientDraft.id), clientModal: null, clientDraft: null })); break;
      case 'client-view-shoots': ev.stopPropagation(); setState({ chipModal: 'clientshoots:' + id }); break;

      case 'doc-type': setState({ docType: el.dataset.doctype }); break;
      case 'doc-generate': generateDocPdf(); break;

      case 'insights-period': setState({ insightsPeriod: el.dataset.period }); break;

      case 'modal-close':
      case 'modal-backdrop-close':
        if (el.dataset.which === 'shoot') { setState({ shootConfirmCloseOpen: true }); break; }
        closeModalOf(el.dataset.which);
        break;
      case 'shoot-confirm-close-cancel': setState({ shootConfirmCloseOpen: false }); break;
      case 'shoot-confirm-close-confirm': setState({ modal: null, draft: null, shootConfirmCloseOpen: false }); break;
      default: break;
    }
  }

  function closeModalOf(which) {
    if (which === 'shoot') setState({ modal: null, draft: null, shootConfirmCloseOpen: false });
    else if (which === 'telegram') setState({ telegramModalOpen: false });
    else if (which === 'loan') setState({ loanModal: null, loanDraft: null });
    else if (which === 'goal') setState({ goalModal: null, goalDraft: null });
    else if (which === 'client') setState({ clientModal: null, clientDraft: null });
    else if (which === 'chip') setState({ chipModal: null });
  }

  function generateDocPdf() {
    const jspdf = window.jspdf;
    if (!jspdf || !jspdf.jsPDF) { window.print(); return; }
    const { jsPDF } = jspdf;
    const d = state.docDraft;
    const docType = state.docType;
    const meta = DOC_TYPE_META[docType];
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const marginX = 56, maxW = 500;
    let y = 64;
    const writeLines = (lines, lh) => { lines.forEach(line => { doc.text(line, marginX, y); y += lh; }); };
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text('pol. FILM PRODUCTIONS', marginX, y); y += 30;
    doc.setFontSize(16);
    doc.text(meta.title, marginX, y); y += 18;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
    doc.text(`Pol Film Productions - ${d.date || ''}`, marginX, y); y += 24;
    if (docType === 'invoice') {
      doc.text(`Invoice #${d.invoiceNumber || ''}   Due ${d.dueDate || ''}`, marginX, y); y += 16;
      doc.text(d.clientContact || '', marginX, y); y += 20;
    }
    doc.setTextColor(20); doc.setFontSize(11);
    writeLines(doc.splitTextToSize(meta.body(d), maxW), 15);
    y += 12;
    if (docType === 'invoice') {
      doc.setFont('helvetica', 'bold'); doc.text('Breakdown', marginX, y); y += 16;
      doc.setFont('helvetica', 'normal');
      writeLines(doc.splitTextToSize(d.lineItems || '(none)', maxW), 15);
      y += 10;
      doc.setFont('helvetica', 'bold'); doc.text('Payment Details', marginX, y); y += 16;
      doc.setFont('helvetica', 'normal');
      writeLines(doc.splitTextToSize(d.paymentDetails || '(none)', maxW), 15);
      y += 6;
      doc.text(`Status: ${d.paymentStatus || ''}`, marginX, y); y += 20;
    }
    if (d.notes) { doc.setFontSize(10); doc.setTextColor(90); writeLines(doc.splitTextToSize(d.notes, maxW), 13); }
    doc.save(`${docType}-${(d.clientName || 'document').replace(/\s+/g, '-')}.pdf`);
  }

  /* ---------------- generic bind handling ---------------- */

  function applyBind(path, value) {
    state = setPath(state, path, value);
  }

  function applySpecialSideEffect(special, value) {
    if (special === 'packageTier') {
      const meta = getLiveTiers(state.packageRates).find(t => t.value === value);
      state = setPath(state, 'draft.packageTier', value);
      if (meta && meta.price !== null) state = setPath(state, 'draft.package', meta.price);
    } else if (special === 'shootStatus') {
      state = setPath(state, 'draft.status', value);
      if (value === 'tentative') state = setPath(state, 'draft.date', '');
    }
  }

  /* ---------------- event wiring ---------------- */

  let listenersWired = false;

  function wireListeners() {
    if (listenersWired) return;
    listenersWired = true;
    const app = document.getElementById('app');

    app.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if ((state.shootDatePickerOpen || state.timePickerOpen || state.financeRangeCalOpen || state.expensesRangeCalOpen || state.shootDeadlinePickerOpen) && !e.target.closest('[data-picker-popover]')) {
        const action = actionEl ? actionEl.dataset.action : null;
        if (action !== 'date-picker-toggle' && action !== 'time-picker-toggle' && action !== 'finance-range-toggle' && action !== 'expenses-range-toggle' && action !== 'deadline-picker-toggle') {
          setState({ shootDatePickerOpen: false, timePickerOpen: false, financeRangeCalOpen: false, expensesRangeCalOpen: false, shootDeadlinePickerOpen: false });
        }
      }
      if (!actionEl) return;
      const stopEl = e.target.closest('[data-stop]');
      if (stopEl && !stopEl.contains(actionEl)) return;
      handleAction(actionEl.dataset.action, actionEl, e);
    });

    app.addEventListener('dragstart', (e) => {
      const card = e.target.closest('[draggable="true"]');
      if (card) draggingId = card.dataset.id;
    });

    app.addEventListener('dblclick', (e) => {
      const cell = e.target.closest('[data-action="cal-select"]');
      if (!cell) return;
      const date = cell.dataset.date;
      const dayShoots = state.shoots.filter(s => s.date === date);
      if (dayShoots.length === 1) openEditShoot(dayShoots[0].id);
    });

    app.addEventListener('dragover', (e) => {
      const zone = e.target.closest('[data-dropzone]');
      if (zone) e.preventDefault();
    });
    app.addEventListener('drop', (e) => {
      const zone = e.target.closest('[data-dropzone]');
      if (!zone) return;
      e.preventDefault();
      const status = zone.dataset.status;
      if (draggingId) {
        setState(s => {
          const shoots = s.shoots.map(sh => sh.id === draggingId ? { ...sh, status } : sh);
          const clients = status === 'posted'
            ? promoteClientToCompleted(s.clients, (s.shoots.find(sh => sh.id === draggingId) || {}).client)
            : s.clients;
          return clients !== s.clients ? { shoots, clients } : { shoots };
        });
        draggingId = null;
      }
    });

    app.addEventListener('input', (e) => {
      // <select> elements fire both 'input' and 'change' on the same user action. Handling
      // 'input' here would re-render (replacing the DOM) before 'change' has a chance to
      // bubble, silently dropping any data-special side effect wired to 'change'. Selects
      // are atomic choices anyway, so let 'change' alone handle them.
      if (e.target.tagName === 'SELECT') return;
      const bind = e.target.dataset.bind;
      if (bind) {
        applyBind(bind, e.target.value);
        render();
      }
    });

    app.addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.actionChange === 'doc-client-pick') {
        const id = el.value;
        if (id) {
          const c = state.clients.find(cl => cl.id === id);
          if (c) {
            const contact = [c.phone, c.email].filter(Boolean).join(' · ');
            state = setPath(state, 'docDraft.clientName', c.name);
            state = setPath(state, 'docDraft.clientContact', contact);
            render();
          }
        }
        return;
      }
      if (el.dataset.special === 'packageRate') {
        const key = el.dataset.key;
        const v = Number(el.value) || 0;
        setState(s => ({ packageRates: { ...s.packageRates, [key]: v } }));
        return;
      }
      const special = el.dataset.special;
      if (special) { applySpecialSideEffect(special, el.value); render(); return; }
      const bind = el.dataset.bind;
      if (bind) { applyBind(bind, el.value); render(); }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (state.shootConfirmCloseOpen) {
        e.preventDefault(); e.stopPropagation();
        setState({ shootConfirmCloseOpen: false });
      } else if (state.shootDatePickerOpen || state.timePickerOpen || state.financeRangeCalOpen || state.shootDeadlinePickerOpen) {
        e.preventDefault(); e.stopPropagation();
        setState({ shootDatePickerOpen: false, timePickerOpen: false, financeRangeCalOpen: false, shootDeadlinePickerOpen: false });
      } else if (state.modal) {
        e.preventDefault(); e.stopPropagation();
        setState({ shootConfirmCloseOpen: true });
      } else if (state.loanModal || state.goalModal || state.clientModal || state.telegramModalOpen || state.chipModal) {
        e.preventDefault(); e.stopPropagation();
        closeModalOf(state.loanModal ? 'loan' : state.goalModal ? 'goal' : state.clientModal ? 'client' : state.telegramModalOpen ? 'telegram' : 'chip');
      }
    });

    app.addEventListener('submit', (e) => {
      const form = e.target.closest('form[data-action]');
      if (!form) return;
      e.preventDefault();
      const action = form.dataset.action;
      if (action === 'save-shoot') {
        const d = state.draft;
        const isRealEstate = d.shootType === 'Real Estate';
        const liveTiers = getLiveTiers(state.packageRates);
        const packageAmount = (!isRealEstate || d.packageTier === 'custom')
          ? (Number(d.package) || 0)
          : ((liveTiers.find(t => t.value === d.packageTier) || {}).price || 0);
        const addons = d.addons || {};
        const addonsTotal = ADDON_DEFS.reduce((sum, ad) => sum + (addons[ad.key] || 0) * ad.price, 0);
        const cleaned = { ...d, package: packageAmount + addonsTotal, paid: Number(d.paid) || 0 };
        setState(s => {
          const name = (cleaned.client || '').trim();
          const hasClient = name && s.clients.some(c => c.name.trim().toLowerCase() === name.toLowerCase());
          let clients = (name && !hasClient)
            ? [...s.clients, { id: 'c' + Date.now(), name, phone: '', email: '', leadStatus: 'Booked', followUpDate: '', notes: '' }]
            : s.clients;
          if (cleaned.status === 'posted') clients = promoteClientToCompleted(clients, name);
          const shoots = s.modal.mode === 'add'
            ? [...s.shoots, { ...cleaned, id: 'sh' + Date.now() }]
            : s.shoots.map(sh => sh.id === cleaned.id ? cleaned : sh);
          return { shoots, modal: null, draft: null, shootConfirmCloseOpen: false, ...(clients !== s.clients ? { clients } : {}) };
        });
      } else if (action === 'save-telegram-expense') {
        const d = state.expenseDraft;
        if (!d.description || !d.amount) { setState({ telegramModalOpen: false }); return; }
        const entry = { id: 'ex' + Date.now(), description: d.description, amount: Number(d.amount) || 0, date: d.date || TODAY_STR };
        setState(s => ({ expenses: [...s.expenses, entry], telegramModalOpen: false }));
      } else if (action === 'save-fulltime') {
        const d = state.ftDraft;
        if (!d.source || !d.amount) return;
        const entry = { id: 'ft' + Date.now(), source: d.source, amount: Number(d.amount) || 0, date: d.date || TODAY_STR };
        setState(s => ({ fullTimeIncome: [...s.fullTimeIncome, entry], ftDraft: { source: '', amount: '', date: TODAY_STR } }));
      } else if (action === 'save-loan') {
        const d = state.loanDraft;
        const cleaned = { ...d, amount: Number(d.amount) || 0, monthlyDue: Number(d.monthlyDue) || 0, remainingBalance: Number(d.remainingBalance) || 0 };
        setState(s => s.loanModal.mode === 'add'
          ? { loans: [...s.loans, { ...cleaned, id: 'ln' + Date.now() }], loanModal: null, loanDraft: null }
          : { loans: s.loans.map(l => l.id === cleaned.id ? cleaned : l), loanModal: null, loanDraft: null });
      } else if (action === 'save-goal') {
        const d = state.goalDraft;
        const isUSD = d.currency === 'USD';
        const target = isUSD ? Math.round((Number(d.target) || 0) * USD_TO_PHP) : (Number(d.target) || 0);
        const current = isUSD ? Math.round((Number(d.current) || 0) * USD_TO_PHP) : (Number(d.current) || 0);
        const cleaned = { ...d, target, current };
        setState(s => s.goalModal.mode === 'add'
          ? { goals: [...s.goals, { ...cleaned, id: 'g' + Date.now() }], goalModal: null, goalDraft: null }
          : { goals: s.goals.map(g => g.id === cleaned.id ? cleaned : g), goalModal: null, goalDraft: null });
      } else if (action === 'save-client') {
        const d = state.clientDraft;
        setState(s => s.clientModal.mode === 'add'
          ? { clients: [...s.clients, { ...d, id: 'c' + Date.now() }], clientModal: null, clientDraft: null }
          : { clients: s.clients.map(c => c.id === d.id ? d : c), clientModal: null, clientDraft: null });
      }
    });

  }

  let clockIntervalStarted = false;
  function startClockInterval() {
    if (clockIntervalStarted) return;
    clockIntervalStarted = true;
    setInterval(() => render(), 30000);
  }

  async function init() {
    wireListeners();
    startClockInterval();
    const app = document.getElementById('app');
    app.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:14px">Loading your data…</div>`;

    try {
      const remote = await fetchRemoteState();
      if (remote) {
        // null/undefined = column never saved to yet (show empty); an actual [] means
        // someone intentionally emptied that list, which must be respected, not overwritten.
        PERSIST_KEYS.forEach(k => {
          let val = remote[PERSIST_COLUMNS[k]];
          if (val == null) return;
          if (k === 'shoots') {
            val = val.map(sh => ({
              ...sh,
              status: normalizeShootStatus(sh.status),
              scriptStatus: normalizeScriptStatus(sh.scriptStatus),
              shootType: normalizeShootType(sh.shootType),
            }));
          } else if (k === 'goals') {
            val = val.map(g => ({ currency: 'PHP', ...g }));
          }
          state = { ...state, [k]: val };
        });
        // Self-heal: clients whose linked shoot(s) are already Completed but who are
        // still stuck in an earlier leads-pipeline status (e.g. "Booked") get bumped
        // to "Client" once, and the correction is persisted so it doesn't recur.
        if (state.shoots.length && state.clients.length) {
          const completedClientNames = new Set(
            state.shoots.filter(sh => sh.status === 'posted').map(sh => sh.client.trim().toLowerCase())
          );
          let clientsChanged = false;
          const correctedClients = state.clients.map(c => {
            if (completedClientNames.has(c.name.trim().toLowerCase()) && c.leadStatus !== 'Client' && c.leadStatus !== 'Lost') {
              clientsChanged = true;
              return { ...c, leadStatus: 'Client' };
            }
            return c;
          });
          if (clientsChanged) {
            state = { ...state, clients: correctedClients };
            persist(['clients']);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load shared data, showing local defaults', e);
    }

    // Restore last-viewed page (per-device) so a refresh doesn't bounce you back to Dashboard.
    try {
      const savedView = localStorage.getItem('shoottracker_last_view');
      const VALID_VIEWS = ['dashboard', 'shoots', 'clients', 'finances', 'expenses', 'loans', 'goals', 'docs', 'insights'];
      if (savedView && VALID_VIEWS.includes(savedView)) {
        state = { ...state, view: savedView };
      }
    } catch (e) { /* storage unavailable */ }

    render();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (isWithinUnlockGrace()) init();
    else renderLockScreen(false);
  });
})();
