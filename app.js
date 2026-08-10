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
    { key: 'rawFootage',  label: 'Raw Footage + Color Grading', price: 3000, unitLabel: 'flat rate', flat: true },
    { key: 'walkthrough', label: 'Walkthrough Video', price: 3000, unitLabel: 'per video' },
    { key: 'aiScene',     label: 'AI Scene', price: 1000, unitLabel: 'per scene' },
  ];
  const USD_TO_PHP = 58;
  const SHOOT_TYPES = ['Real Estate', 'General Project'];
  const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const MONTH_SHORT_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const LEAD_STATUSES = ['New Lead', 'Contacted', 'Proposal Sent', 'Booked', 'Client', 'Lost'];
  // Display-only labels — the stored value stays 'Client' (so old Supabase records and all the
  // leadStatus === 'Client' checks throughout the app keep working), but "Client" read confusingly
  // next to a page that's already called "Clients." Shown as "Completed" instead, everywhere.
  const LEAD_STATUS_LABELS = { Client: 'Completed' };
  function leadStatusLabel(v) { return LEAD_STATUS_LABELS[v] || v; }
  const LEAD_STATUS_META = {
    'New Lead':      { color: 'oklch(0.5 0.16 235)',  bg: 'oklch(0.55 0.15 235 / 0.16)' },
    'Contacted':     { color: 'oklch(0.58 0.16 80)',  bg: 'oklch(0.62 0.15 80 / 0.16)' },
    'Proposal Sent': { color: 'oklch(0.55 0.12 175)', bg: 'oklch(0.55 0.12 175 / 0.16)' },
    'Booked':        { color: 'oklch(0.55 0.14 150)', bg: 'oklch(0.55 0.14 150 / 0.16)' },
    'Client':        { color: 'oklch(0.45 0.14 150)', bg: 'oklch(0.5 0.13 150 / 0.14)' },
    'Lost':          { color: 'oklch(0.48 0.015 150)', bg: 'oklch(0.48 0.015 150 / 0.16)' },
  };

  const DOC_TYPE_META = {
    contract:  { title: 'Service Agreement / Contract', body: (d, mf = fmtMoney) => `This Service Agreement is entered into between Pol Film Productions and ${d.clientName || '[Client Name]'} for the production of "${d.description || '[Project/Service]'}", to be delivered on ${d.date || '[Date]'} for a total contract value of ${mf(d.amount)}.` },
    quotation: { title: 'Quotation',                      body: (d, mf = fmtMoney) => `Thank you for the opportunity to work with you. Below is our proposed scope of work and pricing for ${d.description || '[Project/Service]'}. This quotation is valid until ${d.dueDate ? fmtDateShortYear(d.dueDate) : '[Valid Until]'}.` },
    invoice:   { title: 'Statement of Account',           body: (d, mf = fmtMoney) => `Invoice billed to ${d.clientName || '[Client Name]'} for "${d.description || '[Project/Service]'}", dated ${d.date || '[Date]'}. Amount due: ${mf(d.amount)}.` },
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
  function formatInvoiceNumber(n) {
    return `SOA-${TODAY_STR.slice(0, 4)}-${String(n).padStart(3, '0')}`;
  }
  function fmtMoney(n) {
    n = Number(n) || 0;
    // Whole pesos display with no decimals (₱8,000); anything with centavos always shows
    // exactly 2 decimal places (₱89,960.30) instead of the inconsistent 1-or-0 that
    // Number.prototype.toLocaleString gives by default.
    const hasCents = Math.round(n * 100) % 100 !== 0;
    return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 });
  }
  // Splits a free-text "Line Items Breakdown" field (one entry per line, e.g.
  // "Package fee - ₱10,000") into { label, amount } rows for the itemized invoice table.
  // Used by both the on-screen preview and the generated PDF so they stay in sync.
  function parseLineItems(str) {
    return String(str || '').split('\n').map(s => s.trim()).filter(Boolean).map(line => {
      const idx = line.lastIndexOf(' - ');
      const label = idx === -1 ? line : line.slice(0, idx).trim();
      const tail = idx === -1 ? '' : line.slice(idx + 3).trim();
      const cleaned = tail.replace(/PHP/gi, '').replace(/₱/g, '').replace(/,/g, '').trim();
      const amount = cleaned && !isNaN(Number(cleaned)) ? Number(cleaned) : null;
      return { label, amount };
    });
  }
  // Strips anything that isn't a digit or decimal point from a money input's raw typed value
  // (commas, letters, extra dots) — this is what actually gets stored in state, so calculations
  // (Number(...)) never see commas. Only the DISPLAYED value gets comma-formatted.
  function sanitizeMoneyInput(v) {
    v = String(v == null ? '' : v).replace(/[^\d.]/g, '');
    const dotIdx = v.indexOf('.');
    if (dotIdx !== -1) v = v.slice(0, dotIdx + 1) + v.slice(dotIdx + 1).replace(/\./g, '');
    return v;
  }
  // Live "as-you-type" thousands-separator formatting for money inputs, e.g. "9584.02" -> "9,584.02".
  function formatMoneyLiveDisplay(v) {
    const s = sanitizeMoneyInput(v);
    if (!s) return '';
    const dotIdx = s.indexOf('.');
    let intPart = dotIdx === -1 ? s : s.slice(0, dotIdx);
    const decPart = dotIdx === -1 ? null : s.slice(dotIdx + 1);
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart !== null ? `${intPart}.${decPart}` : intPart;
  }
  // After reformatting adds/removes commas, the cursor's raw character-index no longer lines up
  // with the same visual spot — walk the new formatted string until we've passed the same number
  // of non-comma characters that were to the left of the cursor before formatting.
  function moneyCursorAfterFormat(formatted, rawCharsBeforeCursor) {
    if (rawCharsBeforeCursor <= 0) return 0;
    let count = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (formatted[i] !== ',') count++;
      if (count >= rawCharsBeforeCursor) return i + 1;
    }
    return formatted.length;
  }
  function fmtDateLong(dstr) {
    if (!dstr) return '—';
    const dt = new Date(dstr + 'T00:00:00');
    return isNaN(dt) ? dstr : dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  function fmtDate(dstr) {
    if (!dstr) return 'No date';
    const d = new Date(dstr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function fmtDateShortYear(dstr) {
    if (!dstr) return '—';
    const d = new Date(dstr + 'T00:00:00');
    return isNaN(d) ? dstr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  function ordinal(n) {
    n = Number(n);
    const v = n % 100;
    const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
    return n + (suffixes[v - 20] || suffixes[v] || 'th');
  }
  // Loans have a recurring monthly due DAY (e.g. "the 23rd") rather than a one-time date —
  // this finds the next actual calendar date that day falls on (today if it's today, else
  // next month), clamping to the last day of shorter months (e.g. day 31 in Feb -> Feb 28/29).
  function nextMonthlyDueDate(dueDay) {
    const day = Number(dueDay);
    if (!day || day < 1 || day > 31) return null;
    const clampedDayIn = (y, m) => Math.min(day, new Date(y, m + 1, 0).getDate());
    let y = TODAY.getFullYear(), m = TODAY.getMonth();
    let d = clampedDayIn(y, m);
    if (d < TODAY.getDate()) {
      m += 1; if (m > 11) { m = 0; y++; }
      d = clampedDayIn(y, m);
    }
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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
  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function downloadCSV(filename, rows) {
    const csvBody = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  function buildCalendarCells(year, month, shoots, selectedDate, disableFuture) {
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
      const isFuture = disableFuture && dateStr > TODAY_STR;
      cells.push({
        dayNum: d, dateStr, disabled: isFuture,
        bg: isSelected ? 'oklch(0.55 0.14 150 / 0.22)' : (isToday ? 'oklch(0 0 0 / 0.06)' : 'oklch(0.97 0.006 150)'),
        border: isSelected ? 'oklch(0.55 0.14 150 / 0.6)' : 'oklch(0 0 0 / 0.05)',
        textColor: isFuture ? 'oklch(0.75 0.01 150)' : (isToday ? 'oklch(0.6 0.15 150)' : 'oklch(0.35 0.015 150)'),
        // Two representations of the same day's shoots: `dots` (small colored dots) is still
        // used by the compact date-picker popover inside the Shoot modal, where there's no room
        // for text. `shootItems`/`extraShootCount` (client name + location) is used by the big
        // Shoots-page calendar, which has room to show real details instead of just dots.
        dots: dayShoots.slice(0, 4).map(s => statusMeta(s.status).color),
        shootItems: dayShoots.slice(0, 2).map(s => ({ client: s.client || 'Untitled', location: s.location || '', color: statusMeta(s.status).color })),
        extraShootCount: Math.max(0, dayShoots.length - 2),
      });
    }
    return cells;
  }

  function buildExpenseCalendarCells(year, month, expenses, selectedDate) {
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ blank: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      const dayExpenses = expenses.filter(e => e.date === dateStr);
      const dayTotal = dayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const isToday = dateStr === TODAY_STR;
      const isSelected = dateStr === selectedDate;
      cells.push({
        dayNum: d, dateStr,
        bg: isSelected ? 'oklch(0.55 0.14 150 / 0.22)' : (isToday ? 'oklch(0 0 0 / 0.06)' : 'oklch(0.97 0.006 150)'),
        border: isSelected ? 'oklch(0.55 0.14 150 / 0.6)' : 'oklch(0 0 0 / 0.05)',
        textColor: isToday ? 'oklch(0.6 0.15 150)' : 'oklch(0.35 0.015 150)',
        hasExpense: dayExpenses.length > 0,
        dayTotalLabel: dayExpenses.length > 0 ? fmtMoney(dayTotal) : '',
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

  /* ---------------- Supabase config ---------------- */

  const SUPABASE_URL = 'https://lufmszmhflmecvpislwy.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_z8a0uQ0ri_txFoxzPvYV2A_4xRG44N-';
  const SUPABASE_ROW_URL = `${SUPABASE_URL}/rest/v1/tracker_state?id=eq.1`;

  /* ---------------- auth (real Supabase email + password login) ---------------- */

  const AUTH_TOKEN_KEY = 'shoottracker_access_token';
  const AUTH_REFRESH_KEY = 'shoottracker_refresh_token';
  const AUTH_EXPIRES_KEY = 'shoottracker_expires_at';
  let accessToken = null;

  function saveSession(sess) {
    accessToken = sess.access_token || null;
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, sess.access_token);
      localStorage.setItem(AUTH_REFRESH_KEY, sess.refresh_token);
      localStorage.setItem(AUTH_EXPIRES_KEY, String(Date.now() + ((sess.expires_in || 3600) * 1000)));
    } catch (e) { /* storage unavailable */ }
  }
  function clearSession() {
    accessToken = null;
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_REFRESH_KEY);
      localStorage.removeItem(AUTH_EXPIRES_KEY);
    } catch (e) { /* storage unavailable */ }
  }
  // kept so the existing 'logout' action keeps working
  function clearUnlocked() { clearSession(); }

  async function signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Invalid login');
    saveSession(await res.json());
  }
  async function refreshSession() {
    let rt = null;
    try { rt = localStorage.getItem(AUTH_REFRESH_KEY); } catch (e) { /* storage unavailable */ }
    if (!rt) return false;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) { clearSession(); return false; }
    saveSession(await res.json());
    return true;
  }
  // True if we already hold a valid (or refreshable) session, so a refresh keeps you logged in.
  async function ensureSession() {
    let token = null, exp = 0;
    try {
      token = localStorage.getItem(AUTH_TOKEN_KEY);
      exp = Number(localStorage.getItem(AUTH_EXPIRES_KEY));
    } catch (e) { /* storage unavailable */ }
    if (token && exp && Date.now() < exp - 60000) { accessToken = token; return true; }
    return await refreshSession();
  }
  // Every Supabase REST call goes through here, sending the logged-in user's token
  // (not the public key) and auto-refreshing once if the token has expired.
  async function authedFetch(url, opts = {}) {
    const build = () => ({
      ...opts,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken || SUPABASE_KEY}`,
        ...(opts.headers || {}),
      },
    });
    let res = await fetch(url, build());
    if (res.status === 401 && await refreshSession()) res = await fetch(url, build());
    return res;
  }

  function renderLockScreen(showError) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:20px">
        <form id="lock-form" style="width:320px;max-width:100%;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:28px;display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;justify-content:center;margin-bottom:2px"><div class="logo-badge">pol.</div></div>
          <div class="sg" style="font-weight:700;font-size:16px;text-align:center">Pol Tracker</div>
          <div class="field">
            <label>Email</label>
            <input type="email" id="lock-email" placeholder="you@email.com" autocomplete="username"/>
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="lock-password" placeholder="Enter password" autocomplete="current-password"/>
          </div>
          ${showError ? `<div style="color:oklch(0.58 0.19 25);font-size:12.5px">Incorrect email or password. Please try again.</div>` : ''}
          <button type="submit" class="btn-primary" style="text-align:center">Sign in</button>
        </form>
      </div>`;
    const emailInput = document.getElementById('lock-email');
    const input = document.getElementById('lock-password');
    emailInput.focus();
    document.getElementById('lock-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await signIn(emailInput.value.trim(), input.value);
        init();
      } catch (err) {
        renderLockScreen(true);
      }
    });
  }

  /* ---------------- state ---------------- */

  function defaultState() {
    return {
      view: 'dashboard',
      mobileNavOpen: false,
      sidebarCollapsed: localStorage.getItem('shoottracker_sidebar_collapsed') === '1',
      shoots: [],
      expenses: [],
      loans: [],
      fullTimeIncome: [],
      goals: [],
      clients: [],
      packageRates: { basic: 8000, standard: 10000, premium: 12000, ultimate: 18000 },
      financeTab: 'sidehustle',
      financeMonthKey: THIS_MONTH_KEY,
      ftDraft: { sourceType: '1st', sourceOther: '', amount: '', date: TODAY_STR },
      ftDraftDatePickerOpen: false, ftDraftDateCalYear: TODAY.getFullYear(), ftDraftDateCalMonth: TODAY.getMonth(),
      dashMonthKey: THIS_MONTH_KEY,
      modal: null,
      draft: null,
      draftDateLocked: false,
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
      expensesMonthKey: THIS_MONTH_KEY,
      expensesSelectedDate: TODAY_STR,
      expensesDayCalYear: TODAY.getFullYear(),
      expensesDayCalMonth: TODAY.getMonth(),
      expensesReportYear: TODAY.getFullYear(),
      expensesReportSelectedMonth: THIS_MONTH_KEY,
      expensesListOpen: false,
      loanModal: null,
      loanDraft: null,
      loanPaymentModal: null,
      loanPaymentDraft: null,
      goalModal: null,
      goalDraft: null,
      goalFundModal: null,
      goalFundDraft: null,
      clientModal: null,
      clientDraft: null,
      docType: 'contract',
      invoiceCounter: Number(localStorage.getItem('shoottracker_invoice_counter')) || 1,
      docDatePickerOpen: false, docDateCalYear: TODAY.getFullYear(), docDateCalMonth: TODAY.getMonth(),
      docDuePickerOpen: false, docDueCalYear: TODAY.getFullYear(), docDueCalMonth: TODAY.getMonth(),
      docDraft: { clientName: '', description: '', amount: '', date: TODAY_STR, notes: '', invoiceNumber: formatInvoiceNumber(Number(localStorage.getItem('shoottracker_invoice_counter')) || 1), dueDate: addDays(TODAY_STR, 10), clientContact: '', lineItems: '', paymentDetails: '', paymentStatus: 'Unpaid', packageTotal: '', paidToDate: '', milestoneLabel: '' },
      documents: [],
      docsHistoryOpen: false,
      editingDocId: null,
      insightsChartYear: TODAY.getFullYear(),
      insightsChartSelectedMonth: THIS_MONTH_KEY,
      chipModal: null,
      shootsSearch: '', clientsSearch: '', expensesSearch: '', loansSearch: '', goalsSearch: '',
    };
  }

  const PERSIST_KEYS = ['shoots', 'expenses', 'loans', 'fullTimeIncome', 'goals', 'clients', 'packageRates', 'documents'];
  const PERSIST_COLUMNS = { shoots: 'shoots', expenses: 'expenses', loans: 'loans', fullTimeIncome: 'full_time_income', goals: 'goals', clients: 'clients', packageRates: 'package_rates', documents: 'documents' };

  async function fetchRemoteState() {
    const cols = Object.values(PERSIST_COLUMNS).join(',');
    const res = await authedFetch(`${SUPABASE_ROW_URL}&select=${cols}`);
    if (!res.ok) throw new Error('Failed to load remote state: ' + res.status);
    const rows = await res.json();
    return rows[0] || null;
  }

  // --- offline (view-only) support ---
  const DATA_CACHE_KEY = 'shoottracker_data_cache';
  function saveDataCache(remote) {
    try { localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(remote)); } catch (e) { /* storage full/unavailable */ }
  }
  function loadDataCache() {
    try { const raw = localStorage.getItem(DATA_CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  // Copy a persisted-columns object (from the server OR the offline cache) into state,
  // applying the same normalizations used on load.
  function applyPersistedData(remote) {
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
  }

  // --- save indicator (Saving… / Saved / Save failed — Retry) ---
  let saveIndicatorTimer = null;
  let lastFailedKeys = null;
  function ensureSaveIndicatorEl() {
    let el = document.getElementById('save-indicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'save-indicator';
      el.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2000;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,0.16);display:none;align-items:center;gap:6px;font-family:Inter,system-ui,sans-serif';
      document.body.appendChild(el);
    }
    return el;
  }
  function showSaveStatus(kind) {
    const el = ensureSaveIndicatorEl();
    if (saveIndicatorTimer) { clearTimeout(saveIndicatorTimer); saveIndicatorTimer = null; }
    el.style.display = 'flex';
    if (kind === 'saving') {
      el.style.background = 'oklch(0.95 0.015 150)'; el.style.color = 'oklch(0.42 0.02 150)';
      el.textContent = 'Saving…';
    } else if (kind === 'saved') {
      el.style.background = 'oklch(0.92 0.08 150)'; el.style.color = 'oklch(0.36 0.13 150)';
      el.textContent = '✓ Saved';
      saveIndicatorTimer = setTimeout(() => { el.style.display = 'none'; }, 1600);
    } else if (kind === 'error') {
      el.style.background = 'oklch(0.62 0.19 25)'; el.style.color = '#fff';
      el.innerHTML = '⚠ Save failed <button type="button" id="save-retry" style="all:unset;cursor:pointer;text-decoration:underline;margin-left:4px;font-weight:700">Retry</button>';
      const btn = document.getElementById('save-retry');
      if (btn) btn.addEventListener('click', () => { if (lastFailedKeys) persist(lastFailedKeys); });
    }
  }

  // Persists only the PERSIST_KEYS that actually changed, each to its own column —
  // this way a change to one entity (e.g. clients) can never clobber another (e.g. loans)
  // even if two tabs/devices save at nearly the same time. Retries twice on failure,
  // and shows a Saving…/Saved/Save failed indicator so a silent failure can't hide.
  async function persist(changedKeys, attempt) {
    attempt = attempt || 0;
    const payload = {};
    changedKeys.forEach(k => { payload[PERSIST_COLUMNS[k]] = state[k]; });
    showSaveStatus('saving');
    try {
      const res = await authedFetch(SUPABASE_ROW_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      lastFailedKeys = null;
      showSaveStatus('saved');
    } catch (e) {
      console.error('Save failed', e);
      if (attempt < 2) {
        setTimeout(() => persist(changedKeys, attempt + 1), 1500 * (attempt + 1));
      } else {
        lastFailedKeys = changedKeys;
        showSaveStatus('error');
      }
    }
  }

  let state = defaultState();
  let offlineMode = false;
  let draggingId = null;
  let dashboardCountUpDone = false;
  let dashboardCountUpMonthKey = null;

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
    const changedKeys = PERSIST_KEYS.filter(k => k in partial);
    // Offline = view-only. Block any change that would touch saved data, so we never
    // show a "saved" edit that didn't actually reach the cloud (or overwrite fresh data).
    if (offlineMode && changedKeys.length) {
      alert("You're offline — editing is disabled. Reconnect to the internet to make changes.");
      return;
    }
    state = { ...state, ...partial };
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
    // Booked/Resched haven't started editing yet, so the countdown that matters is the shoot
    // date itself. Once it's in Editing (or later), the countdown switches to the edit/delivery
    // deadline (falling back to the shoot date if no deadline was set).
    const usesShootDateOnly = status === 'idea' || status === 'resched';
    const days = daysLeftOf(usesShootDateOnly ? sh.date : (sh.deadline || sh.date));
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

    const dashMonthKey = state.dashMonthKey || THIS_MONTH_KEY;
    const dashMonthLabel = new Date(dashMonthKey + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const completed = shoots.filter(s => s.status === 'posted');
    // "Pending" / outstanding counts only confirmed shoots (Booked onward) —
    // Not-confirmed (tentative) shoots are excluded until they're actually booked.
    const outstanding = shoots.filter(s => s.status !== 'tentative').reduce((sum, s) => sum + Math.max((Number(s.package) || 0) - (Number(s.paid) || 0), 0), 0);

    // Dashboard-card-specific: follows the dashMonthKey month switcher.
    const dashMonthShoots = shoots.filter(s => s.date && s.date.slice(0, 7) === dashMonthKey);

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
      // dueDay (1-31) is the recurring monthly due day (e.g. "every 23rd"); older records may
      // only have a one-time dueDate, so fall back to that date's day-of-month for compatibility.
      const dueDay = l.dueDay ? Number(l.dueDay) : (l.dueDate ? new Date(l.dueDate + 'T00:00:00').getDate() : null);
      const nextDue = (!isPaid && dueDay) ? nextMonthlyDueDate(dueDay) : null;
      const dueDays = nextDue ? daysLeftOf(nextDue) : null;
      const dueBadge = dueDays !== null ? daysLeftLabelAndColor(dueDays) : null;
      const monthlyDueNum = Number(l.monthlyDue) || 0;
      const remainingNum = Number(l.remainingBalance) || 0;
      const monthsLeft = (!isPaid && monthlyDueNum > 0 && remainingNum > 0) ? Math.ceil(remainingNum / monthlyDueNum) : null;
      return {
        ...l, paidPercent, dueDay,
        statusLabel: isPaid ? 'Paid Off' : 'Ongoing',
        statusColor: isPaid ? 'oklch(0.5 0.15 150)' : 'oklch(0.58 0.16 80)',
        statusBg: isPaid ? 'oklch(0.75 0.15 160 / 0.16)' : 'oklch(0.78 0.14 80 / 0.16)',
        amountLabel: fmtMoney(l.amount), remainingLabel: fmtMoney(l.remainingBalance), monthlyDueLabel: fmtMoney(l.monthlyDue),
        dueLabel: dueDay ? `Due every ${ordinal(dueDay)} of the month` : 'No active due date',
        showDueBadge: !!dueBadge, dueBadgeLabel: dueBadge ? dueBadge.label : '', dueBadgeColor: dueBadge ? dueBadge.color : '',
        monthsLeftLabel: isPaid ? 'Paid off ✓' : (monthsLeft !== null ? `~${monthsLeft} month${monthsLeft === 1 ? '' : 's'} left to pay off` : null),
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

    const expensesMonthKey = state.expensesMonthKey || THIS_MONTH_KEY;
    const expensesMonthLabel = new Date(expensesMonthKey + '-01' + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const monthExpenseRows = allExpenseRows.filter(e => e.date && e.date.slice(0, 7) === expensesMonthKey);
    const monthExpensesTotal = monthExpenseRows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const filteredExpenseRows = monthExpenseRows.filter(e => e.description.toLowerCase().includes(state.expensesSearch.toLowerCase()));

    const expensesSelectedDate = state.expensesSelectedDate || TODAY_STR;
    const expensesSelectedDayLabel = expensesSelectedDate === TODAY_STR ? 'Today' : fmtDate(expensesSelectedDate);
    const expensesSelectedDayRows = allExpenseRows.filter(e => e.date === expensesSelectedDate);
    const expensesSelectedDayTotal = expensesSelectedDayRows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const expensesCalMonthLabel = new Date(state.expensesDayCalYear, state.expensesDayCalMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const expensesCalCells = buildExpenseCalendarCells(state.expensesDayCalYear, state.expensesDayCalMonth, expenses, expensesSelectedDate);

    // Per-month bar chart for a given year — a quick "monthly report" view, separate from the
    // day-level calendar above, so Pol can see the whole year's spending pattern at a glance.
    const expensesReportYear = state.expensesReportYear || TODAY.getFullYear();
    const expensesReportSelectedMonth = state.expensesReportSelectedMonth || THIS_MONTH_KEY;
    const expensesReportMonthsRaw = Array.from({ length: 12 }, (_, i) => {
      const mk = `${expensesReportYear}-${String(i + 1).padStart(2, '0')}`;
      const total = expenses.filter(e => e.date && e.date.slice(0, 7) === mk).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      return {
        monthKey: mk,
        monthLabel: new Date(expensesReportYear, i, 1).toLocaleDateString('en-US', { month: 'long' }),
        shortLabel: MONTH_SHORT_LABELS[i],
        total,
        isCurrentMonth: mk === THIS_MONTH_KEY,
        isSelected: mk === expensesReportSelectedMonth,
      };
    });
    const maxExpensesReportMonth = Math.max(...expensesReportMonthsRaw.map(m => m.total), 1);
    const expensesReportMonths = expensesReportMonthsRaw.map(m => ({
      ...m,
      totalLabel: fmtMoney(m.total),
      heightPx: m.total > 0 ? Math.max(6, Math.round((m.total / maxExpensesReportMonth) * 130)) : 4,
      fill: m.isSelected
        ? 'linear-gradient(180deg, oklch(0.65 0.18 30), oklch(0.5 0.18 25))'
        : (m.total > 0 ? 'oklch(0.88 0.05 25)' : 'oklch(0.93 0.01 150)'),
    }));
    const expensesReportYearTotal = expensesReportMonths.reduce((s, m) => s + m.total, 0);

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

    // Single shared month-switcher (‹ Month Year ›) drives all three Finances sub-tabs
    // (Side Hustle, Full-Time, Combined) so they all use the same simple picker.
    const financeMonthKey = state.financeMonthKey || THIS_MONTH_KEY;
    const financeMonthLabel = new Date(financeMonthKey + '-01' + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const ftMonthIncome = fullTimeIncome.filter(f => f.date && f.date.slice(0, 7) === financeMonthKey);
    const ftMonthTotal = ftMonthIncome.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const ftMonthRows = ftMonthIncome.slice().sort((a, b) => b.date.localeCompare(a.date)).map(f => ({ ...f, dateLabel: fmtDate(f.date), amountLabel: fmtMoney(f.amount) }));
    const monthShoots = shoots.filter(s => s.date && s.date.slice(0, 7) === financeMonthKey);
    const monthSideHustleCollected = monthShoots.reduce((sum, s) => sum + (Number(s.paid) || 0), 0);
    const monthCombinedTotal = ftMonthTotal + monthSideHustleCollected;
    const monthFullTimeSharePercent = monthCombinedTotal > 0 ? Math.round((ftMonthTotal / monthCombinedTotal) * 100) : 0;
    const monthSideHustleSharePercent = monthCombinedTotal > 0 ? 100 - monthFullTimeSharePercent : 0;

    const clientRows = state.clients.map(c => {
      const lm = LEAD_STATUS_META[c.leadStatus] || LEAD_STATUS_META['New Lead'];
      const linked = shoots.filter(s => s.client.trim().toLowerCase() === c.name.trim().toLowerCase());
      // Only leads still "in play" (not yet Booked/Client, and not Lost) count as overdue —
      // those already have a final outcome, so a past follow-up date there is meaningless.
      const isTentative = c.leadStatus !== 'Booked' && c.leadStatus !== 'Client' && c.leadStatus !== 'Lost';
      const followUpOverdue = !!(isTentative && c.followUpDate && c.followUpDate < TODAY_STR);
      return {
        ...c, statusColor: lm.color, statusBg: lm.bg,
        followUpLabel: c.followUpDate ? fmtDate(c.followUpDate) : 'None set',
        followUpOverdue,
        shootCountLabel: linked.length > 0 ? `${linked.length} shoot(s) · ${fmtMoney(linked.reduce((s, x) => s + (Number(x.package) || 0), 0))}` : 'No shoots yet',
        linkedShoots: linked,
      };
    }).filter(c => c.name.toLowerCase().includes(state.clientsSearch.toLowerCase()));
    const activeClients = state.clients.filter(c => c.leadStatus === 'Booked' || c.leadStatus === 'Client').length;

    const monthPaidFromShoots = shoots.filter(s => s.date && s.date.slice(0, 7) === THIS_MONTH_KEY).reduce((s, x) => s + (Number(x.paid) || 0), 0);
    const monthlyRevenue = monthPaidFromShoots + monthFullTime;
    const netProfit = monthlyRevenue - monthTotal;

    const dashMonthPaidFromShoots = shoots.filter(s => s.date && s.date.slice(0, 7) === dashMonthKey).reduce((s, x) => s + (Number(x.paid) || 0), 0);
    const dashMonthFullTime = fullTimeIncome.filter(f => f.date && f.date.slice(0, 7) === dashMonthKey).reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const dashMonthlyRevenue = dashMonthPaidFromShoots + dashMonthFullTime;
    const dashMonthExpenses = expenses.filter(e => e.date && e.date.slice(0, 7) === dashMonthKey).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const dashNetProfit = dashMonthlyRevenue - dashMonthExpenses;

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
      { key: 'thisMonth', label: dashMonthKey === THIS_MONTH_KEY ? 'Shoots This Month' : `Shoots in ${dashMonthLabel}`, value: String(dashMonthShoots.length), sub: dashMonthKey === THIS_MONTH_KEY ? 'Booked for this month' : `Booked for ${dashMonthLabel}`, hero: true },
      { key: 'completed', label: 'Completed', value: String(completed.length), sub: 'Delivered to clients', hero: false },
      { key: 'activeClients', label: 'Active Clients', value: String(activeClients), sub: 'Booked or ongoing', hero: false },
    ];

    const chipModalKey = state.chipModal;
    const CHIP_MODAL_META = {
      thisMonth: { title: dashMonthKey === THIS_MONTH_KEY ? 'Shoots This Month' : `Shoots in ${dashMonthLabel}`, items: dashMonthShoots.map(s => ({ primary: s.client, secondary: s.dateLabel })) },
      completed: { title: 'Completed Shoots', items: completed.map(s => ({ primary: s.client, secondary: s.dateLabel })) },
      activeClients: { title: 'Active Clients', items: state.clients.filter(c => c.leadStatus === 'Booked' || c.leadStatus === 'Client').map(c => ({ primary: c.name, secondary: leadStatusLabel(c.leadStatus) })) },
      outstandingBalances: {
        title: 'Outstanding Balances',
        items: shoots
          .filter(s => (Number(s.package) || 0) - (Number(s.paid) || 0) > 0)
          .sort((a, b) => ((Number(b.package) || 0) - (Number(b.paid) || 0)) - ((Number(a.package) || 0) - (Number(a.paid) || 0)))
          .map(s => ({ primary: s.client, secondary: fmtMoney((Number(s.package) || 0) - (Number(s.paid) || 0)) })),
      },
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

    const goalsAvgPercent = goalCards.length ? Math.round(goalCards.reduce((s, g) => s + g.percent, 0) / goalCards.length) : 0;
    const insightCards = [
      { icon: '📊', title: 'Outstanding Balances', text: outstanding > 0 ? `You have ${fmtMoney(outstanding)} in outstanding balances across your shoots.` : 'No outstanding balance on any shoots — everything is paid up.', clickKey: outstanding > 0 ? 'outstandingBalances' : null },
      { icon: '🎯', title: 'Goal Tracking', bars: [
        { label: 'Savings Goals Progress', percent: goalsAvgPercent, sub: `${goalsAvgPercent}% average completion` },
        { label: 'Yearly Income Progress', percent: yearlyProgressPercent, sub: `${yearlyProgressPercent}% of ${fmtMoney(yearlyGoalIncome)} target` },
      ] },
    ];
    const chartMax = Math.max(monthlyRevenue, monthTotal, 1);

    // Overview chart: combined earnings (full-time + side hustle collected) per month,
    // for the currently-selected year, shown as a 12-bar chart on the Insights page.
    const overviewYear = state.insightsChartYear || TODAY.getFullYear();
    const selectedMonthKey = state.insightsChartSelectedMonth || THIS_MONTH_KEY;
    const earningsByMonth = MONTH_SHORT_LABELS.map((label, i) => {
      const mKey = `${overviewYear}-${String(i + 1).padStart(2, '0')}`;
      const ftSum = fullTimeIncome.filter(f => f.date && f.date.slice(0, 7) === mKey).reduce((s, f) => s + (Number(f.amount) || 0), 0);
      const shSum = shoots.filter(s => s.date && s.date.slice(0, 7) === mKey).reduce((s, x) => s + (Number(x.paid) || 0), 0);
      return { label, monthKey: mKey, total: ftSum + shSum, isSelected: mKey === selectedMonthKey };
    });
    const maxEarningsMonth = Math.max(...earningsByMonth.map(m => m.total), 1);
    const overviewBars = earningsByMonth.map(m => ({
      label: m.label,
      monthKey: m.monthKey,
      total: m.total,
      totalLabel: fmtMoney(m.total),
      isSelected: m.isSelected,
      heightPx: m.total > 0 ? Math.max(6, Math.round((m.total / maxEarningsMonth) * 130)) : 4,
      fill: m.isSelected
        ? 'linear-gradient(180deg, oklch(0.6 0.15 150), oklch(0.4 0.13 150))'
        : (m.total > 0 ? 'oklch(0.86 0.05 150)' : 'oklch(0.93 0.01 150)'),
    }));

    // "Revenue vs Expenses" card on Insights follows whichever month is currently
    // selected in the Overview chart above it, instead of always being "this month".
    const selMonthLabel = new Date(selectedMonthKey + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const selMonthRevenue = (fullTimeIncome.filter(f => f.date && f.date.slice(0, 7) === selectedMonthKey).reduce((s, f) => s + (Number(f.amount) || 0), 0))
      + (shoots.filter(s => s.date && s.date.slice(0, 7) === selectedMonthKey).reduce((s, x) => s + (Number(x.paid) || 0), 0));
    const selMonthExpenses = expenses.filter(e => e.date && e.date.slice(0, 7) === selectedMonthKey).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const selMonthNetProfit = selMonthRevenue - selMonthExpenses;
    const selMonthChartMax = Math.max(selMonthRevenue, selMonthExpenses, 1);

    // Top Clients: total paid-to-date grouped by client name, biggest contributors first.
    const clientTotals = {};
    shoots.forEach(s => {
      const name = (s.client || '').trim();
      if (!name) return;
      if (!clientTotals[name]) clientTotals[name] = { name, total: 0, count: 0 };
      clientTotals[name].total += Number(s.paid) || 0;
      clientTotals[name].count += 1;
    });
    const topClients = Object.values(clientTotals)
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(c => ({ name: c.name, totalLabel: fmtMoney(c.total), shootsLabel: `${c.count} shoot${c.count === 1 ? '' : 's'}` }));

    // Biggest Expenses: top 5 single largest expense entries, all-time.
    const biggestExpenses = expenses.slice()
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 5)
      .map(e => ({ description: e.description || 'Untitled', dateLabel: fmtDate(e.date), amountLabel: fmtMoney(e.amount) }));

    return {
      view, shoots, navColor, goalCards, completed, outstanding,
      upcomingList, nextUpList, noNextUp, columns, totalPackage, totalPaid, loanCards,
      todayTotal, monthTotal, analysisText, analysisColor, recentExpenses, allExpenseRows,
      filteredExpenseRows, lastExp, monthLabel, calendarCells, selectedDateShoots,
      expensesMonthKey, expensesMonthLabel, monthExpensesTotal,
      expensesSelectedDate, expensesSelectedDayLabel, expensesSelectedDayTotal, expensesSelectedDayRows,
      expensesCalMonthLabel, expensesCalCells,
      expensesReportYear, expensesReportMonths, expensesReportYearTotal,
      totalFullTime, monthFullTime, fullTimeRows, combinedTotal, fullTimeSharePercent, sideHustleSharePercent,
      financeMonthKey, financeMonthLabel, ftMonthTotal, ftMonthRows,
      monthShoots, monthSideHustleCollected, monthCombinedTotal, monthFullTimeSharePercent, monthSideHustleSharePercent,
      clientRows, activeClients, monthlyRevenue, netProfit, yearlyGoalIncome, yearlyProgressPercent,
      overviewBars, overviewYear,
      selMonthLabel, selMonthRevenue, selMonthExpenses, selMonthNetProfit, selMonthChartMax,
      topClients, biggestExpenses,
      dashMonthKey, dashMonthLabel, dashMonthlyRevenue, dashMonthExpenses, dashNetProfit,
      userFirstName, liveDateTimeLabel, weekRangeLabel, weekBars, statCards,
      chipModalKey, chipModalData, insightCards, chartMax,
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
    return `<button type="button" class="nav-btn" style="color:${c.color};background:${c.bg}" data-action="nav" data-view="${action || view}" title="${esc(label)}">
      <span class="ic"><i class="ti ti-${icon}" aria-hidden="true"></i></span><span class="nav-label">${esc(label)}</span>
    </button>`;
  }

  function renderSidebar() {
    const open = state.mobileNavOpen;
    const collapsed = state.sidebarCollapsed;
    return `
    <div class="mobile-topbar">
      <button type="button" class="hamburger-btn" data-action="mobile-nav-toggle"><span></span><span></span><span></span></button>
      <div class="logo-badge" style="padding:6px 10px;font-size:13px">pol.</div>
      <div class="sg" style="font-weight:700;font-size:14px">Pol Tracker</div>
    </div>
    ${open ? `<div class="sidebar-backdrop" data-action="mobile-nav-close"></div>` : ''}
    <aside class="sidebar${open ? ' open' : ''}${collapsed ? ' collapsed' : ''}">
      <div class="logo-wrap">
        <button type="button" class="logo-hamburger" data-action="sidebar-toggle" title="${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}"><span></span><span></span><span></span></button>
        <div class="logo-badge">pol.</div>
      </div>
      <nav class="navlist">
        ${navBtn('dashboard', 'layout-dashboard', 'Dashboard')}
        <div class="nav-section">Production</div>
        ${navBtn('shoots', 'video', 'Shoots')}
        ${navBtn('clients', 'user', 'Clients')}
        <div class="nav-section">Money</div>
        ${navBtn('finances', 'wallet', 'Income')}
        ${navBtn('expenses', 'receipt', 'Expenses')}
        ${navBtn('loans', 'building-bank', 'Loans')}
        ${navBtn('goals', 'target-arrow', 'Goals')}
        <div class="nav-section">Tools</div>
        ${navBtn('docs', 'file-text', 'Documents')}
        ${navBtn('insights', 'chart-bar', 'Insights')}
      </nav>
      <button type="button" class="nav-btn" style="margin-top:auto;color:oklch(0.58 0.19 25)" data-action="logout" title="Log out">
        <span class="ic"><i class="ti ti-logout" aria-hidden="true"></i></span><span class="nav-label">Log out</span>
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
          <div style="font-size:12.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:oklch(0.9 0.05 150)">${ctx.dashMonthKey === THIS_MONTH_KEY ? 'This Month' : 'Viewing Month'}</div>
          <div style="display:flex;align-items:center;gap:6px">
            <button type="button" data-action="dash-month-prev" style="all:unset;cursor:pointer;width:22px;height:22px;border-radius:7px;background:oklch(1 0 0 / 0.18);display:flex;align-items:center;justify-content:center;font-size:12px;color:oklch(1 0 0)">‹</button>
            <div style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:oklch(1 0 0 / 0.18);min-width:70px;text-align:center">${ctx.dashMonthLabel}</div>
            <button type="button" data-action="dash-month-next" style="all:unset;cursor:pointer;width:22px;height:22px;border-radius:7px;background:oklch(1 0 0 / 0.18);display:flex;align-items:center;justify-content:center;font-size:12px;color:oklch(1 0 0)">›</button>
            ${ctx.dashMonthKey !== THIS_MONTH_KEY ? `<button type="button" data-action="dash-month-today" style="all:unset;cursor:pointer;padding:3px 9px;border-radius:20px;font-size:10.5px;font-weight:700;background:oklch(1 0 0 / 0.28);color:oklch(1 0 0)">Today</button>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:36px;margin-top:8px;flex-wrap:wrap">
          <div>
            <div style="font-size:11.5px;color:oklch(0.85 0.06 150);text-transform:uppercase;letter-spacing:0.04em">Income</div>
            <div class="sg" data-count-up="${Math.round(ctx.dashMonthlyRevenue)}" data-count-prefix="₱" style="font-size:36px;font-weight:700;margin-top:4px">₱0</div>
          </div>
          <div>
            <div style="font-size:11.5px;color:oklch(0.85 0.06 150);text-transform:uppercase;letter-spacing:0.04em">Expenses</div>
            <div class="sg" data-count-up="${Math.round(ctx.dashMonthExpenses)}" data-count-prefix="₱" style="font-size:36px;font-weight:700;margin-top:4px">₱0</div>
          </div>
        </div>
        <div style="display:flex;gap:26px;margin-top:14px;flex-wrap:wrap">
          <div><div style="font-size:11px;color:oklch(0.85 0.06 150);text-transform:uppercase;letter-spacing:0.04em">Net Profit</div><div data-count-up="${Math.round(ctx.dashNetProfit)}" data-count-prefix="₱" style="font-size:16px;font-weight:700;margin-top:2px">₱0</div></div>
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
              : `<div class="cal-cell" style="background:${c.bg};border:1px solid ${c.border};align-items:stretch;text-align:left;overflow:hidden" data-action="cal-select" data-date="${c.dateStr}">
                  <div style="font-size:12px;font-weight:600;color:${c.textColor}">${c.dayNum}</div>
                  <div style="display:flex;flex-direction:column;gap:2px;overflow:hidden">
                    ${c.shootItems.map(si => `
                      <div style="font-size:9px;line-height:1.25;overflow:hidden">
                        <div style="font-weight:700;color:${si.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(si.client)}</div>
                        ${si.location ? `<div style="color:oklch(0.55 0.015 150);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(si.location)}</div>` : ''}
                      </div>`).join('')}
                    ${c.extraShootCount > 0 ? `<div style="font-size:9px;font-weight:700;color:oklch(0.5 0.015 150)">+${c.extraShootCount} more</div>` : ''}
                  </div>
                </div>`).join('')}
          </div>
        </div>
        <div style="width:280px;flex:none" class="card">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px">
            <div class="card-title" style="margin-bottom:0">${state.selectedDate ? fmtDate(state.selectedDate) : 'Select a date'}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
            ${ctx.selectedDateShoots.map(s => `
              <div style="background:var(--card2);border-radius:10px;padding:11px;cursor:pointer" data-action="shoot-edit" data-id="${esc(s.id)}">
                <div style="font-weight:600;font-size:13.5px;margin-bottom:3px">${esc(s.client)}</div>
                <div style="color:oklch(0.48 0.015 150);font-size:12px">${s.timeLabel} · ${esc(s.location)}</div>
              </div>`).join('')}
            ${ctx.selectedDateShoots.length === 0 ? `<div style="color:oklch(0.55 0.015 150);font-size:13px">No shoots this day.</div>` : ''}
          </div>
          ${state.selectedDate ? `<button type="button" class="btn-primary" style="width:100%;box-sizing:border-box;text-align:center" data-action="shoot-add-open-for-date">+ New Shoot on ${fmtDate(state.selectedDate)}</button>` : ''}
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

    const sideHustle = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:28px">
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Collected</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px;color:oklch(0.5 0.15 150)">${fmtMoney(ctx.monthSideHustleCollected)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Remaining Balance</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px;color:oklch(0.62 0.17 45)">${fmtMoney(ctx.outstanding)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Total Package Value</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px">${fmtMoney(ctx.totalPackage)}</div></div>
      </div>
      <div class="table-wrap">
        <div class="t-head" style="grid-template-columns:1.6fr 1fr 1fr 1fr 1fr"><div>Client / Project</div><div>Status</div><div>Package</div><div>Paid</div><div>Remaining Balance</div></div>
        ${ctx.monthShoots.map(s => `
          <div class="t-row" style="grid-template-columns:1.6fr 1fr 1fr 1fr 1fr;cursor:pointer" data-action="shoot-edit" data-id="${esc(s.id)}">
            <div><div style="font-weight:600;font-size:14px">${esc(s.client)}</div><div style="color:oklch(0.48 0.015 150);font-size:12px;margin-top:2px">${esc(s.location)}</div></div>
            <div style="font-size:12.5px;color:oklch(0.4 0.015 150)">${s.statusLabel}</div>
            <div><div style="font-size:13.5px;font-weight:600">${s.packageLabel}</div><div style="color:oklch(0.5 0.015 150);font-size:11px;margin-top:2px">${s.packageTierLabel}</div></div>
            <div style="font-size:13.5px;color:oklch(0.5 0.15 150)">${s.paidLabel}</div>
            <div style="font-size:13.5px;font-weight:700;color:${s.balanceColor}">${s.balanceLabel}</div>
          </div>`).join('')}
        ${ctx.monthShoots.length === 0 ? `<div style="padding:20px;color:oklch(0.55 0.015 150);font-size:13px">No shoots in ${esc(ctx.financeMonthLabel)}.</div>` : ''}
      </div>`;

    const financeMonthPicker = `
      <div style="display:flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:10px 14px">
        <button type="button" data-action="ft-month-prev" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">‹</button>
        <div class="sg" style="font-weight:700;font-size:13.5px;min-width:120px;text-align:center">${ctx.financeMonthLabel}</div>
        <button type="button" data-action="ft-month-next" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">›</button>
        ${ctx.financeMonthKey !== THIS_MONTH_KEY ? `<button type="button" data-action="ft-month-today" style="all:unset;cursor:pointer;margin-left:6px;padding:5px 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:var(--card2);color:oklch(0.35 0.02 150)">This Month</button>` : ''}
      </div>`;

    const ftDraftDateLabel = state.ftDraft.date ? fmtDate(state.ftDraft.date) : 'Select date';
    const ftDraftDateMonthLabel = new Date(state.ftDraftDateCalYear, state.ftDraftDateCalMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const ftDraftDateCells = buildCalendarCells(state.ftDraftDateCalYear, state.ftDraftDateCalMonth, [], state.ftDraft.date, true);
    const ftDraftDatePicker = `
      <div class="field" style="flex:1;min-width:130px;position:relative">
        <label>Date</label>
        <button type="button" data-action="ftdraft-date-toggle" style="all:unset;cursor:pointer;width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--border3);border-radius:9px;padding:10px 12px;color:inherit;font-size:14px;font-family:inherit;display:flex;align-items:center;justify-content:space-between">
          <span>${ftDraftDateLabel}</span>
        </button>
        ${state.ftDraftDatePickerOpen ? `
        <div data-picker-popover style="position:absolute;left:0;top:calc(100% + 6px);background:var(--panel);border:1px solid var(--border3);border-radius:14px;padding:16px;box-shadow:0 12px 28px oklch(0 0 0 / 0.14);z-index:80;min-width:260px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div class="sg" style="font-weight:700;font-size:15px">${ftDraftDateMonthLabel}</div>
            <div style="display:flex;gap:6px">
              <button type="button" data-action="ftdraft-date-cal-prev" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">‹</button>
              <button type="button" data-action="ftdraft-date-cal-next" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">›</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
            ${WEEKDAY_LABELS.map(w => `<div style="text-align:center;font-size:10.5px;font-weight:700;color:oklch(0.55 0.015 150)">${w}</div>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
            ${ftDraftDateCells.map(c => c.blank ? `<div></div>` : `
              <div ${c.disabled ? '' : `data-action="ftdraft-date-pick" data-date="${c.dateStr}"`} style="aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:${c.disabled ? 'not-allowed' : 'pointer'};font-size:12.5px;font-weight:600;background:${c.bg};border:1px solid ${c.border};color:${c.textColor}">${c.dayNum}</div>`).join('')}
          </div>
        </div>` : ''}
      </div>`;

    const fullTime = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Total Full-Time Income</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px">${fmtMoney(ctx.totalFullTime)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">${esc(ctx.ftMonthLabel)}</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px">${fmtMoney(ctx.ftMonthTotal)}</div></div>
      </div>
      <div class="card" style="margin-bottom:24px">
        <div class="card-title">Add Income</div>
        <form data-action="save-fulltime" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
          <div class="field" style="flex:1.4;min-width:150px"><label>Source</label>
            <select data-bind="ftDraft.sourceType">
              <option value="1st" ${state.ftDraft.sourceType === '1st' ? 'selected' : ''}>1st Cutoff</option>
              <option value="2nd" ${state.ftDraft.sourceType === '2nd' ? 'selected' : ''}>2nd Cutoff</option>
              <option value="other" ${state.ftDraft.sourceType === 'other' ? 'selected' : ''}>Others</option>
            </select>
          </div>
          ${state.ftDraft.sourceType === 'other' ? `<div class="field" style="flex:1.4;min-width:150px"><label>Please Specify</label><input type="text" value="${esc(state.ftDraft.sourceOther)}" data-bind="ftDraft.sourceOther" placeholder="e.g. December Bonus" required/></div>` : ''}
          <div class="field" style="flex:1;min-width:110px"><label>Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(state.ftDraft.amount))}" data-bind="ftDraft.amount" data-fmt="money" placeholder="0" required/></div>
          ${ftDraftDatePicker}
          <button type="submit" class="btn-primary">Add</button>
        </form>
      </div>
      <div class="table-wrap">
        <div class="t-head" style="grid-template-columns:2fr 1fr 1fr 32px"><div>Source</div><div>Date</div><div>Amount</div><div></div></div>
        ${ctx.ftMonthRows.map(f => `
          <div class="t-row" style="grid-template-columns:2fr 1fr 1fr 32px">
            <div style="font-weight:600;font-size:14px">${esc(f.source)}</div>
            <div style="font-size:12.5px;color:oklch(0.45 0.015 150)">${f.dateLabel}</div>
            <div style="font-size:13.5px;font-weight:600;color:oklch(0.5 0.15 150)">${f.amountLabel}</div>
            <button type="button" style="all:unset;cursor:pointer;color:oklch(0.48 0.015 150);font-size:14px;text-align:right" data-action="fulltime-delete" data-id="${esc(f.id)}" title="Delete">✕</button>
          </div>`).join('')}
        ${ctx.ftMonthRows.length === 0 ? `<div style="padding:20px;color:oklch(0.55 0.015 150);font-size:13px">No income entries for ${esc(ctx.ftMonthLabel)}.</div>` : ''}
      </div>`;

    const combinedRows = [
      ...ctx.ftMonthRows.map(f => ({ date: f.date, dateLabel: f.dateLabel, source: 'Full-Time', label: f.source || 'Full-Time Income', amountLabel: f.amountLabel })),
      ...ctx.monthShoots.filter(s => (Number(s.paid) || 0) > 0).map(s => ({ date: s.date, dateLabel: s.dateLabel, source: 'Side Hustle', label: s.client || 'Shoot', amountLabel: fmtMoney(s.paid) })),
    ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const combined = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Full-Time</div><div class="sg" style="font-size:24px;font-weight:700;margin-top:8px">${fmtMoney(ctx.ftMonthTotal)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Side Hustle Collected</div><div class="sg" style="font-size:24px;font-weight:700;margin-top:8px">${fmtMoney(ctx.monthSideHustleCollected)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Combined Income</div><div class="sg" style="font-size:24px;font-weight:700;margin-top:8px;color:oklch(0.55 0.12 175)">${fmtMoney(ctx.monthCombinedTotal)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.45 0.015 150);font-size:12.5px;font-weight:600;text-transform:uppercase">Remaining Balance</div><div class="sg" style="font-size:24px;font-weight:700;margin-top:8px;color:oklch(0.62 0.17 45)">${fmtMoney(ctx.outstanding)}</div></div>
      </div>
      <div class="card" style="margin-bottom:24px">
        <div class="card-title">Income Split</div>
        <div style="height:14px;border-radius:8px;overflow:hidden;display:flex;background:oklch(0.91 0.012 150)">
          <div style="width:${ctx.monthFullTimeSharePercent}%;background:oklch(0.55 0.12 175)"></div>
          <div style="width:${ctx.monthSideHustleSharePercent}%;background:oklch(0.55 0.14 150)"></div>
        </div>
        <div style="display:flex;gap:20px;margin-top:12px;font-size:12.5px">
          <div style="display:flex;align-items:center;gap:6px;color:oklch(0.42 0.015 150)"><span style="width:9px;height:9px;border-radius:50%;background:oklch(0.55 0.12 175)"></span>Full-Time (${ctx.monthFullTimeSharePercent}%)</div>
          <div style="display:flex;align-items:center;gap:6px;color:oklch(0.42 0.015 150)"><span style="width:9px;height:9px;border-radius:50%;background:oklch(0.55 0.14 150)"></span>Side Hustle (${ctx.monthSideHustleSharePercent}%)</div>
        </div>
      </div>
      <div class="table-wrap">
        <div class="t-head" style="grid-template-columns:1fr 1.4fr 2fr 1fr"><div>Date</div><div>Source</div><div>Details</div><div>Amount</div></div>
        ${combinedRows.map(r => `
          <div class="t-row" style="grid-template-columns:1fr 1.4fr 2fr 1fr">
            <div style="font-size:12.5px;color:oklch(0.45 0.015 150)">${r.dateLabel}</div>
            <div><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;padding:3px 9px;border-radius:20px;background:${r.source === 'Full-Time' ? 'oklch(0.92 0.05 175)' : 'oklch(0.92 0.06 150)'};color:${r.source === 'Full-Time' ? 'oklch(0.4 0.1 175)' : 'oklch(0.4 0.13 150)'}">${r.source}</span></div>
            <div style="font-size:13.5px;font-weight:600">${esc(r.label)}</div>
            <div style="font-size:13.5px;font-weight:600">${r.amountLabel}</div>
          </div>`).join('')}
        ${combinedRows.length === 0 ? `<div style="padding:24px 20px;color:oklch(0.55 0.015 150);font-size:13.5px">No income recorded in ${esc(ctx.financeMonthLabel)}.</div>` : ''}
      </div>`;

    return `
    <div class="page-head">
      <div><div class="page-title sg">Finances</div><div class="page-sub">Package value vs. what's been collected</div></div>
      ${financeMonthPicker}
    </div>
    <div class="tabbar" style="margin-bottom:24px">
      ${tab('sidehustle', 'Side Hustle')}${tab('fulltime', 'Full-Time')}${tab('combined', 'Combined')}
    </div>
    ${state.financeTab === 'sidehustle' ? sideHustle : state.financeTab === 'fulltime' ? fullTime : combined}`;
  }

  /* ---------------- expenses ---------------- */

  function viewExpenses(ctx) {
    const searchClear = state.expensesSearch ? `<button type="button" class="search-clear" data-action="search-clear" data-field="expensesSearch">✕</button>` : '';

    const expensesMonthPicker = `
      <div style="display:flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:10px 14px">
        <button type="button" data-action="expenses-month-prev" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">‹</button>
        <div class="sg" style="font-weight:700;font-size:13.5px;min-width:120px;text-align:center">${ctx.expensesMonthLabel}</div>
        <button type="button" data-action="expenses-month-next" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">›</button>
        ${ctx.expensesMonthKey !== THIS_MONTH_KEY ? `<button type="button" data-action="expenses-month-today" style="all:unset;cursor:pointer;margin-left:6px;padding:5px 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:var(--card2);color:oklch(0.35 0.02 150)">This Month</button>` : ''}
      </div>`;

    // Instead of a popover date-picker, a permanent calendar (like the Shoots calendar view)
    // with a side panel — click any date to see exactly what was spent that day, plus its
    // total. Days with spending show a small peso total right on the cell.
    const expensesCalendarSection = `
      <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;margin-bottom:24px">
        <div style="flex:1;min-width:320px;background:var(--panel2);border-radius:16px;padding:20px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <button type="button" class="btn-ghost" style="padding:6px 10px;border-radius:8px;font-size:15px" data-action="expenses-day-cal-prev">‹</button>
            <div class="sg" style="font-weight:700;font-size:15px">${ctx.expensesCalMonthLabel}</div>
            <button type="button" class="btn-ghost" style="padding:6px 10px;border-radius:8px;font-size:15px" data-action="expenses-day-cal-next">›</button>
          </div>
          <div class="cal-grid" style="margin-bottom:8px">
            ${WEEKDAY_LABELS.map(wd => `<div style="text-align:center;font-size:11px;color:oklch(0.55 0.015 150);font-weight:700;padding-bottom:4px">${wd}</div>`).join('')}
          </div>
          <div class="cal-grid">
            ${ctx.expensesCalCells.map(c => c.blank
              ? `<div></div>`
              : `<div class="cal-cell" style="background:${c.bg};border:1px solid ${c.border}" data-action="expenses-day-pick" data-date="${c.dateStr}">
                  <div style="font-size:12px;font-weight:600;color:${c.textColor}">${c.dayNum}</div>
                  ${c.hasExpense ? `<div style="font-size:9.5px;font-weight:700;color:oklch(0.58 0.19 25)">${c.dayTotalLabel}</div>` : ''}
                </div>`).join('')}
          </div>
        </div>
        <div style="width:280px;flex:none" class="card">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
            <div class="card-title" style="margin-bottom:0">${esc(ctx.expensesSelectedDayLabel)}</div>
            ${ctx.expensesSelectedDate !== TODAY_STR ? `<button type="button" data-action="expenses-day-today" style="all:unset;cursor:pointer;font-size:11px;font-weight:600;color:oklch(0.45 0.14 150)">Today</button>` : ''}
          </div>
          <div class="sg" style="font-size:22px;font-weight:700;margin-bottom:14px">${fmtMoney(ctx.expensesSelectedDayTotal)}</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${ctx.expensesSelectedDayRows.map(ex => `
              <div style="background:var(--card2);border-radius:10px;padding:11px">
                <div style="font-weight:600;font-size:13.5px;margin-bottom:3px">${esc(ex.description)}</div>
                <div style="color:oklch(0.48 0.015 150);font-size:12px">${ex.amountLabel}</div>
              </div>`).join('')}
            ${ctx.expensesSelectedDayRows.length === 0 ? `<div style="color:oklch(0.55 0.015 150);font-size:13px">No expenses this day.</div>` : ''}
          </div>
        </div>
      </div>`;

    return `
    <div class="page-head">
      <div><div class="page-title sg">Expenses</div><div class="page-sub">Everything you've spent, logged via Telegram or manually</div></div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        ${expensesMonthPicker}
        <button type="button" class="btn-ghost" style="padding:9px 14px;border-radius:9px;background:var(--card2);font-size:13px;font-weight:600;color:oklch(0.35 0.02 150)" data-action="expenses-report-export" title="Download the year's itemized expenses as a CSV">⬇ Export</button>
        <button type="button" class="btn-telegram" data-action="telegram-open">+ Add Expense</button>
      </div>
    </div>
    ${expensesCalendarSection}
    <button type="button" data-action="expenses-list-toggle" style="all:unset;cursor:pointer;display:flex;align-items:center;justify-content:space-between;width:100%;box-sizing:border-box;background:var(--panel2);border-radius:12px;padding:12px 16px;margin-bottom:${state.expensesListOpen ? '16' : '24'}px">
      <span style="font-size:13px;font-weight:700;color:oklch(0.3 0.02 150)">${state.expensesListOpen ? '▾' : '▸'} Full list — ${esc(ctx.expensesMonthLabel)} (${ctx.filteredExpenseRows.length})</span>
      <span style="font-size:13px;font-weight:700;color:oklch(0.4 0.02 150)">${fmtMoney(ctx.monthExpensesTotal)}</span>
    </button>
    ${state.expensesListOpen ? `
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
      ${ctx.filteredExpenseRows.length === 0 ? `<div style="padding:24px 20px;color:oklch(0.55 0.015 150);font-size:13.5px">No expenses in ${esc(ctx.expensesMonthLabel)}.</div>` : ''}
    </div>` : ''}
    <div class="card" style="margin-top:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
        <div class="card-title" style="margin-bottom:0">Monthly Report</div>
        <div style="display:flex;align-items:center;gap:8px;background:var(--card2);border-radius:10px;padding:6px 10px">
          <button type="button" style="all:unset;cursor:pointer;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px" data-action="expenses-report-year-prev">‹</button>
          <div class="sg" style="font-weight:700;font-size:12.5px;min-width:34px;text-align:center">${ctx.expensesReportYear}</div>
          <button type="button" style="all:unset;cursor:pointer;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px" data-action="expenses-report-year-next">›</button>
        </div>
      </div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:6px;height:150px;padding:0 2px">
        ${ctx.expensesReportMonths.map(m => `
          <button type="button" data-action="expenses-report-month-pick" data-month="${m.monthKey}" title="${esc(m.monthLabel)} ${ctx.expensesReportYear}: ${m.totalLabel}" style="all:unset;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;height:100%;justify-content:flex-end;position:relative;cursor:pointer">
            ${m.isSelected ? `<div style="position:absolute;top:-4px;transform:translateY(-100%);background:oklch(0.5 0.18 25);color:oklch(1 0 0);font-size:10px;font-weight:700;padding:3px 7px;border-radius:20px;white-space:nowrap">${m.totalLabel}</div>` : ''}
            <div style="width:60%;height:${m.heightPx}px;border-radius:6px 6px 0 0;background:${m.fill};flex:none"></div>
            <div style="font-size:11px;font-weight:600;color:${m.isSelected ? 'oklch(0.5 0.18 25)' : (m.isCurrentMonth ? 'oklch(0.4 0.13 150)' : 'oklch(0.5 0.015 150)')}">${m.shortLabel}</div>
          </button>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:16px;padding-top:14px;border-top:1px solid var(--border2)">
        <div style="font-size:13px;font-weight:700;color:oklch(0.35 0.02 150)">Total for ${ctx.expensesReportYear}</div>
        <div class="sg" style="font-size:15px;font-weight:700">${fmtMoney(ctx.expensesReportYearTotal)}</div>
      </div>
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
          <div style="height:8px;background:oklch(0.91 0.012 150);border-radius:5px;overflow:hidden;margin-bottom:8px">
            <div style="height:100%;width:${l.paidPercent}%;background:linear-gradient(90deg, oklch(0.5 0.13 165), oklch(0.42 0.12 155));border-radius:5px"></div>
          </div>
          ${l.monthsLeftLabel ? `<div style="font-size:11.5px;color:oklch(0.5 0.015 150);margin-bottom:18px">${l.monthsLeftLabel}</div>` : `<div style="margin-bottom:18px"></div>`}
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:13.5px;color:oklch(0.45 0.015 150)">Monthly due: <span style="color:oklch(0.2 0.02 150);font-weight:700">${l.monthlyDueLabel}</span></div>
            ${l.showDueBadge ? `<div style="font-size:12px;font-weight:700;color:${l.dueBadgeColor}">${l.dueBadgeLabel}</div>` : ''}
          </div>
          ${l.remainingBalance > 0 ? `<button type="button" data-action="loan-payment-open" data-id="${esc(l.id)}" style="all:unset;cursor:pointer;display:block;width:100%;box-sizing:border-box;text-align:center;margin-top:14px;padding:8px;border-radius:8px;background:oklch(0.92 0.06 150);color:oklch(0.45 0.14 150);font-size:12.5px;font-weight:700">Log Payment</button>` : ''}
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
      <div class="t-head" style="grid-template-columns:1.8fr 1.4fr 1fr"><div>Name</div><div>Contact</div><div>Status</div></div>
      ${ctx.clientRows.map(c => `
        <div class="t-row" style="grid-template-columns:1.8fr 1.4fr 1fr;cursor:pointer" data-action="client-edit" data-id="${esc(c.id)}">
          <div style="font-weight:600;font-size:14px">${esc(c.name)}</div>
          <div>
            <div style="font-size:12.5px;color:oklch(0.4 0.015 150)">${esc(c.phone)}</div>
            <div style="font-size:11.5px;color:oklch(0.5 0.015 150);margin-top:1px">${esc(c.email)}</div>
          </div>
          <div>${badge(leadStatusLabel(c.leadStatus), c.statusColor, c.statusBg)}</div>
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

    const docDateLabel = d.date ? fmtDate(d.date) : 'Select date';
    const docDateMonthLabel = new Date(state.docDateCalYear, state.docDateCalMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const docDateCells = buildCalendarCells(state.docDateCalYear, state.docDateCalMonth, [], d.date);
    const docDatePicker = `
      <div class="field" style="position:relative">
        <label>Date</label>
        <button type="button" data-action="doc-date-toggle" style="all:unset;cursor:pointer;width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--border3);border-radius:9px;padding:10px 12px;color:inherit;font-size:14px;font-family:inherit;display:flex;align-items:center;justify-content:space-between">
          <span>${docDateLabel}</span>
        </button>
        ${state.docDatePickerOpen ? `
        <div data-picker-popover style="position:absolute;left:0;top:calc(100% + 6px);background:var(--panel);border:1px solid var(--border3);border-radius:14px;padding:16px;box-shadow:0 12px 28px oklch(0 0 0 / 0.14);z-index:80;min-width:260px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div class="sg" style="font-weight:700;font-size:15px">${docDateMonthLabel}</div>
            <div style="display:flex;gap:6px">
              <button type="button" data-action="doc-date-cal-prev" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">‹</button>
              <button type="button" data-action="doc-date-cal-next" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">›</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
            ${WEEKDAY_LABELS.map(w => `<div style="text-align:center;font-size:10.5px;font-weight:700;color:oklch(0.55 0.015 150)">${w}</div>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
            ${docDateCells.map(c => c.blank ? `<div></div>` : `
              <div data-action="doc-date-pick" data-date="${c.dateStr}" style="aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12.5px;font-weight:600;background:${c.bg};border:1px solid ${c.border};color:${c.textColor}">${c.dayNum}</div>`).join('')}
          </div>
        </div>` : ''}
      </div>`;

    const docDueLabel = d.dueDate ? fmtDate(d.dueDate) : 'Select date';
    const docDueMonthLabel = new Date(state.docDueCalYear, state.docDueCalMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const docDueCells = buildCalendarCells(state.docDueCalYear, state.docDueCalMonth, [], d.dueDate);
    const docDuePicker = `
      <div class="field" style="position:relative">
        <label>${docType === 'quotation' ? 'Valid Until' : 'Due Date'}</label>
        <button type="button" data-action="doc-due-toggle" style="all:unset;cursor:pointer;width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--border3);border-radius:9px;padding:10px 12px;color:inherit;font-size:14px;font-family:inherit;display:flex;align-items:center;justify-content:space-between">
          <span>${docDueLabel}</span>
        </button>
        ${state.docDuePickerOpen ? `
        <div data-picker-popover style="position:absolute;right:0;top:calc(100% + 6px);background:var(--panel);border:1px solid var(--border3);border-radius:14px;padding:16px;box-shadow:0 12px 28px oklch(0 0 0 / 0.14);z-index:80;min-width:260px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div class="sg" style="font-weight:700;font-size:15px">${docDueMonthLabel}</div>
            <div style="display:flex;gap:6px">
              <button type="button" data-action="doc-due-cal-prev" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">‹</button>
              <button type="button" data-action="doc-due-cal-next" style="all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:12px">›</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
            ${WEEKDAY_LABELS.map(w => `<div style="text-align:center;font-size:10.5px;font-weight:700;color:oklch(0.55 0.015 150)">${w}</div>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
            ${docDueCells.map(c => c.blank ? `<div></div>` : `
              <div data-action="doc-due-pick" data-date="${c.dateStr}" style="aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12.5px;font-weight:600;background:${c.bg};border:1px solid ${c.border};color:${c.textColor}">${c.dayNum}</div>`).join('')}
          </div>
          <div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:10px">${docType === 'quotation' ? 'Auto-set to 30 days after the issue date — click a date here to override.' : 'Auto-set to 10 days after the invoice date — click a date here to override.'}</div>
        </div>` : ''}
      </div>`;

    // Quotation preview (redesigned): numbered Inclusions, Valid Until, Next Step, clean totals.
    const qItemsRaw = parseLineItems(d.lineItems);
    const qItems = qItemsRaw.length ? qItemsRaw
      : (d.amount ? [{ label: d.description || 'Professional service', amount: Number(d.amount) }]
                  : [{ label: 'No inclusions listed yet', amount: null }]);
    const qHasAmounts = qItems.some(it => it.amount != null);
    const qSubtotal = qItems.reduce((a, it) => a + (it.amount != null ? Number(it.amount) : 0), 0);
    const quotationPreview = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px">
        <div style="width:46px;height:46px;border-radius:10px;background:oklch(0.15 0 0);display:flex;align-items:center;justify-content:center;flex:none"><span class="sg" style="color:#fff;font-weight:700;font-size:15px;letter-spacing:-0.02em">pol<span style="color:oklch(0.6 0.2 25)">.</span></span></div>
        <div style="text-align:right">
          <div class="sg" style="font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.04em">Quotation</div>
          <div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:3px">Pol Film Productions</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid oklch(0 0 0 / 0.08)">
        <div><div style="font-size:9.5px;font-weight:700;color:oklch(0.5 0.015 150);text-transform:uppercase;margin-bottom:3px">Issue Date</div><div style="font-size:12.5px;font-weight:700">${fmtDateShortYear(d.date)}</div></div>
        <div><div style="font-size:9.5px;font-weight:700;color:oklch(0.5 0.015 150);text-transform:uppercase;margin-bottom:3px">Valid Until</div><div style="font-size:12.5px;font-weight:700;color:oklch(0.4 0.13 150)">${d.dueDate ? fmtDateShortYear(d.dueDate) : '—'}</div></div>
        <div><div style="font-size:9.5px;font-weight:700;color:oklch(0.5 0.015 150);text-transform:uppercase;margin-bottom:3px">Project</div><div style="font-size:12.5px;font-weight:700">${esc(d.description) || '—'}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid oklch(0 0 0 / 0.08)">
        <div><div style="font-size:9.5px;font-weight:700;color:oklch(0.4 0.13 150);text-transform:uppercase;margin-bottom:6px">Prepared By</div><div style="font-weight:700;font-size:13.5px;margin-bottom:2px">Pol Film Productions</div><div style="font-size:11.5px;color:oklch(0.5 0.015 150)">Video Production &amp; Editing Services</div></div>
        <div><div style="font-size:9.5px;font-weight:700;color:oklch(0.4 0.13 150);text-transform:uppercase;margin-bottom:6px">Prepared For</div><div style="font-weight:700;font-size:13.5px;margin-bottom:2px">${esc(d.clientName) || '[Client Name]'}</div><div style="font-size:11.5px;color:oklch(0.5 0.015 150)">${esc(d.clientContact) || 'No contact details provided'}</div></div>
      </div>
      <div style="font-size:12.5px;line-height:1.7;color:oklch(0.35 0.02 150);margin-bottom:20px">${esc(meta.body(d))}</div>
      <div style="font-size:9.5px;font-weight:700;color:oklch(0.4 0.13 150);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Inclusions</div>
      <div style="border:1px solid oklch(0 0 0 / 0.06);border-radius:12px;overflow:hidden;margin-bottom:18px">
        ${qItems.map((it, i) => `
        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;${i > 0 ? 'border-top:1px solid oklch(0 0 0 / 0.06);' : ''}font-size:12.5px">
          <div style="width:22px;height:22px;border-radius:7px;background:oklch(0.95 0.03 150);color:oklch(0.4 0.13 150);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none">${i + 1}</div>
          <div style="flex:1;min-width:0;font-weight:600">${esc(it.label)}</div>
          ${it.amount != null ? `<div style="font-weight:700;flex:none">${fmtMoney(it.amount)}</div>` : ''}
        </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
        <div style="min-width:250px">
          ${qHasAmounts ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:oklch(0.5 0.015 150);padding:3px 2px"><span>Subtotal</span><span>${fmtMoney(qSubtotal)}</span></div>` : ''}
          <div style="background:oklch(0.97 0.015 150);border-radius:12px;padding:14px 18px;margin-top:8px">
            <div style="font-size:9.5px;font-weight:700;color:oklch(0.4 0.13 150);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:7px">Total Proposed Rate</div>
            <div class="sg" style="font-size:23px;font-weight:700;line-height:1">${fmtMoney(d.amount)}</div>
          </div>
        </div>
      </div>
      <div style="background:oklch(0.95 0.03 150);border-left:4px solid oklch(0.4 0.13 150);border-radius:10px;padding:13px 16px;margin-bottom:20px">
        <div style="font-size:9.5px;font-weight:700;color:oklch(0.4 0.13 150);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Next Step</div>
        <div style="font-size:12px;color:oklch(0.3 0.03 150);line-height:1.6">To confirm your booking, reply to accept this quotation and settle the downpayment. We will then reserve your shoot schedule.</div>
      </div>
      <div style="border-top:1px solid oklch(0 0 0 / 0.08);padding-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div><div style="font-size:9.5px;font-weight:700;color:oklch(0.4 0.13 150);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px">Payment Terms</div><div style="font-size:11.5px;color:oklch(0.5 0.015 150);line-height:1.6">50% downpayment to confirm the booking. Balance due upon delivery of the final files.</div></div>
        ${d.notes ? `<div><div style="font-size:9.5px;font-weight:700;color:oklch(0.4 0.13 150);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px">Notes</div><div style="font-size:11.5px;color:oklch(0.5 0.015 150);line-height:1.6;white-space:pre-line">${esc(d.notes)}</div></div>` : ''}
      </div>
    `;

    const sortedDocs = [...state.documents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const docsHistorySection = state.docsHistoryOpen ? `
      <div class="card" style="margin-bottom:20px">
        <div class="card-title" style="margin-bottom:4px">History (${sortedDocs.length})</div>
        ${sortedDocs.length === 0 ? `<div style="color:oklch(0.5 0.015 150);font-size:13px">No documents generated yet.</div>` : `
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
          ${sortedDocs.map(r => {
            const rd = r.draft;
            const rMeta = DOC_TYPE_META[r.type];
            const rIsInvoice = r.type === 'invoice';
            return `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:var(--card);border-radius:11px;border:1px solid oklch(0 0 0 / 0.06);flex-wrap:wrap">
            <div style="min-width:0;flex:1">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span class="badge" style="background:oklch(0.92 0.06 150);color:oklch(0.4 0.13 150)">${esc(rMeta.title)}</span>
                <span style="font-weight:700;font-size:13.5px">${esc(rd.clientName || 'Untitled')}</span>
                ${rIsInvoice ? `<span style="font-size:12px;color:oklch(0.5 0.015 150)">#${esc(rd.invoiceNumber)}</span>` : ''}
              </div>
              <div style="font-size:12px;color:oklch(0.5 0.015 150);margin-top:3px">${esc(rd.description || '')} · ${fmtDate(rd.date)} · ${fmtMoney(rd.amount)}${rIsInvoice ? ' · ' + esc(rd.paymentStatus) : ''}</div>
            </div>
            <div style="display:flex;gap:8px;flex:none">
              <button type="button" data-action="doc-history-edit" data-id="${esc(r.id)}" style="all:unset;cursor:pointer;padding:8px 12px;border-radius:8px;background:oklch(0.93 0.03 250);color:oklch(0.45 0.13 260);font-size:12.5px;font-weight:700">Edit</button>
              <button type="button" data-action="doc-history-download" data-id="${esc(r.id)}" style="all:unset;cursor:pointer;padding:8px 12px;border-radius:8px;background:oklch(0.92 0.06 150);color:oklch(0.4 0.13 150);font-size:12.5px;font-weight:700">Download</button>
              <button type="button" data-action="doc-history-delete" data-id="${esc(r.id)}" style="all:unset;cursor:pointer;padding:8px 12px;border-radius:8px;background:oklch(0.92 0.08 25);color:oklch(0.5 0.19 25);font-size:12.5px;font-weight:700">Delete</button>
            </div>
          </div>`;
          }).join('')}
        </div>`}
      </div>` : '';

    return `
    <div class="page-head">
      <div><div class="page-title sg">Documents</div><div class="page-sub">Generate contracts, quotations, and invoices</div></div>
      <button type="button" class="btn-ghost" style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px" data-action="doc-history-toggle">${state.docsHistoryOpen ? 'Hide History' : `View History (${state.documents.length})`}</button>
    </div>
    <div class="tabbar" style="margin-bottom:24px">${tab('contract', 'Contract')}${tab('quotation', 'Quotation')}${tab('invoice', 'Invoice')}</div>
    ${docsHistorySection}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
      <div class="card" style="display:flex;flex-direction:column;gap:14px">
        <div class="field"><label>Fill from Existing Project (optional)</label>
          <select data-action-change="doc-shoot-pick">
            <option value="">— Choose from Shoots —</option>
            ${[...state.shoots].sort((a, b) => new Date(b.date) - new Date(a.date)).map(sh => `<option value="${esc(sh.id)}">${esc(sh.client)} — ${esc(sh.shootType)} (${fmtDate(sh.date)})</option>`).join('')}
          </select>
          <div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:4px">Pulls in client, project, and package details from that shoot — Amount is pre-filled with the next unpaid milestone (20% DP / 30% Shoot / 50% Final), still editable.</div>
        </div>
        <div class="field"><label>Select Existing Client (optional)</label>
          <select data-action-change="doc-client-pick">
            <option value="">— Choose from Clients —</option>
            ${state.clients.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Client Name</label><input type="text" value="${esc(d.clientName)}" data-bind="docDraft.clientName" placeholder="e.g. Nadine Reyes"/></div>
        <div class="field"><label>Client Address / Contact</label><input type="text" value="${esc(d.clientContact)}" data-bind="docDraft.clientContact" placeholder="Address, phone, or email"/></div>
        <div class="field"><label>Project / Service</label><input type="text" value="${esc(d.description)}" data-bind="docDraft.description" placeholder="e.g. Vlog Collab - Tagaytay"/></div>
        <div class="row-2">
          <div class="field"><label>Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(d.amount))}" data-bind="docDraft.amount" data-fmt="money"/></div>
          ${docDatePicker}
        </div>
        <div class="field"><label>Terms / Notes</label><input type="text" value="${esc(d.notes)}" data-bind="docDraft.notes" placeholder="e.g. 50% downpayment, balance on delivery"/></div>
        ${isInvoice ? `
        <div style="border-top:1px solid oklch(0 0 0 / 0.07);margin-top:4px;padding-top:14px;display:flex;flex-direction:column;gap:14px">
          <div class="row-2">
            <div class="field"><label>Reference Number</label><input type="text" value="${esc(d.invoiceNumber)}" data-bind="docDraft.invoiceNumber" placeholder="e.g. SOA-2026-014"/><div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:4px">Auto-suggested — increments each time you generate an invoice.</div></div>
            ${docDuePicker}
          </div>
          <div class="field"><label>Line Items Breakdown</label><textarea rows="3" data-bind="docDraft.lineItems" placeholder="One item per line, e.g.&#10;Package fee - ₱10,000&#10;Transport - ₱1,000">${esc(d.lineItems)}</textarea><div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:4px">Press Enter for a new item — each line becomes its own row in the invoice table.</div></div>
          <div class="field"><label>Payment Details</label><input type="text" value="${esc(d.paymentDetails)}" data-bind="docDraft.paymentDetails" placeholder="e.g. GCash 09XX XXX XXXX - Your Name"/></div>
          <div class="field"><label>Payment Status</label>
            <select data-bind="docDraft.paymentStatus">
              <option value="Unpaid" ${d.paymentStatus === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
              <option value="Partial" ${d.paymentStatus === 'Partial' ? 'selected' : ''}>Partial</option>
              <option value="Paid" ${d.paymentStatus === 'Paid' ? 'selected' : ''}>Paid</option>
            </select>
          </div>
        </div>` : ''}
        ${docType === 'quotation' ? `
        <div style="border-top:1px solid oklch(0 0 0 / 0.07);margin-top:4px;padding-top:14px;display:flex;flex-direction:column;gap:14px">
          ${docDuePicker}
          <div class="field"><label>Inclusions</label><textarea rows="4" data-bind="docDraft.lineItems" placeholder="One per line, e.g.&#10;Full-day video shoot - ₱10,000&#10;Drone coverage - ₱3,000&#10;Editing and color grading - ₱2,000">${esc(d.lineItems)}</textarea><div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:4px">One item per line. Add "- ₱amount" at the end to show a price. Each line becomes a numbered inclusion.</div></div>
        </div>` : ''}
        ${state.editingDocId ? `
        <div style="font-size:12px;color:oklch(0.45 0.13 260);background:oklch(0.96 0.03 260);border:1px solid oklch(0.86 0.05 260);padding:8px 11px;border-radius:9px;margin-top:4px">✎ Editing this ${meta.title.toLowerCase()}${isInvoice ? ` (#${esc(d.invoiceNumber)})` : ''} — “Update” saves it back to the same record (no new copy).</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button type="button" class="btn-primary" style="flex:1;text-align:center" data-action="doc-generate">Update ${meta.title}</button>
          <button type="button" class="btn-ghost" style="text-align:center;background:var(--card2);padding:0 16px" data-action="doc-cancel-edit">Cancel</button>
        </div>
        ` : `
        <button type="button" class="btn-primary" style="text-align:center;margin-top:4px" data-action="doc-generate">Generate ${meta.title}</button>
        `}
      </div>
      <div id="doc-preview-panel" style="background:#fff;color:oklch(0.22 0.02 150);border-radius:16px;padding:32px;min-height:360px;border:1px solid oklch(0 0 0 / 0.06)">
        ${docType === 'quotation' ? quotationPreview : `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px">
          <div style="width:46px;height:46px;border-radius:10px;background:oklch(0.15 0 0);display:flex;align-items:center;justify-content:center;flex:none">
            <span class="sg" style="color:#fff;font-weight:700;font-size:15px;letter-spacing:-0.02em">pol<span style="color:oklch(0.6 0.2 25)">.</span></span>
          </div>
          <div style="text-align:right">
            <div class="sg" style="font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.02em">${esc(meta.title)}</div>
            <div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:3px">Pol Film Productions</div>
            ${isInvoice ? `<div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:2px">Reference No. ${esc(d.invoiceNumber)}</div>` : ''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid oklch(0 0 0 / 0.08)">
          ${isInvoice ? `
            <div><div style="font-size:9.5px;font-weight:700;color:oklch(0.5 0.015 150);text-transform:uppercase;margin-bottom:3px">Issue Date</div><div style="font-size:12.5px;font-weight:700">${fmtDateShortYear(d.date)}</div></div>
            <div><div style="font-size:9.5px;font-weight:700;color:oklch(0.5 0.015 150);text-transform:uppercase;margin-bottom:3px">Due Date</div><div style="font-size:12.5px;font-weight:700">${fmtDateShortYear(d.dueDate)}</div></div>
            <div><div style="font-size:9.5px;font-weight:700;color:oklch(0.5 0.015 150);text-transform:uppercase;margin-bottom:3px">Payment Status</div><div style="font-size:12.5px;font-weight:700;color:${paymentStatusColor}">${esc((d.paymentStatus || 'Unpaid').toUpperCase())}</div></div>
          ` : `
            <div><div style="font-size:9.5px;font-weight:700;color:oklch(0.5 0.015 150);text-transform:uppercase;margin-bottom:3px">Issue Date</div><div style="font-size:12.5px;font-weight:700">${fmtDateShortYear(d.date)}</div></div>
            <div><div style="font-size:9.5px;font-weight:700;color:oklch(0.5 0.015 150);text-transform:uppercase;margin-bottom:3px">Project / Service</div><div style="font-size:12.5px;font-weight:700">${esc(d.description) || '—'}</div></div>
            <div><div style="font-size:9.5px;font-weight:700;color:oklch(0.5 0.015 150);text-transform:uppercase;margin-bottom:3px">Document Type</div><div style="font-size:12.5px;font-weight:700">${docType === 'quotation' ? 'Quotation' : 'Contract'}</div></div>
          `}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid oklch(0 0 0 / 0.08)">
          <div>
            <div style="font-size:9.5px;font-weight:700;color:oklch(0.4 0.13 150);text-transform:uppercase;margin-bottom:6px">Billed By</div>
            <div style="font-weight:700;font-size:13.5px;margin-bottom:2px">Pol Film Productions</div>
            <div style="font-size:11.5px;color:oklch(0.5 0.015 150)">Video Production &amp; Editing Services</div>
          </div>
          <div>
            <div style="font-size:9.5px;font-weight:700;color:oklch(0.4 0.13 150);text-transform:uppercase;margin-bottom:6px">Billed To</div>
            <div style="font-weight:700;font-size:13.5px;margin-bottom:2px">${esc(d.clientName) || '[Client Name]'}</div>
            <div style="font-size:11.5px;color:oklch(0.5 0.015 150)">${esc(d.clientContact) || 'No contact details provided'}</div>
          </div>
        </div>
        ${isInvoice ? `
        <div style="margin-bottom:18px;border-radius:8px;overflow:hidden;border:1px solid oklch(0 0 0 / 0.06)">
          <div style="display:flex;justify-content:space-between;padding:9px 12px;background:oklch(0.97 0.015 150);font-size:9.5px;font-weight:700;color:oklch(0.4 0.13 150);text-transform:uppercase">
            <span>Item</span><span>Amount</span>
          </div>
          ${(parseLineItems(d.lineItems).length ? parseLineItems(d.lineItems) : [{ label: 'No items listed', amount: null }]).map(it => `
          <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border-top:1px solid oklch(0 0 0 / 0.06);font-size:12.5px">
            <span>${esc(it.label)}</span><span style="font-weight:600;flex:none">${it.amount != null ? fmtMoney(it.amount) : '—'}</span>
          </div>`).join('')}
        </div>` : `
        <div style="font-size:13px;line-height:1.7;margin-bottom:18px">${esc(meta.body(d))}</div>`}
        ${isInvoice && d.packageTotal ? `
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;width:230px;font-size:12px;color:oklch(0.5 0.015 150)"><span>Total Package</span><span>${fmtMoney(d.packageTotal)}</span></div>
          ${Number(d.paidToDate) > 0 ? `<div style="display:flex;justify-content:space-between;width:230px;font-size:12px;color:oklch(0.5 0.015 150)"><span>Less: Paid to Date</span><span>− ${fmtMoney(d.paidToDate)}</span></div>` : ''}
          <div style="width:230px;border-top:1px solid oklch(0 0 0 / 0.1);margin-top:2px"></div>
        </div>` : ''}
        <div style="display:flex;${isInvoice ? 'justify-content:space-between;align-items:flex-start' : 'justify-content:flex-end'};gap:20px;margin-bottom:18px">
          ${isInvoice && d.paymentDetails ? `
          <div style="flex:1;min-width:0">
            <div style="font-size:9.5px;font-weight:700;color:oklch(0.4 0.13 150);text-transform:uppercase;margin-bottom:6px">Payment Details</div>
            <div style="font-size:12px;color:oklch(0.35 0.02 150);white-space:pre-line">${esc(d.paymentDetails)}</div>
          </div>` : (isInvoice ? '<div style="flex:1"></div>' : '')}
          <div style="background:oklch(0.97 0.015 150);border-radius:10px;padding:14px 16px;min-width:190px">
            <div style="font-size:9.5px;font-weight:700;color:oklch(0.5 0.015 150);text-transform:uppercase;margin-bottom:6px">${isInvoice ? 'Total Amount Due' : (docType === 'quotation' ? 'Proposed Rate' : 'Total Contract Value')}</div>
            ${isInvoice && d.milestoneLabel ? `<div style="font-size:10.5px;color:oklch(0.5 0.015 150);margin-bottom:4px">${esc(d.milestoneLabel)}</div>` : ''}
            <div class="sg" style="font-size:20px;font-weight:700">${fmtMoney(d.amount)}</div>
          </div>
        </div>
        ${d.notes ? `<div style="padding-top:14px;border-top:1px solid oklch(0 0 0 / 0.08);font-size:12px;color:oklch(0.5 0.015 150);white-space:pre-line"><div style="font-weight:700;color:oklch(0.4 0.13 150);text-transform:uppercase;font-size:9.5px;margin-bottom:6px">Notes</div>${esc(d.notes)}</div>` : ''}
        `}
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-title" style="margin-bottom:4px">Package Rates</div>
      <div style="color:oklch(0.5 0.015 150);font-size:12.5px;margin-bottom:16px">Update your pricing here — changes apply to new shoots only. Shoots already booked keep their locked-in price.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px">
        ${packageRateRows.map(pr => `
          <div class="field"><label>${pr.label}</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(state.packageRates[pr.key]))}" data-bind="packageRates.${pr.key}" data-fmt="money" data-special="packageRate" data-key="${pr.key}"/></div>`).join('')}
      </div>
    </div>`;
  }

  /* ---------------- insights ---------------- */

  function viewInsights(ctx) {
    return `
    <div class="page-head">
      <div><div class="page-title sg">Insights</div><div class="page-sub">AI-generated analysis of your business</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn-primary" data-action="monthly-report" title="Generate a clean PDF summary of this month (shoots, revenue, expenses, net)">📄 Monthly Report</button>
        <button type="button" class="btn-telegram" data-action="export-data-csv" title="Download separate CSV files for Shoots, Expenses, Income, Clients, Loans, and Goals">⬇ Export Data</button>
        <button type="button" class="btn-telegram" data-action="backup-download" title="Download a full backup (single JSON file) of ALL your data">⬇ Backup</button>
        <button type="button" class="btn-telegram" data-action="backup-restore" title="Restore all data from a backup file — replaces your current data">⬆ Restore</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
        <div class="card-title" style="margin-bottom:0">Overview — Earnings by Month</div>
        <div style="display:flex;align-items:center;gap:8px;background:var(--card2);border-radius:10px;padding:6px 10px">
          <button type="button" data-action="insights-chart-year-prev" style="all:unset;cursor:pointer;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px">‹</button>
          <div class="sg" style="font-weight:700;font-size:12.5px;min-width:34px;text-align:center">${ctx.overviewYear}</div>
          <button type="button" data-action="insights-chart-year-next" style="all:unset;cursor:pointer;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px">›</button>
        </div>
      </div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:6px;height:150px;padding:0 2px">
        ${ctx.overviewBars.map(b => `
          <button type="button" data-action="insights-chart-month-select" data-month="${b.monthKey}" title="${esc(b.label)} ${ctx.overviewYear}: ${b.totalLabel}" style="all:unset;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;height:100%;justify-content:flex-end;position:relative;cursor:pointer">
            ${b.isSelected ? `<div style="position:absolute;top:-4px;transform:translateY(-100%);background:oklch(0.4 0.13 150);color:oklch(1 0 0);font-size:10px;font-weight:700;padding:3px 7px;border-radius:20px;white-space:nowrap">${b.totalLabel}</div>` : ''}
            <div style="width:60%;height:${b.heightPx}px;border-radius:6px 6px 0 0;background:${b.fill};flex:none"></div>
            <div style="font-size:11px;font-weight:600;color:${b.isSelected ? 'oklch(0.4 0.13 150)' : 'oklch(0.5 0.015 150)'}">${b.label}</div>
          </button>`).join('')}
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:14px">Revenue vs Expenses — ${esc(ctx.selMonthLabel)}</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span style="color:oklch(0.42 0.015 150)">Revenue</span><span style="font-weight:700">${fmtMoney(ctx.selMonthRevenue)}</span></div>
          <div style="height:10px;background:oklch(0.91 0.012 150);border-radius:5px;overflow:hidden"><div style="height:100%;width:${Math.round((ctx.selMonthRevenue / ctx.selMonthChartMax) * 100)}%;background:oklch(0.55 0.12 175);border-radius:5px"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span style="color:oklch(0.42 0.015 150)">Expenses</span><span style="font-weight:700">${fmtMoney(ctx.selMonthExpenses)}</span></div>
          <div style="height:10px;background:oklch(0.91 0.012 150);border-radius:5px;overflow:hidden"><div style="height:100%;width:${Math.round((ctx.selMonthExpenses / ctx.selMonthChartMax) * 100)}%;background:oklch(0.62 0.17 45);border-radius:5px"></div></div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:14px;border-top:1px solid oklch(0 0 0 / 0.06)">
        <span style="font-size:12.5px;font-weight:600;color:oklch(0.42 0.015 150)">Net Profit</span>
        <span style="font-size:16px;font-weight:700;color:${ctx.selMonthNetProfit > 0 ? 'oklch(0.45 0.14 150)' : 'oklch(0.58 0.19 25)'}">${fmtMoney(ctx.selMonthNetProfit)}</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-bottom:16px">
      <div class="card">
        <div class="card-title" style="margin-bottom:14px">Top Clients</div>
        ${ctx.topClients.length === 0 ? `<div style="font-size:13px;color:oklch(0.55 0.015 150)">No payments collected yet.</div>` : `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${ctx.topClients.map((c, i) => `
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:22px;height:22px;border-radius:50%;background:oklch(0.92 0.06 150);color:oklch(0.4 0.13 150);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none">${i + 1}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</div>
                <div style="font-size:11.5px;color:oklch(0.5 0.015 150)">${c.shootsLabel}</div>
              </div>
              <div style="font-size:13.5px;font-weight:700;flex:none">${c.totalLabel}</div>
            </div>`).join('')}
        </div>`}
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:14px">Biggest Expenses</div>
        ${ctx.biggestExpenses.length === 0 ? `<div style="font-size:13px;color:oklch(0.55 0.015 150)">No expenses logged yet.</div>` : `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${ctx.biggestExpenses.map(e => `
            <div style="display:flex;align-items:center;gap:12px">
              <div style="flex:1;min-width:0">
                <div style="font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.description)}</div>
                <div style="font-size:11.5px;color:oklch(0.5 0.015 150)">${e.dateLabel}</div>
              </div>
              <div style="font-size:13.5px;font-weight:700;flex:none;color:oklch(0.58 0.19 25)">${e.amountLabel}</div>
            </div>`).join('')}
        </div>`}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      ${ctx.insightCards.map(ic => {
        const inner = ic.bars ? `
          <div style="display:flex;flex-direction:column;gap:14px">
            ${ic.bars.map(b => `
              <div>
                <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span style="color:oklch(0.42 0.015 150)">${esc(b.label)}</span><span style="font-weight:700">${b.percent}%</span></div>
                <div style="height:10px;background:oklch(0.91 0.012 150);border-radius:5px;overflow:hidden"><div style="height:100%;width:${Math.min(100, b.percent)}%;background:oklch(0.55 0.14 150);border-radius:5px"></div></div>
                <div style="font-size:11.5px;color:oklch(0.5 0.015 150);margin-top:4px">${esc(b.sub)}</div>
              </div>`).join('')}
          </div>` : `<div style="font-size:13.5px;line-height:1.6;color:oklch(0.32 0.015 150)">${esc(ic.text)}</div>`;
        const header = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="color:oklch(0.55 0.14 150)">${ic.icon}</span><div class="sg" style="font-weight:700;font-size:15px">${esc(ic.title)}</div></div>`;
        return ic.clickKey
          ? `<button type="button" data-action="chip-open" data-key="${ic.clickKey}" style="all:unset;cursor:pointer;box-sizing:border-box;display:block;width:100%;text-align:left;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:22px">${header}${inner}</button>`
          : `<div class="card">${header}${inner}</div>`;
      }).join('')}
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
          <button type="button" data-action="goal-fund-open" data-id="${esc(g.id)}" style="all:unset;cursor:pointer;display:block;width:100%;box-sizing:border-box;text-align:center;margin-top:12px;padding:8px;border-radius:8px;background:oklch(0.92 0.06 150);color:oklch(0.45 0.14 150);font-size:12.5px;font-weight:700">+ Add / Withdraw Fund</button>
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
    const draftPackageAmount = (!isRealEstate || (d.packageTier || 'custom') === 'custom')
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
          <div class="field"><label>Client / Project</label><input type="text" value="${esc(d.client)}" data-bind="draft.client" data-fmt="autocomplete" placeholder="e.g. Globe Telecom Anthem" required autocomplete="off"/>
          </div>
          <div class="field"><label>Location / Venue</label><input type="text" value="${esc(d.location)}" data-bind="draft.location" placeholder="e.g. BGC Studio"/></div>
          <div class="row-2">
            <div class="field" style="position:relative">
              <label>Date</label>
              ${state.draftDateLocked ? `
              <div style="width:100%;box-sizing:border-box;background:var(--card2);border:1px solid var(--border2);border-radius:9px;padding:10px 12px;color:oklch(0.4 0.02 150);font-size:14px;display:flex;align-items:center;justify-content:space-between">
                <span>${shootDateDisplayLabel}</span>
                <span data-action="shoot-date-unlock" style="cursor:pointer;font-size:11px;font-weight:600;color:oklch(0.45 0.14 150);text-decoration:underline">Change</span>
              </div>` : `
              <button type="button" data-action="date-picker-toggle" style="all:unset;cursor:pointer;width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--border3);border-radius:9px;padding:10px 12px;color:inherit;font-size:14px;font-family:inherit;display:flex;align-items:center;justify-content:space-between">
                <span>${shootDateDisplayLabel}</span>
              </button>`}
              ${!state.draftDateLocked && state.shootDatePickerOpen ? `
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
            <div class="field"><label>Project Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(d.package))}" data-bind="draft.package" data-fmt="money" placeholder="0"/></div>`}
            <div class="field"><label>Amount Received (₱)</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(d.paid))}" data-bind="draft.paid" data-fmt="money" placeholder="0"/></div>
          </div>
          ${isCustomPackage ? `<div class="field"><label>Custom Package Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(d.package))}" data-bind="draft.package" data-fmt="money" placeholder="0"/></div>` : ''}
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
                const counterControls = ad.flat ? `
                  <button type="button" data-action="shoot-addon-toggle" data-key="${ad.key}" style="all:unset;cursor:pointer;padding:6px 14px;border-radius:7px;font-weight:700;font-size:12.5px;background:${qty > 0 ? 'oklch(0.92 0.06 150)' : 'oklch(0.91 0.012 150)'};color:${qty > 0 ? 'oklch(0.4 0.13 150)' : 'oklch(0.4 0.02 150)'}">${qty > 0 ? 'Added ✓' : 'Add'}</button>
                ` : `
                  <button type="button" data-action="shoot-addon-dec" data-key="${ad.key}" style="all:unset;cursor:pointer;width:26px;height:26px;border-radius:7px;background:oklch(0.91 0.012 150);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:oklch(0.35 0.02 150)">−</button>
                  <div style="width:22px;text-align:center;font-weight:700;font-size:13.5px">${qty}</div>
                  <button type="button" data-action="shoot-addon-inc" data-key="${ad.key}" style="all:unset;cursor:pointer;width:26px;height:26px;border-radius:7px;background:oklch(0.92 0.06 150);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:oklch(0.4 0.13 150)">+</button>
                `;
                return `
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:600;color:oklch(0.25 0.02 150)">${esc(ad.label)}</div>
                    <div style="font-size:11.5px;color:oklch(0.5 0.015 150)">₱${ad.price.toLocaleString('en-US')} ${esc(ad.unitLabel)}</div>
                  </div>
                  ${counterControls}
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
          <div class="field"><label>What did you spend on?</label><input type="text" value="${esc(d.description)}" data-bind="expenseDraft.description" placeholder="e.g. Grab to BGC shoot" required/></div>
          <div class="row-2">
            <div class="field"><label>Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(d.amount))}" data-bind="expenseDraft.amount" data-fmt="money" placeholder="0" required/></div>
            <div class="field"><label>Date</label><input type="date" value="${esc(d.date)}" max="${TODAY_STR}" data-bind="expenseDraft.date"/></div>
          </div>
          <button type="submit" class="btn-primary" style="text-align:center;margin-top:4px">Add Expense</button>
        </form>
      </div>
    </div>`;
  }

  function modalLoanPayment() {
    if (!state.loanPaymentModal) return '';
    const l = state.loans.find(x => x.id === state.loanPaymentModal.id);
    if (!l) return '';
    const d = state.loanPaymentDraft;
    const remaining = Number(l.remainingBalance) || 0;
    const amt = Number(d.amount) || 0;
    const previewRemaining = Math.max(0, remaining - amt);
    const history = (l.paymentHistory || []).slice().sort((a, b) => b.id.localeCompare(a.id));
    return `
    <div class="modal-backdrop chip" data-action="modal-backdrop-close" data-which="loanpayment">
      <form class="modal-box" style="width:360px" data-stop data-action="save-loan-payment">
        <div class="modal-head"><div class="modal-title">${esc(l.lender)}</div><button type="button" class="modal-close" data-action="modal-close" data-which="loanpayment">✕</button></div>
        <div class="modal-fields">
          <div style="font-size:12.5px;color:oklch(0.45 0.015 150)">Remaining balance: <strong>${fmtMoney(remaining)}</strong></div>
          <div class="field"><label>Payment Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(d.amount))}" data-bind="loanPaymentDraft.amount" data-fmt="money" placeholder="0" autofocus required/></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" data-action="loan-payment-quick" data-amount="${l.monthlyDue}" style="all:unset;cursor:pointer;padding:5px 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:var(--card2);color:oklch(0.35 0.02 150)">Monthly Due (${fmtMoney(l.monthlyDue)})</button>
            <button type="button" data-action="loan-payment-quick" data-amount="${remaining}" style="all:unset;cursor:pointer;padding:5px 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:var(--card2);color:oklch(0.35 0.02 150)">Pay Off Full (${fmtMoney(remaining)})</button>
          </div>
          <div style="font-size:12.5px;color:oklch(0.45 0.015 150)">New balance: <strong>${fmtMoney(previewRemaining)}</strong>${previewRemaining === 0 && amt > 0 ? ' — will be marked Paid Off ✓' : ''}</div>
          ${history.length > 0 ? `
          <div style="border-top:1px solid var(--border2);padding-top:12px">
            <div style="font-size:11.5px;font-weight:700;color:oklch(0.5 0.015 150);text-transform:uppercase;margin-bottom:8px">Payment History</div>
            <div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto">
              ${history.map(h => `
                <div style="display:flex;align-items:center;justify-content:space-between;background:var(--card2);border-radius:8px;padding:7px 10px">
                  <div style="font-size:12px;color:oklch(0.45 0.015 150)">${fmtDate(h.date)}</div>
                  <div style="font-size:12.5px;font-weight:600">${fmtMoney(h.amount)}</div>
                  <button type="button" data-action="loan-payment-history-delete" data-hist-id="${esc(h.id)}" style="all:unset;cursor:pointer;color:oklch(0.5 0.015 150);font-size:12px;padding:2px 4px" title="Remove this payment">✕</button>
                </div>`).join('')}
            </div>
          </div>` : ''}
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn-primary" style="flex:1;text-align:center">Log Payment</button>
        </div>
      </form>
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
          <div class="field"><label>Lender / Source</label><input type="text" value="${esc(d.lender)}" data-bind="loanDraft.lender" placeholder="e.g. BPI Personal Loan" required/></div>
          <div class="row-2">
            <div class="field"><label>Loan Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(d.amount))}" data-bind="loanDraft.amount" data-fmt="money" required/></div>
            <div class="field"><label>Remaining Balance (₱)</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(d.remainingBalance))}" data-bind="loanDraft.remainingBalance" data-fmt="money"/></div>
          </div>
          <div class="row-2">
            <div class="field"><label>Monthly Due (₱)</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(d.monthlyDue))}" data-bind="loanDraft.monthlyDue" data-fmt="money"/></div>
            <div class="field"><label>Due Day of Month</label><input type="number" min="1" max="31" value="${esc(d.dueDay)}" data-bind="loanDraft.dueDay" placeholder="e.g. 23"/></div>
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
          <div class="field"><label>Goal Name</label><input type="text" value="${esc(d.name)}" data-bind="goalDraft.name" placeholder="e.g. Car Fund" required/></div>
          <div style="display:flex;gap:8px">
            <button type="button" data-action="goal-currency-pick" data-currency="PHP" style="all:unset;cursor:pointer;padding:6px 14px;border-radius:8px;font-size:12.5px;font-weight:700;background:${!isUSD ? 'oklch(0.45 0.14 150)' : 'oklch(0.91 0.012 150)'};color:${!isUSD ? 'oklch(1 0 0)' : 'oklch(0.4 0.02 150)'}">₱ PHP</button>
            <button type="button" data-action="goal-currency-pick" data-currency="USD" style="all:unset;cursor:pointer;padding:6px 14px;border-radius:8px;font-size:12.5px;font-weight:700;background:${isUSD ? 'oklch(0.45 0.14 150)' : 'oklch(0.91 0.012 150)'};color:${isUSD ? 'oklch(1 0 0)' : 'oklch(0.4 0.02 150)'}">$ USD</button>
          </div>
          <div class="row-2">
            <div class="field"><label>Target Amount (${currencySymbol})</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(d.target))}" data-bind="goalDraft.target" data-fmt="money"/>
              ${isUSD ? `<div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:4px">≈ ${targetPhpPreview}</div>` : ''}
            </div>
            <div class="field"><label>Current Amount (${currencySymbol})</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(d.current))}" data-bind="goalDraft.current" data-fmt="money"/>
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

  function modalGoalFund() {
    if (!state.goalFundModal) return '';
    const g = state.goals.find(x => x.id === state.goalFundModal.id);
    if (!g) return '';
    const d = state.goalFundDraft;
    const isUSD = g.currency === 'USD';
    const currencySymbol = isUSD ? '$' : '₱';
    const mode = d.mode || 'deposit';
    const amt = Number(d.amount) || 0;
    const displayCurrent = isUSD ? (Number(g.current) || 0) / USD_TO_PHP : (Number(g.current) || 0);
    const previewCurrent = mode === 'deposit' ? displayCurrent + amt : Math.max(0, displayCurrent - amt);
    const history = (g.fundHistory || []).slice().sort((a, b) => b.id.localeCompare(a.id));
    return `
    <div class="modal-backdrop chip" data-action="modal-backdrop-close" data-which="goalfund">
      <form class="modal-box" style="width:360px" data-stop data-action="save-goal-fund">
        <div class="modal-head"><div class="modal-title">${esc(g.name)}</div><button type="button" class="modal-close" data-action="modal-close" data-which="goalfund">✕</button></div>
        <div class="modal-fields">
          <div style="font-size:12.5px;color:oklch(0.45 0.015 150)">Currently saved: <strong>${currencySymbol}${displayCurrent.toLocaleString('en-US')}</strong></div>
          <div style="display:flex;gap:8px">
            <button type="button" data-action="goal-fund-mode" data-mode="deposit" style="all:unset;cursor:pointer;flex:1;text-align:center;padding:8px;border-radius:8px;font-size:12.5px;font-weight:700;background:${mode === 'deposit' ? 'oklch(0.45 0.14 150)' : 'oklch(0.91 0.012 150)'};color:${mode === 'deposit' ? 'oklch(1 0 0)' : 'oklch(0.4 0.02 150)'}">Deposit</button>
            <button type="button" data-action="goal-fund-mode" data-mode="withdraw" style="all:unset;cursor:pointer;flex:1;text-align:center;padding:8px;border-radius:8px;font-size:12.5px;font-weight:700;background:${mode === 'withdraw' ? 'oklch(0.58 0.19 25)' : 'oklch(0.91 0.012 150)'};color:${mode === 'withdraw' ? 'oklch(1 0 0)' : 'oklch(0.4 0.02 150)'}">Withdraw</button>
          </div>
          <div class="field"><label>Amount (${currencySymbol})</label><input type="text" inputmode="decimal" value="${esc(formatMoneyLiveDisplay(d.amount))}" data-bind="goalFundDraft.amount" data-fmt="money" placeholder="0" autofocus required/></div>
          ${mode === 'withdraw' ? `<div class="field"><label>Reason for Withdrawal</label><input type="text" value="${esc(d.reason)}" data-bind="goalFundDraft.reason" placeholder="e.g. Emergency repair, bills, etc." required/></div>` : ''}
          <div style="font-size:12.5px;color:oklch(0.45 0.015 150)">New total: <strong>${currencySymbol}${previewCurrent.toLocaleString('en-US')}</strong></div>
          ${history.length > 0 ? `
          <div style="border-top:1px solid var(--border2);padding-top:12px">
            <div style="font-size:11.5px;font-weight:700;color:oklch(0.5 0.015 150);text-transform:uppercase;margin-bottom:8px">Contribution History</div>
            <div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto">
              ${history.map(h => `
                <div style="background:var(--card2);border-radius:8px;padding:7px 10px">
                  <div style="display:flex;align-items:center;justify-content:space-between">
                    <div style="font-size:12px;color:oklch(0.45 0.015 150)">${fmtDate(h.date)}</div>
                    <div style="display:flex;align-items:center;gap:8px">
                      <div style="font-size:12.5px;font-weight:600;color:${h.mode === 'withdraw' ? 'oklch(0.58 0.19 25)' : 'inherit'}">${h.mode === 'withdraw' ? '−' : '+'}${currencySymbol}${(Number(h.amount) || 0).toLocaleString('en-US')}</div>
                      <button type="button" data-action="goal-fund-history-delete" data-hist-id="${esc(h.id)}" style="all:unset;cursor:pointer;color:oklch(0.5 0.015 150);font-size:12px;padding:2px 4px" title="Remove this entry">✕</button>
                    </div>
                  </div>
                  ${h.mode === 'withdraw' && h.reason ? `<div style="font-size:11px;color:oklch(0.5 0.015 150);margin-top:2px">${esc(h.reason)}</div>` : ''}
                </div>`).join('')}
            </div>
          </div>` : ''}
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn-primary" style="flex:1;text-align:center">${mode === 'deposit' ? 'Add Fund' : 'Withdraw Fund'}</button>
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
          <div class="field"><label>Name</label><input type="text" value="${esc(d.name)}" data-bind="clientDraft.name" placeholder="e.g. Nadine Reyes" required/></div>
          <div class="row-2">
            <div class="field"><label>Phone</label><input type="text" value="${esc(d.phone)}" data-bind="clientDraft.phone" placeholder="09XX XXX XXXX"/></div>
            <div class="field"><label>Email</label><input type="text" value="${esc(d.email)}" data-bind="clientDraft.email" placeholder="email@example.com"/></div>
          </div>
          <div class="row-2">
            <div class="field"><label>Lead Status</label>
              <select data-bind="clientDraft.leadStatus">${LEAD_STATUSES.map(v => `<option value="${v}" ${d.leadStatus === v ? 'selected' : ''}>${leadStatusLabel(v)}</option>`).join('')}</select>
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
      ${offlineMode ? `<div style="position:sticky;top:0;z-index:100;background:oklch(0.62 0.17 45);color:#fff;padding:9px 14px;text-align:center;font-size:12.5px;font-weight:600">⚠ Offline — showing your last saved data. Editing is disabled until you reconnect.</div>` : ''}
      <div class="app-shell">
        ${renderSidebar()}
        <main class="main">${pageFn(ctx)}</main>
      </div>
      ${modalChip(ctx)}
      ${modalShoot()}
      ${modalShootConfirmClose()}
      ${modalTelegram(ctx)}
      ${modalLoan()}
      ${modalLoanPayment()}
      ${modalGoal()}
      ${modalGoalFund()}
      ${modalClient()}
    `;

    const app = document.getElementById('app');
    app.innerHTML = html;

    if (state.view === 'dashboard') {
      if (!dashboardCountUpDone || dashboardCountUpMonthKey !== ctx.dashMonthKey) {
        dashboardCountUpDone = true;
        dashboardCountUpMonthKey = ctx.dashMonthKey;
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

  function openAddShoot(presetDate, lockDate) {
    const initialDate = presetDate || TODAY_STR;
    const calBase = new Date(initialDate + 'T00:00:00');
    setState({
      modal: { mode: 'add' }, shootAddonsOpen: false, shootDatePickerOpen: false, timePickerOpen: false, shootDeadlinePickerOpen: false,
      shootDateCalYear: calBase.getFullYear(), shootDateCalMonth: calBase.getMonth(),
      shootDeadlineCalYear: calBase.getFullYear(), shootDeadlineCalMonth: calBase.getMonth(),
      draftDateLocked: !!lockDate,
      draft: { id: null, client: '', location: '', date: initialDate, deadline: '', time: '09:00', status: 'idea', scriptStatus: 'Not Started', shootType: 'Real Estate', notes: '', packageTier: 'basic', package: '', paid: '', addons: {} },
    });
  }
  function openEditShoot(id) {
    const sh = state.shoots.find(s => s.id === id);
    if (!sh) return;
    const calBase = new Date((sh.date || TODAY_STR) + 'T00:00:00');
    const deadlineCalBase = new Date((sh.deadline || sh.date || TODAY_STR) + 'T00:00:00');
    // The stored "package" on a Real-Estate/Custom shoot is the GRAND TOTAL — base custom
    // amount plus add-ons already baked in (save-shoot always does packageAmount + addonsTotal).
    // But the "Custom Package Amount" field is meant to hold just the base amount — pre-filling
    // it with the full total would double-count the add-ons the next time this shoot is saved.
    const isCustomRealEstate = sh.shootType === 'Real Estate' && (sh.packageTier || 'custom') === 'custom';
    let basePackage = sh.package;
    if (isCustomRealEstate) {
      const shAddons = sh.addons || {};
      const shAddonsTotal = ADDON_DEFS.reduce((sum, ad) => sum + (shAddons[ad.key] || 0) * ad.price, 0);
      basePackage = Math.max(0, (Number(sh.package) || 0) - shAddonsTotal);
    }
    setState({
      modal: { mode: 'edit', id }, shootAddonsOpen: false, shootDatePickerOpen: false, timePickerOpen: false, shootDeadlinePickerOpen: false,
      shootDateCalYear: calBase.getFullYear(), shootDateCalMonth: calBase.getMonth(),
      shootDeadlineCalYear: deadlineCalBase.getFullYear(), shootDeadlineCalMonth: deadlineCalBase.getMonth(),
      draftDateLocked: false,
      draft: { packageTier: 'custom', shootType: 'General Project', addons: {}, ...sh, package: basePackage },
    });
  }
  function openEditLoan(id) {
    const l = state.loans.find(x => x.id === id);
    if (!l) return;
    // Older records may only have a one-time dueDate rather than a recurring dueDay —
    // derive dueDay from it so the edit form still pre-fills correctly.
    const dueDay = l.dueDay || (l.dueDate ? new Date(l.dueDate + 'T00:00:00').getDate() : '');
    setState({ loanModal: { mode: 'edit', id }, loanDraft: { ...l, dueDay } });
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
      case 'sidebar-toggle': setState(s => {
        const next = !s.sidebarCollapsed;
        try { localStorage.setItem('shoottracker_sidebar_collapsed', next ? '1' : '0'); } catch (e) { /* storage unavailable */ }
        return { sidebarCollapsed: next };
      }); break;
      case 'logout': clearUnlocked(); renderLockScreen(false); break;
      case 'chip-open': setState({ chipModal: el.dataset.key }); break;
      case 'telegram-open': setState({ telegramModalOpen: true, expenseDraft: { description: '', amount: '', date: TODAY_STR } }); break;
      case 'search-clear': setState({ [el.dataset.field]: '' }); break;

      case 'shoot-add-open': openAddShoot(); break;
      case 'shoot-add-open-for-date': openAddShoot(state.selectedDate, true); break;
      case 'shoot-edit': openEditShoot(id); break;
      case 'shoot-delete':
        if (!confirm(`Are you sure you want to delete the shoot "${state.draft.client || 'this shoot'}"? This cannot be undone.`)) break;
        setState(s => ({ shoots: s.shoots.filter(sh => sh.id !== s.draft.id), modal: null, draft: null }));
        break;
      case 'shoot-type-pick': setState(s => ({ draft: { ...s.draft, shootType: el.dataset.type } })); break;
      case 'shoot-addons-toggle': setState(s => ({ shootAddonsOpen: !s.shootAddonsOpen })); break;
      case 'shoot-addon-inc': setState(s => ({ draft: { ...s.draft, addons: { ...s.draft.addons, [el.dataset.key]: ((s.draft.addons && s.draft.addons[el.dataset.key]) || 0) + 1 } } })); break;
      case 'shoot-addon-dec': setState(s => ({ draft: { ...s.draft, addons: { ...s.draft.addons, [el.dataset.key]: Math.max(0, ((s.draft.addons && s.draft.addons[el.dataset.key]) || 0) - 1) } } })); break;
      case 'shoot-addon-toggle': setState(s => ({ draft: { ...s.draft, addons: { ...s.draft.addons, [el.dataset.key]: ((s.draft.addons && s.draft.addons[el.dataset.key]) || 0) > 0 ? 0 : 1 } } })); break;
      case 'shoot-milestone-pick': setState(s => ({ draft: { ...s.draft, paid: Number(el.dataset.amount) || 0 } })); break;
      case 'date-picker-toggle': setState(s => ({ shootDatePickerOpen: !s.shootDatePickerOpen, timePickerOpen: false })); break;
      case 'shoot-date-unlock': setState({ draftDateLocked: false }); break;
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
      case 'fulltime-delete': {
        const rec = state.fullTimeIncome.find(f => f.id === id);
        if (!confirm(`Are you sure you want to delete "${rec ? rec.source : 'this income entry'}"? This cannot be undone.`)) break;
        setState(s => ({ fullTimeIncome: s.fullTimeIncome.filter(f => f.id !== id) }));
        break;
      }
      case 'ft-month-prev': setState(s => {
        const [y, m] = (s.financeMonthKey || THIS_MONTH_KEY).split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        return { financeMonthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
      }); break;
      case 'ft-month-next': setState(s => {
        const [y, m] = (s.financeMonthKey || THIS_MONTH_KEY).split('-').map(Number);
        const d = new Date(y, m, 1);
        return { financeMonthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
      }); break;
      case 'ft-month-today': setState({ financeMonthKey: THIS_MONTH_KEY }); break;
      case 'dash-month-prev': setState(s => {
        const [y, m] = (s.dashMonthKey || THIS_MONTH_KEY).split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        return { dashMonthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
      }); break;
      case 'dash-month-next': setState(s => {
        const [y, m] = (s.dashMonthKey || THIS_MONTH_KEY).split('-').map(Number);
        const d = new Date(y, m, 1);
        return { dashMonthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
      }); break;
      case 'dash-month-today': setState({ dashMonthKey: THIS_MONTH_KEY }); break;
      case 'expense-delete': {
        const rec = state.expenses.find(e => e.id === id);
        if (!confirm(`Are you sure you want to delete "${rec ? rec.description : 'this expense'}"? This cannot be undone.`)) break;
        setState(s => ({ expenses: s.expenses.filter(e => e.id !== id) }));
        break;
      }

      // The top month picker, the big calendar below it, and the Monthly Report chart used to
      // track three separate month/year values — switching one didn't move the others, so the
      // calendar could silently be showing a totally different month than the picker said.
      // They now all move together through this one helper.
      case 'expenses-month-prev': setState(s => {
        const [y, m] = (s.expensesMonthKey || THIS_MONTH_KEY).split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { expensesMonthKey: mk, expensesDayCalYear: d.getFullYear(), expensesDayCalMonth: d.getMonth(), expensesReportSelectedMonth: mk };
      }); break;
      case 'expenses-month-next': setState(s => {
        const [y, m] = (s.expensesMonthKey || THIS_MONTH_KEY).split('-').map(Number);
        const d = new Date(y, m, 1);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { expensesMonthKey: mk, expensesDayCalYear: d.getFullYear(), expensesDayCalMonth: d.getMonth(), expensesReportSelectedMonth: mk };
      }); break;
      case 'expenses-month-today': setState({ expensesMonthKey: THIS_MONTH_KEY, expensesDayCalYear: TODAY.getFullYear(), expensesDayCalMonth: TODAY.getMonth(), expensesReportSelectedMonth: THIS_MONTH_KEY }); break;

      case 'expenses-day-today': setState({ expensesSelectedDate: TODAY_STR }); break;
      case 'expenses-list-toggle': setState(s => ({ expensesListOpen: !s.expensesListOpen })); break;
      case 'expenses-day-cal-prev': setState(s => {
        let m = s.expensesDayCalMonth - 1, y = s.expensesDayCalYear; if (m < 0) { m = 11; y--; }
        const mk = `${y}-${String(m + 1).padStart(2, '0')}`;
        return { expensesDayCalMonth: m, expensesDayCalYear: y, expensesMonthKey: mk, expensesReportSelectedMonth: mk };
      }); break;
      case 'expenses-day-cal-next': setState(s => {
        let m = s.expensesDayCalMonth + 1, y = s.expensesDayCalYear; if (m > 11) { m = 0; y++; }
        const mk = `${y}-${String(m + 1).padStart(2, '0')}`;
        return { expensesDayCalMonth: m, expensesDayCalYear: y, expensesMonthKey: mk, expensesReportSelectedMonth: mk };
      }); break;
      case 'expenses-report-year-prev': setState(s => ({ expensesReportYear: (s.expensesReportYear || TODAY.getFullYear()) - 1 })); break;
      case 'expenses-report-year-next': setState(s => ({ expensesReportYear: (s.expensesReportYear || TODAY.getFullYear()) + 1 })); break;
      case 'expenses-report-month-pick': {
        const [y, m] = el.dataset.month.split('-').map(Number);
        setState({ expensesMonthKey: el.dataset.month, expensesReportSelectedMonth: el.dataset.month, expensesDayCalYear: y, expensesDayCalMonth: m - 1 });
        break;
      }
      case 'expenses-report-export': {
        // One row per actual expense (not just per-month totals) so the file shows exactly
        // what was spent that month, with a subtotal after each month for quick scanning.
        const year = state.expensesReportYear || TODAY.getFullYear();
        const rows = [['Month', 'Date', 'Description', 'Amount (PHP)']];
        let yearTotal = 0;
        for (let i = 0; i < 12; i++) {
          const mk = `${year}-${String(i + 1).padStart(2, '0')}`;
          const monthName = MONTH_SHORT_LABELS[i] + ' ' + year;
          const monthRows = state.expenses.filter(e => e.date && e.date.slice(0, 7) === mk).sort((a, b) => a.date.localeCompare(b.date));
          if (monthRows.length === 0) continue;
          let monthTotal = 0;
          monthRows.forEach(e => {
            const amt = Number(e.amount) || 0;
            monthTotal += amt;
            rows.push([monthName, e.date, e.description || '', amt]);
          });
          rows.push(['', '', monthName + ' Subtotal', monthTotal]);
          rows.push(['', '', '', '']);
          yearTotal += monthTotal;
        }
        rows.push(['', '', `${year} Total`, yearTotal]);
        downloadCSV(`pol-tracker-monthly-expense-report-${year}.csv`, rows.map(r => r.map(csvCell)));
        break;
      }
      case 'expenses-day-pick': setState({ expensesSelectedDate: el.dataset.date }); break;

      case 'export-data-csv': {
        // One clean, single-table CSV per data type — easier to open in Excel/Sheets than
        // one file with several stacked tables of different shapes.
        const shootRows = [['Client', 'Location', 'Date', 'Status', 'Package Total', 'Paid', 'Balance', 'Deadline']];
        state.shoots.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(sh => {
          const pkg = Number(sh.package) || 0, paid = Number(sh.paid) || 0;
          shootRows.push([sh.client || '', sh.location || '', sh.date || '', normalizeShootStatus(sh.status), pkg, paid, pkg - paid, sh.deadline || '']);
        });

        const expenseRows = [['Description', 'Date', 'Amount']];
        state.expenses.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(ex => {
          expenseRows.push([ex.description || '', ex.date || '', Number(ex.amount) || 0]);
        });

        const incomeRows = [['Source', 'Date', 'Amount']];
        state.fullTimeIncome.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(f => {
          incomeRows.push([f.source || '', f.date || '', Number(f.amount) || 0]);
        });

        const clientRows = [['Name', 'Phone', 'Email', 'Lead Status', 'Follow-up Date', 'Notes']];
        state.clients.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(c => {
          clientRows.push([c.name || '', c.phone || '', c.email || '', c.leadStatus || '', c.followUpDate || '', c.notes || '']);
        });

        const loanRows = [['Lender', 'Total Amount', 'Monthly Due', 'Remaining Balance', 'Due Day of Month', 'Status']];
        state.loans.slice().sort((a, b) => (a.lender || '').localeCompare(b.lender || '')).forEach(l => {
          loanRows.push([l.lender || '', Number(l.amount) || 0, Number(l.monthlyDue) || 0, Number(l.remainingBalance) || 0, l.dueDay || (l.dueDate ? new Date(l.dueDate + 'T00:00:00').getDate() : ''), l.status || '']);
        });

        const goalRows = [['Name', 'Target', 'Current', 'Currency']];
        state.goals.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(g => {
          goalRows.push([g.name || '', Number(g.target) || 0, Number(g.current) || 0, g.currency || 'PHP']);
        });

        const files = [
          ['shoots', shootRows], ['expenses', expenseRows], ['income', incomeRows],
          ['clients', clientRows], ['loans', loanRows], ['goals', goalRows],
        ];
        files.forEach(([name, rows], i) => {
          setTimeout(() => downloadCSV(`pol-tracker-${name}-${TODAY_STR}.csv`, rows), i * 150);
        });
        break;
      }

      case 'backup-download': {
        // One JSON file holding every data collection — a true backup you can restore from.
        const data = {};
        PERSIST_KEYS.forEach(k => { data[k] = state[k]; });
        const payload = { app: 'pol-tracker', version: 1, exportedAt: new Date().toISOString(), data };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `pol-tracker-backup-${TODAY_STR}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        break;
      }
      case 'monthly-report': { generateMonthlyReportPdf(); break; }
      case 'backup-restore': {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            let parsed;
            try { parsed = JSON.parse(reader.result); }
            catch (err) { alert("That file isn't a valid backup — couldn't read it."); return; }
            const data = (parsed && parsed.data) ? parsed.data : parsed;
            const keysPresent = PERSIST_KEYS.filter(k => data && (k in data));
            if (!keysPresent.length) { alert("That file doesn't look like a Pol Tracker backup."); return; }
            if (!confirm('Restore from this backup? This will REPLACE all your current data with the contents of the backup. This cannot be undone.')) return;
            const patch = {};
            keysPresent.forEach(k => { patch[k] = data[k]; });
            setState(patch);
            alert('Backup restored successfully.');
          };
          reader.readAsText(file);
        });
        input.click();
        break;
      }

      case 'loan-add-open': setState({ loanModal: { mode: 'add' }, loanDraft: { id: null, lender: '', amount: '', monthlyDue: '', remainingBalance: '', dueDay: '', status: 'ongoing' } }); break;
      case 'loan-edit': openEditLoan(id); break;
      case 'loan-delete':
        if (!confirm(`Are you sure you want to delete the loan "${state.loanDraft.lender || 'this loan'}"? This cannot be undone.`)) break;
        setState(s => ({ loans: s.loans.filter(l => l.id !== s.loanDraft.id), loanModal: null, loanDraft: null }));
        break;
      case 'loan-payment-open': setState({ loanPaymentModal: { id }, loanPaymentDraft: { amount: '' } }); break;
      case 'loan-payment-quick': setState(s => ({ loanPaymentDraft: { ...s.loanPaymentDraft, amount: el.dataset.amount } })); break;
      case 'loan-payment-history-delete': {
        if (!confirm('Remove this logged payment? The amount will be added back to the remaining balance.')) break;
        const targetId = state.loanPaymentModal && state.loanPaymentModal.id;
        const histId = el.dataset.histId;
        setState(s => ({
          loans: s.loans.map(l => {
            if (l.id !== targetId) return l;
            const entry = (l.paymentHistory || []).find(h => h.id === histId);
            if (!entry) return l;
            const newRemaining = (Number(l.remainingBalance) || 0) + (Number(entry.amount) || 0);
            return {
              ...l,
              remainingBalance: newRemaining,
              status: newRemaining > 0 && l.status === 'paid' ? 'ongoing' : l.status,
              paymentHistory: (l.paymentHistory || []).filter(h => h.id !== histId),
            };
          }),
        }));
        break;
      }

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
      case 'goal-fund-open': setState({ goalFundModal: { id }, goalFundDraft: { mode: 'deposit', amount: '', reason: '' } }); break;
      case 'goal-fund-mode': setState(s => ({ goalFundDraft: { ...s.goalFundDraft, mode: el.dataset.mode } })); break;
      case 'goal-fund-history-delete': {
        if (!confirm('Remove this logged entry? Its effect on the saved total will be reversed.')) break;
        const targetId = state.goalFundModal && state.goalFundModal.id;
        const histId = el.dataset.histId;
        setState(s => ({
          goals: s.goals.map(g => {
            if (g.id !== targetId) return g;
            const entry = (g.fundHistory || []).find(h => h.id === histId);
            if (!entry) return g;
            const reverseDelta = entry.mode === 'withdraw' ? (Number(entry.phpAmount) || 0) : -(Number(entry.phpAmount) || 0);
            const newCurrent = Math.max(0, (Number(g.current) || 0) + reverseDelta);
            return { ...g, current: newCurrent, fundHistory: (g.fundHistory || []).filter(h => h.id !== histId) };
          }),
        }));
        break;
      }

      case 'client-add-open': setState({ clientModal: { mode: 'add' }, clientDraft: { id: null, name: '', phone: '', email: '', leadStatus: 'New Lead', followUpDate: '', notes: '' } }); break;
      case 'client-edit': openEditClient(id); break;
      case 'client-delete':
        if (!confirm(`Are you sure you want to delete the client "${state.clientDraft.name || 'this client'}"? This cannot be undone.`)) break;
        setState(s => ({ clients: s.clients.filter(c => c.id !== s.clientDraft.id), clientModal: null, clientDraft: null }));
        break;
      case 'client-view-shoots': ev.stopPropagation(); setState({ chipModal: 'clientshoots:' + id }); break;

      case 'doc-type': setState(s => {
        const doctype = el.dataset.doctype;
        if (doctype === 'invoice') {
          return { docType: doctype, docDraft: { ...s.docDraft, invoiceNumber: formatInvoiceNumber(s.invoiceCounter) } };
        }
        if (doctype === 'quotation') {
          return { docType: doctype, docDraft: { ...s.docDraft, dueDate: addDays(s.docDraft.date || TODAY_STR, 30) } };
        }
        return { docType: doctype };
      }); break;
      case 'doc-generate':
        if (!(state.docDraft.clientName || '').trim()) { alert('Please enter a client name before generating.'); break; }
        generateDocPdf();
        if (state.editingDocId) {
          // Editing an existing document — update it in place. Same id and reference
          // number, no duplicate, and the invoice counter is NOT advanced.
          const editId = state.editingDocId;
          setState(s => ({
            documents: s.documents.map(r => r.id === editId
              ? { ...r, type: s.docType, draft: { ...s.docDraft }, updatedAt: new Date().toISOString() }
              : r),
            editingDocId: null,
            docsHistoryOpen: true,
          }));
        } else {
          setState(s => ({
            documents: [...s.documents, { id: 'doc' + Date.now(), type: s.docType, createdAt: new Date().toISOString(), draft: { ...s.docDraft } }],
          }));
          if (state.docType === 'invoice') {
            setState(s => {
              const nextCounter = s.invoiceCounter + 1;
              localStorage.setItem('shoottracker_invoice_counter', String(nextCounter));
              return { invoiceCounter: nextCounter, docDraft: { ...s.docDraft, invoiceNumber: formatInvoiceNumber(nextCounter) } };
            });
          }
        }
        break;
      case 'doc-history-edit': {
        const rec = state.documents.find(r => r.id === id);
        if (rec) setState({ docType: rec.type, docDraft: { ...rec.draft }, editingDocId: rec.id, docsHistoryOpen: false });
        break;
      }
      case 'doc-cancel-edit':
        setState(s => ({
          editingDocId: null,
          docDraft: { clientName: '', description: '', amount: '', date: TODAY_STR, notes: '', invoiceNumber: formatInvoiceNumber(s.invoiceCounter), dueDate: addDays(TODAY_STR, 10), clientContact: '', lineItems: '', paymentDetails: '', paymentStatus: 'Unpaid', packageTotal: '', paidToDate: '', milestoneLabel: '' },
        }));
        break;
      case 'doc-history-toggle': setState(s => ({ docsHistoryOpen: !s.docsHistoryOpen })); break;
      case 'doc-history-download': {
        const rec = state.documents.find(r => r.id === id);
        if (rec) generateDocPdf(rec.type, rec.draft);
        break;
      }
      case 'doc-history-delete': {
        const rec = state.documents.find(r => r.id === id);
        const recLabel = rec ? `${DOC_TYPE_META[rec.type] ? DOC_TYPE_META[rec.type].title : 'document'} for ${rec.draft.clientName || 'this client'}` : 'this document';
        if (!confirm(`Are you sure you want to delete the ${recLabel}? This cannot be undone.`)) break;
        setState(s => ({ documents: s.documents.filter(r => r.id !== id) }));
        break;
      }
      case 'doc-date-toggle': setState(s => ({ docDatePickerOpen: !s.docDatePickerOpen, docDuePickerOpen: false })); break;
      case 'doc-date-cal-prev': setState(s => { let m = s.docDateCalMonth - 1, y = s.docDateCalYear; if (m < 0) { m = 11; y--; } return { docDateCalMonth: m, docDateCalYear: y }; }); break;
      case 'doc-date-cal-next': setState(s => { let m = s.docDateCalMonth + 1, y = s.docDateCalYear; if (m > 11) { m = 0; y++; } return { docDateCalMonth: m, docDateCalYear: y }; }); break;
      case 'doc-date-pick': setState(s => ({
        docDraft: { ...s.docDraft, date: el.dataset.date, dueDate: addDays(el.dataset.date, s.docType === 'quotation' ? 30 : 10) },
        docDatePickerOpen: false,
      })); break;
      case 'doc-due-toggle': setState(s => ({ docDuePickerOpen: !s.docDuePickerOpen, docDatePickerOpen: false })); break;
      case 'doc-due-cal-prev': setState(s => { let m = s.docDueCalMonth - 1, y = s.docDueCalYear; if (m < 0) { m = 11; y--; } return { docDueCalMonth: m, docDueCalYear: y }; }); break;
      case 'doc-due-cal-next': setState(s => { let m = s.docDueCalMonth + 1, y = s.docDueCalYear; if (m > 11) { m = 0; y++; } return { docDueCalMonth: m, docDueCalYear: y }; }); break;
      case 'doc-due-pick': setState(s => ({ docDraft: { ...s.docDraft, dueDate: el.dataset.date }, docDuePickerOpen: false })); break;

      case 'ftdraft-date-toggle': setState(s => ({ ftDraftDatePickerOpen: !s.ftDraftDatePickerOpen })); break;
      case 'ftdraft-date-cal-prev': setState(s => { let m = s.ftDraftDateCalMonth - 1, y = s.ftDraftDateCalYear; if (m < 0) { m = 11; y--; } return { ftDraftDateCalMonth: m, ftDraftDateCalYear: y }; }); break;
      case 'ftdraft-date-cal-next': setState(s => { let m = s.ftDraftDateCalMonth + 1, y = s.ftDraftDateCalYear; if (m > 11) { m = 0; y++; } return { ftDraftDateCalMonth: m, ftDraftDateCalYear: y }; }); break;
      case 'ftdraft-date-pick': setState(s => ({ ftDraft: { ...s.ftDraft, date: el.dataset.date }, ftDraftDatePickerOpen: false })); break;

      case 'insights-chart-year-prev': setState(s => ({ insightsChartYear: (s.insightsChartYear || TODAY.getFullYear()) - 1 })); break;
      case 'insights-chart-year-next': setState(s => ({ insightsChartYear: (s.insightsChartYear || TODAY.getFullYear()) + 1 })); break;
      case 'insights-chart-month-select': setState({ insightsChartSelectedMonth: el.dataset.month }); break;

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
    else if (which === 'loanpayment') setState({ loanPaymentModal: null, loanPaymentDraft: null });
    else if (which === 'goal') setState({ goalModal: null, goalDraft: null });
    else if (which === 'goalfund') setState({ goalFundModal: null, goalFundDraft: null });
    else if (which === 'client') setState({ clientModal: null, clientDraft: null });
    else if (which === 'chip') setState({ chipModal: null });
  }

  // One-click "boss-ready" PDF: a full summary of the current month —
  // shoots by status, revenue (booked vs collected), outstanding, expenses, and net.
  function generateMonthlyReportPdf() {
    const jspdf = window.jspdf;
    if (!jspdf || !jspdf.jsPDF) { window.print(); return; }
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    const PAGE_W = 612, PAGE_H = 792;
    const marginX = 56, rightX = PAGE_W - marginX;
    const BRAND = [31, 107, 64], INK = [30, 32, 30], GRAY = [110, 115, 110], LINE = [222, 228, 222];
    let y = 0;
    const ensureSpace = (needed) => { if (y + needed > PAGE_H - 56) { doc.addPage(); y = 56; } };
    // Helvetica has no ₱ glyph — use a plain "PHP " prefix so widths measure correctly.
    const money = (n) => 'PHP ' + (Number(n) || 0).toLocaleString('en-PH');

    const monthKey = THIS_MONTH_KEY;
    const monthLabel = new Date(monthKey + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const monthShoots = state.shoots.filter(s => s.date && s.date.slice(0, 7) === monthKey);
    const statusCounts = {};
    monthShoots.forEach(s => { const st = normalizeShootStatus(s.status); statusCounts[st] = (statusCounts[st] || 0) + 1; });
    const booked = monthShoots.reduce((a, s) => a + (Number(s.package) || 0), 0);
    const collected = monthShoots.reduce((a, s) => a + (Number(s.paid) || 0), 0);
    const outstanding = monthShoots.reduce((a, s) => a + Math.max((Number(s.package) || 0) - (Number(s.paid) || 0), 0), 0);
    const expenses = state.expenses.filter(e => e.date && e.date.slice(0, 7) === monthKey).reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const net = collected - expenses;

    // Header
    y = 56;
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text('Monthly Summary', marginX, y);
    y += 20;
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text(`${monthLabel}  ·  Pol Film Productions`, marginX, y);
    y += 14;
    doc.setFontSize(9);
    doc.text('Generated ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), marginX, y);
    y += 12;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.line(marginX, y, rightX, y);
    y += 26;

    const sectionTitle = (t) => { ensureSpace(30); doc.setTextColor(INK[0], INK[1], INK[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(t, marginX, y); y += 17; };
    const kv = (label, value, opts) => {
      opts = opts || {};
      ensureSpace(18);
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setFontSize(opts.bold ? 12 : 11);
      const col = opts.brand ? BRAND : INK;
      doc.setTextColor(col[0], col[1], col[2]);
      doc.text(String(label), marginX, y);
      doc.text(String(value), rightX, y, { align: 'right' });
      y += opts.bold ? 20 : 16;
    };

    // Financial overview
    sectionTitle('Financial Overview');
    kv('Revenue booked', money(booked));
    kv('Collected (paid)', money(collected));
    kv('Outstanding balance', money(outstanding));
    kv('Expenses', money(expenses));
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.line(marginX, y - 2, rightX, y - 2); y += 12;
    kv('Net (collected − expenses)', money(net), { bold: true, brand: true });
    y += 14;

    // Shoots by status
    sectionTitle('Shoots this month — ' + monthShoots.length + ' total');
    if (!monthShoots.length) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('No dated shoots this month.', marginX, y); y += 16;
    } else {
      STATUS_META.forEach(sm => { if (statusCounts[sm.value]) kv(sm.label, String(statusCounts[sm.value])); });
    }
    y += 12;

    // Shoot details table
    if (monthShoots.length) {
      sectionTitle('Shoot Details');
      const cName = marginX, cStatus = marginX + 205, cPkg = 404, cPaid = 480, cBal = rightX;
      ensureSpace(20);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('CLIENT / PROJECT', cName, y);
      doc.text('STATUS', cStatus, y);
      doc.text('PACKAGE', cPkg, y, { align: 'right' });
      doc.text('PAID', cPaid, y, { align: 'right' });
      doc.text('BALANCE', cBal, y, { align: 'right' });
      y += 10; doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.line(marginX, y, rightX, y); y += 14;
      monthShoots.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(s => {
        ensureSpace(16);
        const bal = Math.max((Number(s.package) || 0) - (Number(s.paid) || 0), 0);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(INK[0], INK[1], INK[2]);
        const name = String(s.client || 'Untitled');
        doc.text(name.length > 30 ? name.slice(0, 29) + '…' : name, cName, y);
        doc.setFontSize(9); doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
        doc.text(statusMeta(s.status).label, cStatus, y);
        doc.setFontSize(10); doc.setTextColor(INK[0], INK[1], INK[2]);
        doc.text(money(s.package || 0), cPkg, y, { align: 'right' });
        doc.text(money(s.paid || 0), cPaid, y, { align: 'right' });
        doc.text(money(bal), cBal, y, { align: 'right' });
        y += 15;
      });
    }

    doc.save(`pol-tracker-monthly-summary-${monthKey}.pdf`);
  }

  function generateDocPdf(overrideType, overrideDraft) {
    const jspdf = window.jspdf;
    if (!jspdf || !jspdf.jsPDF) { window.print(); return; }
    const { jsPDF } = jspdf;
    const d = overrideDraft || state.docDraft;
    const docType = overrideType || state.docType;
    const isInvoice = docType === 'invoice';
    const meta = DOC_TYPE_META[docType];
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    const PAGE_W = 612, PAGE_H = 792;
    const marginX = 56, contentW = PAGE_W - marginX * 2, rightX = PAGE_W - marginX;
    const BRAND = [31, 107, 64];
    const INK = [30, 32, 30];
    const GRAY = [110, 115, 110];
    const LINE = [222, 228, 222];
    let y = 0;

    const ensureSpace = (needed) => {
      if (y + needed > PAGE_H - 70) { doc.addPage(); y = 56; }
    };
    // The standard PDF fonts (Helvetica etc.) don't include the ₱ glyph — jsPDF silently
    // truncates it to the wrong character and mis-measures the string width, causing both
    // a garbled symbol and text overflow. For amounts embedded in flowing sentences we use
    // a plain "PHP" prefix (safe, correctly measured). For standalone amount displays we
    // hand-draw an actual peso sign (a bold "P" with two strike bars) so it still reads as ₱.
    const pdfFmtMoney = (n) => 'PHP ' + (Number(n) || 0).toLocaleString('en-PH');
    // Any free-text field (line items, payment details, notes) can contain a real ₱ character
    // typed by the user or embedded by the app's own fmtMoney() helper — same font problem as
    // above, so strip it before it ever reaches doc.text()/splitTextToSize().
    const sanitizePeso = (s) => String(s || '').replace(/₱/g, 'PHP ');
    // splitTextToSize doesn't respect embedded "\n" as real line breaks — it treats the whole
    // string as one paragraph and only wraps at the given width, collapsing intentional line
    // breaks (e.g. between breakdown items) into a single run-on line. Split on "\n" ourselves
    // first, then wrap each resulting line individually so breaks are preserved.
    const wrapMultiline = (str, maxWidth) => {
      const lines = sanitizePeso(str).split('\n').map(s => s.trim()).filter(Boolean);
      let out = [];
      lines.forEach(line => { out = out.concat(doc.splitTextToSize(line, maxWidth)); });
      return out;
    };
    const drawPeso = (amount, x, yPos, fontSize, color, bold) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(...color);
      doc.text('P', x, yPos);
      const pW = doc.getTextWidth('P');
      doc.setDrawColor(...color);
      doc.setLineWidth(Math.max(0.6, fontSize * 0.055));
      const barX0 = x - fontSize * 0.03, barX1 = x + pW * 0.68;
      doc.line(barX0, yPos - fontSize * 0.58, barX1, yPos - fontSize * 0.58);
      doc.line(barX0, yPos - fontSize * 0.4, barX1, yPos - fontSize * 0.4);
      const amtStr = (Number(amount) || 0).toLocaleString('en-PH');
      doc.text(amtStr, x + pW + fontSize * 0.1, yPos);
      return x + pW + fontSize * 0.1 + doc.getTextWidth(amtStr);
    };
    // Measures a drawPeso() call's total width without drawing it, so a prominent amount can
    // be right-aligned against a fixed edge (draw at rightEdge - measurePeso(...)).
    const measurePeso = (amount, fontSize, bold) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      const pW = doc.getTextWidth('P');
      const amtStr = (Number(amount) || 0).toLocaleString('en-PH');
      return pW + fontSize * 0.1 + doc.getTextWidth(amtStr);
    };

    // Hand-drawn "pol." mark (ring-style p/o, solid l, dot, red rec-dot) — recreated as
    // vector shapes so it doesn't depend on any external logo image file. bgColor is the
    // color drawn "through" the ring letters' holes, so it must match whatever this sits on.
    const drawPolMark = (x, yTop, H, markColor, bgColor) => {
      const xTop = yTop + H * 0.30;
      const baseline = yTop + H * 0.82;
      const descBottom = yTop + H * 1.05;
      const bowlR = (baseline - xTop) / 2;
      const ringT = bowlR * 0.55;
      const stemW = ringT * 0.95;

      doc.setFillColor(...markColor);
      doc.rect(x, xTop, stemW, descBottom - xTop, 'F');
      const pCx = x + stemW + bowlR - ringT * 0.15, pCy = xTop + bowlR;
      doc.circle(pCx, pCy, bowlR, 'F');
      doc.setFillColor(...bgColor);
      doc.circle(pCx, pCy, bowlR - ringT, 'F');

      doc.setFillColor(...markColor);
      const oCx = pCx + bowlR * 2 + ringT * 0.3 - ringT * 0.15;
      doc.circle(oCx, pCy, bowlR, 'F');
      doc.setFillColor(...bgColor);
      doc.circle(oCx, pCy, bowlR - ringT, 'F');

      doc.setFillColor(...markColor);
      const lX = oCx + bowlR + ringT * 0.5;
      doc.rect(lX, yTop, stemW, baseline - yTop, 'F');

      const dotR = stemW * 0.65;
      const dotX = lX + stemW + ringT * 0.7 + dotR;
      doc.circle(dotX, baseline - dotR, dotR, 'F');

      const recCx = dotX + dotR + bowlR * 0.95;
      const recCy = yTop + H * 0.5;
      const recOuterR = bowlR * 0.62;
      doc.setDrawColor(200, 40, 35);
      doc.setLineWidth(recOuterR * 0.3);
      doc.circle(recCx, recCy, recOuterR, 'S');
      doc.setFillColor(200, 40, 35);
      doc.circle(recCx, recCy, recOuterR * 0.48, 'F');

      return recCx + recOuterR;
    };

    const DARK = [22, 23, 22];
    const BRAND_PALE = [243, 247, 244];
    const colW = contentW / 2 - 16;
    const col2X = marginX + contentW / 2 + 16;
    const truncate = (str, maxW) => {
      const lines = doc.splitTextToSize(str, maxW);
      return lines[0] + (lines.length > 1 ? '…' : '');
    };

    // ---- top row: small logo badge + doc title ----
    const badgeSize = 46, badgeY = 42;
    doc.setFillColor(...DARK);
    doc.roundedRect(marginX, badgeY, badgeSize, badgeSize, 10, 10, 'F');
    drawPolMark(marginX + 8, badgeY + 13, 15, [255, 255, 255], DARK);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...INK);
    doc.text(meta.title.toUpperCase(), rightX, badgeY + 16, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text('Pol Film Productions', rightX, badgeY + 30, { align: 'right' });
    if (isInvoice) doc.text(`Reference No. ${d.invoiceNumber || '—'}`, rightX, badgeY + 43, { align: 'right' });

    y = badgeY + badgeSize + 28;

    // ---- meta row: issue date / due date / status (invoice) or project / type (others) ----
    const metaColW = contentW / 3;
    const metaField = (label, value, xOff, color) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GRAY);
      doc.text(label, marginX + xOff, y);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...(color || INK));
      doc.text(value, marginX + xOff, y + 16);
    };
    if (isInvoice) {
      const statusColor = d.paymentStatus === 'Paid' ? BRAND : d.paymentStatus === 'Partial' ? [180, 130, 20] : [180, 45, 40];
      metaField('ISSUE DATE', fmtDateShortYear(d.date), 0);
      metaField('DUE DATE', fmtDateShortYear(d.dueDate), metaColW);
      metaField('PAYMENT STATUS', (d.paymentStatus || 'Unpaid').toUpperCase(), metaColW * 2, statusColor);
    } else if (docType === 'quotation') {
      metaField('ISSUE DATE', fmtDateShortYear(d.date), 0);
      metaField('VALID UNTIL', d.dueDate ? fmtDateShortYear(d.dueDate) : '—', metaColW, BRAND);
      metaField('PROJECT', truncate(sanitizePeso(d.description) || '—', metaColW - 16), metaColW * 2);
    } else {
      metaField('ISSUE DATE', fmtDateShortYear(d.date), 0);
      metaField('PROJECT / SERVICE', truncate(sanitizePeso(d.description) || '—', metaColW - 16), metaColW);
      metaField('DOCUMENT TYPE', 'Contract', metaColW * 2);
    }
    y += 42;
    doc.setDrawColor(...LINE); doc.setLineWidth(1);
    doc.line(marginX, y, rightX, y);
    y += 26;

    // ---- billed by / billed to ----
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BRAND);
    doc.text(docType === 'quotation' ? 'PREPARED BY' : 'BILLED BY', marginX, y);
    doc.text(docType === 'quotation' ? 'PREPARED FOR' : 'BILLED TO', col2X, y);
    y += 16;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...INK);
    doc.text('Pol Film Productions', marginX, y);
    doc.text(sanitizePeso(d.clientName) || '[Client Name]', col2X, y);
    y += 15;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRAY);
    doc.text('Video Production & Editing Services', marginX, y);
    const contactLines = wrapMultiline(d.clientContact || 'No contact details provided', colW);
    contactLines.forEach((line, i) => doc.text(line, col2X, y + i * 12));
    y += Math.max(contactLines.length, 1) * 12 + 24;

    doc.setDrawColor(...LINE); doc.setLineWidth(1);
    doc.line(marginX, y, rightX, y);
    y += 24;

    // ---- main content: itemized table (invoice) or descriptive paragraph (contract/quotation) ----
    if (isInvoice) {
      ensureSpace(60);
      doc.setFillColor(...BRAND_PALE);
      doc.rect(marginX, y, contentW, 24, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BRAND);
      doc.text('ITEM', marginX + 12, y + 16);
      doc.text('AMOUNT', rightX - 12, y + 16, { align: 'right' });
      y += 24;
      const items = parseLineItems(d.lineItems);
      const rows = items.length ? items : [{ label: 'No items listed', amount: null }];
      rows.forEach(it => {
        const labelLines = doc.splitTextToSize(sanitizePeso(it.label), contentW - 150);
        const rowH = Math.max(labelLines.length, 1) * 14 + 12;
        ensureSpace(rowH);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK);
        labelLines.forEach((ln, i) => doc.text(ln, marginX + 12, y + 17 + i * 14));
        doc.text(it.amount != null ? pdfFmtMoney(it.amount) : '—', rightX - 12, y + 17, { align: 'right' });
        y += rowH;
        doc.setDrawColor(...LINE); doc.setLineWidth(0.75);
        doc.line(marginX, y, rightX, y);
      });
      y += 20;
    } else if (docType === 'quotation') {
      // intro paragraph
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...INK);
      const introLines = doc.splitTextToSize(sanitizePeso(meta.body(d, pdfFmtMoney)), contentW);
      ensureSpace(introLines.length * 15 + 24);
      introLines.forEach(line => { doc.text(line, marginX, y); y += 15; });
      y += 14;
      // inclusions — numbered badges inside a bordered container (mirrors the on-screen preview)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BRAND);
      doc.text('INCLUSIONS', marginX, y); y += 12;
      const qitems = parseLineItems(d.lineItems);
      const qrows = qitems.length ? qitems
        : [{ label: sanitizePeso(d.description) || 'Professional service', amount: (Number(d.amount) || 0) ? Number(d.amount) : null }];
      const qPadX = 14, qBadge = 16, qGap = 10, qLabelX = marginX + qPadX + qBadge + qGap, qLabelW = contentW - qPadX * 2 - qBadge - qGap - 92;
      const qLayout = qrows.map(it => {
        const lines = doc.splitTextToSize(sanitizePeso(it.label), qLabelW);
        return { it, lines, h: Math.max(lines.length, 1) * 13 + 16 };
      });
      const qBoxH = qLayout.reduce((a, r) => a + r.h, 0);
      ensureSpace(qBoxH + 8);
      doc.setDrawColor(...LINE); doc.setLineWidth(1);
      doc.roundedRect(marginX, y, contentW, qBoxH, 10, 10, 'D');
      let qry = y;
      qLayout.forEach((r, i) => {
        if (i > 0) { doc.setDrawColor(...LINE); doc.setLineWidth(0.75); doc.line(marginX, qry, marginX + contentW, qry); }
        const textY = qry + 17;
        doc.setFillColor(...BRAND_PALE);
        doc.roundedRect(marginX + qPadX, qry + 9, qBadge, qBadge, 5, 5, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BRAND);
        doc.text(String(i + 1), marginX + qPadX + qBadge / 2, qry + 9 + qBadge / 2 + 3.2, { align: 'center' });
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...INK);
        r.lines.forEach((ln, j) => doc.text(ln, qLabelX, textY + j * 13));
        if (r.it.amount != null) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...INK);
          doc.text(pdfFmtMoney(r.it.amount), marginX + contentW - qPadX, textY, { align: 'right' });
        }
        qry += r.h;
      });
      y += qBoxH + 20;
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...INK);
      const bodyLines = doc.splitTextToSize(sanitizePeso(meta.body(d, pdfFmtMoney)), contentW);
      ensureSpace(bodyLines.length * 15 + 10);
      bodyLines.forEach(line => { doc.text(line, marginX, y); y += 15; });
      y += 16;
    }

    // ---- invoice: package summary (total package minus what's already paid) ----
    // Only shown when the invoice was auto-filled from a shoot, so a milestone payment
    // (e.g. "50% Final Delivery") doesn't look like an unexplained item in the table above —
    // it's clearly a running total, not another charge.
    if (isInvoice && d.packageTotal) {
      ensureSpace(50);
      const sumW = 230, sumX = rightX - sumW;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRAY);
      doc.text('Total Package', sumX, y);
      doc.text(pdfFmtMoney(d.packageTotal), rightX, y, { align: 'right' });
      y += 15;
      if (Number(d.paidToDate) > 0) {
        doc.text('Less: Paid to Date', sumX, y);
        doc.text('- ' + pdfFmtMoney(d.paidToDate), rightX, y, { align: 'right' });
        y += 15;
      }
      doc.setDrawColor(...LINE); doc.setLineWidth(0.75);
      doc.line(sumX, y + 2, rightX, y + 2);
      y += 22;
    }

    // ---- bottom: payment details + total (invoice) or total only (contract/quotation) ----
    if (isInvoice) {
      ensureSpace(90);
      const leftW = contentW * 0.52, boxW = contentW - leftW - 20, boxX = marginX + leftW + 20, startY = y;
      let ly = startY;
      if (d.paymentDetails) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BRAND);
        doc.text('PAYMENT DETAILS', marginX, ly);
        ly += 14;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
        const payLines = wrapMultiline(d.paymentDetails, leftW);
        payLines.forEach(line => { doc.text(line, marginX, ly); ly += 13; });
      }
      const hasMilestone = !!d.milestoneLabel;
      const boxH = hasMilestone ? 70 : 58;
      doc.setDrawColor(...LINE); doc.setFillColor(...BRAND_PALE);
      doc.roundedRect(boxX, startY - 8, boxW, boxH, 8, 8, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
      doc.text('TOTAL AMOUNT DUE', boxX + 14, startY + 10);
      let pesoY = startY + 38;
      if (hasMilestone) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
        doc.text(sanitizePeso(d.milestoneLabel), boxX + 14, startY + 22);
        pesoY = startY + 50;
      }
      const totW = measurePeso(d.amount, 18, true);
      drawPeso(d.amount, boxX + boxW - 14 - totW, pesoY, 18, INK, true);
      y = Math.max(ly, startY - 8 + boxH) + 26;
    } else if (docType === 'quotation') {
      // subtotal + prominent Total Proposed Rate box (mirrors preview)
      const qi = parseLineItems(d.lineItems);
      const qHasAmt = qi.some(it => it.amount != null);
      const qSub = qi.reduce((a, it) => a + (it.amount != null ? Number(it.amount) : 0), 0);
      ensureSpace(90);
      const boxW = 250, boxX = rightX - boxW;
      if (qHasAmt) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRAY);
        doc.text('Subtotal', boxX, y);
        doc.text(pdfFmtMoney(qSub), rightX, y, { align: 'right' });
        y += 16;
      }
      doc.setDrawColor(...LINE); doc.setFillColor(...BRAND_PALE);
      doc.roundedRect(boxX, y, boxW, 56, 10, 10, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BRAND);
      doc.text('TOTAL PROPOSED RATE', boxX + 16, y + 20);
      const qTotW = measurePeso(d.amount, 19, true);
      drawPeso(d.amount, boxX + boxW - 16 - qTotW, y + 44, 19, INK, true);
      y += 56 + 24;
      // Next Step — green-tinted box with a left accent bar
      const nsLines = doc.splitTextToSize('To confirm your booking, reply to accept this quotation and settle the downpayment. We will then reserve your shoot schedule.', contentW - 32);
      const nsH = nsLines.length * 13 + 32;
      ensureSpace(nsH + 10);
      doc.setFillColor(230, 241, 233); doc.roundedRect(marginX, y, contentW, nsH, 8, 8, 'F');
      doc.setFillColor(...BRAND); doc.rect(marginX, y, 4, nsH, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BRAND);
      doc.text('NEXT STEP', marginX + 16, y + 17);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
      nsLines.forEach((line, i) => doc.text(line, marginX + 16, y + 32 + i * 13));
      y += nsH + 22;
      // Payment Terms
      ensureSpace(44);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BRAND);
      doc.text('PAYMENT TERMS', marginX, y); y += 14;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRAY);
      doc.splitTextToSize('50% downpayment to confirm the booking. Balance due upon delivery of the final files.', contentW).forEach(line => { doc.text(line, marginX, y); y += 13; });
      y += 10;
    } else {
      ensureSpace(70);
      const boxW = 230, boxX = rightX - boxW;
      doc.setDrawColor(...LINE); doc.setFillColor(...BRAND_PALE);
      doc.roundedRect(boxX, y, boxW, 54, 8, 8, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
      doc.text('TOTAL CONTRACT VALUE', boxX + 14, y + 17);
      const totW2 = measurePeso(d.amount, 17, true);
      drawPeso(d.amount, boxX + boxW - 14 - totW2, y + 41, 17, INK, true);
      y += 54 + 26;
    }

    // ---- notes ----
    if (d.notes) {
      ensureSpace(40);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BRAND);
      doc.text('NOTES', marginX, y);
      y += 14;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRAY);
      const noteLines = wrapMultiline(d.notes, contentW);
      noteLines.forEach(line => { doc.text(line, marginX, y); y += 13; });
      y += 10;
    }

    // ---- signature block (contract only) ----
    if (docType === 'contract') {
      ensureSpace(90);
      y += 20;
      const sigW = colW;
      doc.setDrawColor(...INK); doc.setLineWidth(0.75);
      doc.line(marginX, y, marginX + sigW, y);
      doc.line(marginX + sigW + 24, y, marginX + sigW + 24 + sigW, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
      doc.text('Client Signature', marginX, y + 14);
      doc.text('Pol Film Productions', marginX + sigW + 24, y + 14);
      doc.text(`Printed Name: ${d.clientName || '_______________'}`, marginX, y + 28);
      doc.text('Printed Name: _______________', marginX + sigW + 24, y + 28);
      y += 44;
    }

    // ---- footer ----
    doc.setDrawColor(...LINE); doc.setLineWidth(0.75);
    doc.line(marginX, PAGE_H - 50, rightX, PAGE_H - 50);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text('Pol Film Productions · Generated via Pol Tracker', marginX, PAGE_H - 36);
    doc.text(fmtDateLong(TODAY_STR), rightX, PAGE_H - 36, { align: 'right' });

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
      if ((state.shootDatePickerOpen || state.timePickerOpen || state.shootDeadlinePickerOpen || state.docDatePickerOpen || state.docDuePickerOpen || state.ftDraftDatePickerOpen) && !e.target.closest('[data-picker-popover]')) {
        const action = actionEl ? actionEl.dataset.action : null;
        if (action !== 'date-picker-toggle' && action !== 'time-picker-toggle' && action !== 'deadline-picker-toggle' && action !== 'doc-date-toggle' && action !== 'doc-due-toggle' && action !== 'ftdraft-date-toggle') {
          setState({ shootDatePickerOpen: false, timePickerOpen: false, shootDeadlinePickerOpen: false, docDatePickerOpen: false, docDuePickerOpen: false, ftDraftDatePickerOpen: false });
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
      const el = e.target;
      const bind = el.dataset.bind;
      if (!bind) return;
      if (el.dataset.fmt === 'money') {
        const oldCursor = el.selectionStart == null ? el.value.length : el.selectionStart;
        const rawCharsBeforeCursor = el.value.slice(0, oldCursor).replace(/[^\d.]/g, '').length;
        applyBind(bind, sanitizeMoneyInput(el.value));
        render();
        const newEl = app.querySelector(`[data-bind="${bind}"]`);
        if (newEl) {
          const pos = moneyCursorAfterFormat(newEl.value, rawCharsBeforeCursor);
          newEl.focus();
          try { newEl.setSelectionRange(pos, pos); } catch (err) { /* not applicable for this input type */ }
        }
        return;
      }
      if (el.dataset.fmt === 'autocomplete') {
        // Spreadsheet-style inline autocomplete: as the user types, if what they've typed is
        // the start of an existing client/project name, silently fill in the rest and select
        // (highlight) that suggested tail — typing more overwrites it, and it's otherwise
        // just part of the value if they leave it. No dropdown list involved.
        const typed = el.value;
        const isDeleting = !!(e.inputType && e.inputType.indexOf('delete') === 0);
        let finalValue = typed;
        let match = null;
        if (!isDeleting && typed.trim()) {
          const candidates = state.clients.map(c => c.name)
            .filter(n => n.length > typed.length && n.toLowerCase().startsWith(typed.toLowerCase()))
            .sort((a, b) => a.length - b.length);
          match = candidates[0] || null;
          if (match) finalValue = typed + match.slice(typed.length);
        }
        applyBind(bind, finalValue);
        render();
        const newEl = app.querySelector(`[data-bind="${bind}"]`);
        if (newEl) {
          newEl.focus();
          try {
            if (match) newEl.setSelectionRange(typed.length, finalValue.length);
            else newEl.setSelectionRange(finalValue.length, finalValue.length);
          } catch (err) { /* not applicable for this input type */ }
        }
        return;
      }
      applyBind(bind, el.value);
      render();
    });

    app.addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.actionChange === 'doc-shoot-pick') {
        const shootId = el.value;
        if (shootId) {
          const sh = state.shoots.find(s => s.id === shootId);
          if (sh) {
            const dec = decorate(sh);
            const client = state.clients.find(c => c.name.trim().toLowerCase() === sh.client.trim().toLowerCase());
            const contact = client ? [client.phone, client.email].filter(Boolean).join(' · ') : '';
            const addons = sh.addons || {};
            const addonsTotal = ADDON_DEFS.reduce((sum, ad) => sum + (addons[ad.key] || 0) * ad.price, 0);
            const grandTotal = Number(sh.package) || 0;
            const paidAmt = Number(sh.paid) || 0;
            const baseAmt = grandTotal - addonsTotal;
            const baseLabel = (dec.packageTierLabel.split(' - ')[1] || dec.packageTierLabel).split(' (')[0];
            const addonLines = ADDON_DEFS.filter(ad => (addons[ad.key] || 0) > 0)
              .map(ad => `${ad.label}${ad.flat ? '' : ' x' + addons[ad.key]} - ${fmtMoney(ad.price * addons[ad.key])}`);
            // Same 20% DP / 30% Shoot / 50% Final milestone schedule used in the shoot's own
            // "Payment Terms" section — find the first milestone not yet covered by sh.paid,
            // and bill exactly what's still needed to reach it (not the full remaining balance).
            const milestoneDefs = [
              { shortLabel: '20% DP', label: '20% Down Payment', target: grandTotal * 0.2 },
              { shortLabel: '30% Shoot', label: '30% After Shoot', target: grandTotal * 0.5 },
              { shortLabel: '50% Final', label: '50% Final Delivery', target: grandTotal },
            ];
            const fullBalance = Math.max(grandTotal - paidAmt, 0);
            const nextMilestone = milestoneDefs.find(m => paidAmt < m.target);
            const dueAmount = nextMilestone ? Math.max(Math.min(nextMilestone.target - paidAmt, fullBalance), 0) : 0;
            // Line Items holds only the actual package/add-on charges — the running totals
            // (package total, what's already paid, what's due now) are kept as separate
            // structured fields so the invoice can show them as a clearly-labeled summary
            // instead of mixing them into the item table as if they were more line items.
            const lineItems = [
              `${baseLabel} - ${fmtMoney(baseAmt)}`,
              ...addonLines,
            ].join('\n');
            const balance = dueAmount;
            const paymentStatus = dueAmount > 0 ? 'Unpaid' : 'Paid';
            state = {
              ...state,
              docDraft: {
                ...state.docDraft,
                clientName: sh.client,
                clientContact: contact || state.docDraft.clientContact,
                description: `${sh.shootType}${sh.location ? ' - ' + sh.location : ''}`,
                amount: String(balance),
                lineItems,
                packageTotal: String(grandTotal),
                paidToDate: String(paidAmt),
                milestoneLabel: nextMilestone ? nextMilestone.label : 'Fully Paid',
                paymentStatus,
              },
            };
            render();
          }
        }
        return;
      }
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
      // Text inputs with data-fmt (money, autocomplete) are already kept fully in sync by the
      // 'input' listener above on every keystroke, including sanitizing money values (stripping
      // commas) before storing them. If we also re-apply here on 'change' (which fires on blur —
      // e.g. the instant "Save Changes" is clicked), we'd overwrite that clean value with the
      // raw, comma-formatted display text, turning "11,000" into NaN/0 right before submit.
      if (el.dataset.fmt) return;
      const bind = el.dataset.bind;
      if (bind) { applyBind(bind, el.value); render(); }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (state.shootConfirmCloseOpen) {
        e.preventDefault(); e.stopPropagation();
        setState({ shootConfirmCloseOpen: false });
      } else if (state.shootDatePickerOpen || state.timePickerOpen || state.shootDeadlinePickerOpen || state.docDatePickerOpen || state.docDuePickerOpen || state.ftDraftDatePickerOpen) {
        e.preventDefault(); e.stopPropagation();
        setState({ shootDatePickerOpen: false, timePickerOpen: false, shootDeadlinePickerOpen: false, docDatePickerOpen: false, docDuePickerOpen: false, ftDraftDatePickerOpen: false });
      } else if (state.modal) {
        e.preventDefault(); e.stopPropagation();
        setState({ shootConfirmCloseOpen: true });
      } else if (state.loanModal || state.loanPaymentModal || state.goalModal || state.goalFundModal || state.clientModal || state.telegramModalOpen || state.chipModal) {
        e.preventDefault(); e.stopPropagation();
        closeModalOf(state.loanModal ? 'loan' : state.loanPaymentModal ? 'loanpayment' : state.goalModal ? 'goal' : state.goalFundModal ? 'goalfund' : state.clientModal ? 'client' : state.telegramModalOpen ? 'telegram' : 'chip');
      }
    });

    app.addEventListener('submit', (e) => {
      const form = e.target.closest('form[data-action]');
      if (!form) return;
      e.preventDefault();
      const action = form.dataset.action;
      if (action === 'save-shoot') {
        const d = state.draft;
        if (!(d.client || '').trim()) { alert('Please enter a client / project name.'); return; }
        const isRealEstate = d.shootType === 'Real Estate';
        const liveTiers = getLiveTiers(state.packageRates);
        const packageAmount = (!isRealEstate || (d.packageTier || 'custom') === 'custom')
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
        if (!(d.description || '').trim() || !d.amount) { alert('Please fill in what you spent on and the amount.'); return; }
        if (d.date && d.date > TODAY_STR) { alert('Expense date cannot be in the future.'); return; }
        const entry = { id: 'ex' + Date.now(), description: d.description, amount: Number(d.amount) || 0, date: d.date || TODAY_STR };
        setState(s => ({ expenses: [...s.expenses, entry], telegramModalOpen: false }));
      } else if (action === 'save-fulltime') {
        const d = state.ftDraft;
        const source = d.sourceType === '1st' ? 'Salary - 1st Cutoff'
          : d.sourceType === '2nd' ? 'Salary - 2nd Cutoff'
          : (d.sourceOther || '').trim();
        if (!source || !d.amount) { alert('Please fill in the source and amount.'); return; }
        if (d.date && d.date > TODAY_STR) { alert('Income date cannot be in the future.'); return; }
        const entryDate = d.date || TODAY_STR;
        const entry = { id: 'ft' + Date.now(), source, amount: Number(d.amount) || 0, date: entryDate };
        setState(s => ({ fullTimeIncome: [...s.fullTimeIncome, entry], ftDraft: { sourceType: '1st', sourceOther: '', amount: '', date: TODAY_STR }, financeMonthKey: entryDate.slice(0, 7) }));
      } else if (action === 'save-loan') {
        const d = state.loanDraft;
        if (!(d.lender || '').trim() || !d.amount) { alert('Please enter a lender / source name and a loan amount.'); return; }
        const loanAmountNum = Number(d.amount) || 0;
        const remainingBalanceNum = (d.remainingBalance === '' || d.remainingBalance === null || d.remainingBalance === undefined) ? loanAmountNum : (Number(d.remainingBalance) || 0);
        const cleaned = { ...d, amount: loanAmountNum, monthlyDue: Number(d.monthlyDue) || 0, remainingBalance: remainingBalanceNum, dueDay: d.dueDay ? Number(d.dueDay) : null };
        delete cleaned.dueDate;
        setState(s => s.loanModal.mode === 'add'
          ? { loans: [...s.loans, { ...cleaned, id: 'ln' + Date.now() }], loanModal: null, loanDraft: null }
          : { loans: s.loans.map(l => l.id === cleaned.id ? cleaned : l), loanModal: null, loanDraft: null });
      } else if (action === 'save-loan-payment') {
        const pd = state.loanPaymentDraft;
        const amt = Number(pd.amount) || 0;
        if (amt <= 0) { alert('Please enter a payment amount.'); return; }
        if (state.loanPaymentModal) {
          const targetId = state.loanPaymentModal.id;
          setState(s => ({
            loans: s.loans.map(l => {
              if (l.id !== targetId) return l;
              const newRemaining = Math.max(0, (Number(l.remainingBalance) || 0) - amt);
              const historyEntry = { id: 'lp' + Date.now(), date: TODAY_STR, amount: amt };
              return { ...l, remainingBalance: newRemaining, status: newRemaining === 0 ? 'paid' : l.status, paymentHistory: [...(l.paymentHistory || []), historyEntry] };
            }),
            loanPaymentModal: null, loanPaymentDraft: null,
          }));
        }
      } else if (action === 'save-goal') {
        const d = state.goalDraft;
        if (!(d.name || '').trim()) { alert('Please enter a goal name.'); return; }
        const isUSD = d.currency === 'USD';
        const target = isUSD ? Math.round((Number(d.target) || 0) * USD_TO_PHP) : (Number(d.target) || 0);
        const current = isUSD ? Math.round((Number(d.current) || 0) * USD_TO_PHP) : (Number(d.current) || 0);
        const cleaned = { ...d, target, current };
        setState(s => s.goalModal.mode === 'add'
          ? { goals: [...s.goals, { ...cleaned, id: 'g' + Date.now() }], goalModal: null, goalDraft: null }
          : { goals: s.goals.map(g => g.id === cleaned.id ? cleaned : g), goalModal: null, goalDraft: null });
      } else if (action === 'save-goal-fund') {
        const fd = state.goalFundDraft;
        const amt = Number(fd.amount) || 0;
        if (amt <= 0) { alert('Please enter an amount.'); return; }
        if (fd.mode === 'withdraw' && !(fd.reason || '').trim()) { alert('Please enter a reason for this withdrawal.'); return; }
        if (state.goalFundModal) {
          const targetId = state.goalFundModal.id;
          setState(s => {
            const g = s.goals.find(x => x.id === targetId);
            if (!g) return { goalFundModal: null, goalFundDraft: null };
            const phpAmt = g.currency === 'USD' ? amt * USD_TO_PHP : amt;
            const delta = fd.mode === 'withdraw' ? -phpAmt : phpAmt;
            const newCurrent = Math.max(0, (Number(g.current) || 0) + delta);
            const historyEntry = { id: 'gf' + Date.now(), date: TODAY_STR, amount: amt, phpAmount: phpAmt, mode: fd.mode || 'deposit', reason: fd.mode === 'withdraw' ? (fd.reason || '').trim() : '' };
            return {
              goals: s.goals.map(x => x.id === targetId ? { ...x, current: newCurrent, fundHistory: [...(x.fundHistory || []), historyEntry] } : x),
              goalFundModal: null, goalFundDraft: null,
            };
          });
        }
      } else if (action === 'save-client') {
        const d = state.clientDraft;
        if (!(d.name || '').trim()) { alert('Please enter a client name.'); return; }
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
      offlineMode = false;
      if (remote) {
        applyPersistedData(remote);
        saveDataCache(remote); // keep a local copy so the app can show data offline (view-only)
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
      console.error('Failed to load your data', e);
      // If a copy was saved during a previous online session, show it in OFFLINE
      // (view-only) mode instead of a dead end. Editing is blocked in setState().
      const cached = loadDataCache();
      if (cached) {
        offlineMode = true;
        applyPersistedData(cached);
      } else {
        // No cache yet — don't silently show empty data, since a save could overwrite
        // real records with blanks. Show a blocking error with Retry instead.
        const errApp = document.getElementById('app');
        errApp.innerHTML = `
          <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:20px">
            <div style="width:360px;max-width:100%;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:28px;display:flex;flex-direction:column;gap:12px;text-align:center">
              <div class="sg" style="font-weight:700;font-size:16px">Couldn't load your data</div>
              <div style="color:var(--text-dim);font-size:13px;line-height:1.55">Check your internet connection, then tap Retry. <b>Please don't add or edit anything until your data loads</b> — doing so could overwrite your saved records.</div>
              <button type="button" id="retry-load" class="btn-primary" style="text-align:center">Retry</button>
            </div>
          </div>`;
        const retryBtn = document.getElementById('retry-load');
        if (retryBtn) retryBtn.addEventListener('click', () => location.reload());
        return;
      }
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

  document.addEventListener('DOMContentLoaded', async () => {
    if (await ensureSession()) init();
    else renderLockScreen(false);
  });
})();
