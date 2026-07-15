/* ShootTracker — Pol Film Productions
   Standalone implementation of the ShootTracker.dc.html design. */
(function () {
  'use strict';

  /* ---------------- constants & sample data ---------------- */

  const PRIORITY_META = {
    High:   { color: 'oklch(0.7 0.19 25)',   bg: 'oklch(0.7 0.19 25 / 0.16)' },
    Medium: { color: 'oklch(0.78 0.14 80)',  bg: 'oklch(0.78 0.14 80 / 0.16)' },
    Low:    { color: 'oklch(0.75 0.12 160)', bg: 'oklch(0.75 0.12 160 / 0.16)' },
  };
  const STATUS_META = [
    { value: 'idea',    label: 'Booked',    color: 'oklch(0.6 0.02 280)',   progress: 8 },
    { value: 'planned', label: 'Shooting',  color: 'oklch(0.7 0.15 260)',   progress: 30 },
    { value: 'shot',    label: 'Editing',   color: 'oklch(0.75 0.15 200)',  progress: 60 },
    { value: 'edited',  label: 'Revision',  color: 'oklch(0.78 0.14 80)',   progress: 85 },
    { value: 'posted',  label: 'Completed', color: 'oklch(0.75 0.12 160)',  progress: 100 },
  ];
  const SCRIPT_STATUS_META = {
    'Not Started': { color: 'oklch(0.6 0.02 280)',  bg: 'oklch(0.6 0.02 280 / 0.14)' },
    'Drafting':    { color: 'oklch(0.75 0.15 240)', bg: 'oklch(0.75 0.15 240 / 0.16)' },
    'In Review':   { color: 'oklch(0.78 0.14 80)',  bg: 'oklch(0.78 0.14 80 / 0.16)' },
    'Approved':    { color: 'oklch(0.75 0.12 160)', bg: 'oklch(0.75 0.12 160 / 0.16)' },
    'Final':       { color: 'oklch(0.72 0.19 300)', bg: 'oklch(0.72 0.19 300 / 0.16)' },
  };
  const PACKAGE_TIERS = [
    { value: 'basic',    label: 'Package 1 - Basic (₱8,000)',     price: 8000 },
    { value: 'standard', label: 'Package 2 - Standard (₱10,000)', price: 10000 },
    { value: 'premium',  label: 'Package 3 - Premium (₱12,000)',  price: 12000 },
    { value: 'ultimate', label: 'Package 4 - Ultimate (₱18,000)', price: 18000 },
    { value: 'custom',   label: 'Custom Quote',                   price: null },
    { value: 'none',     label: 'No Package (Personal/Non-paid)', price: 0 },
  ];
  const SHOOT_TYPES = ['Real Estate', 'Vlog / Reel', 'Brand Deal', 'Personal Project', 'Other'];
  const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const LEAD_STATUSES = ['New Lead', 'Contacted', 'Proposal Sent', 'Booked', 'Client', 'Lost'];
  const LEAD_STATUS_META = {
    'New Lead':      { color: 'oklch(0.7 0.15 260)',  bg: 'oklch(0.7 0.15 260 / 0.16)' },
    'Contacted':     { color: 'oklch(0.78 0.14 80)',  bg: 'oklch(0.78 0.14 80 / 0.16)' },
    'Proposal Sent': { color: 'oklch(0.75 0.15 200)', bg: 'oklch(0.75 0.15 200 / 0.16)' },
    'Booked':        { color: 'oklch(0.72 0.19 300)', bg: 'oklch(0.72 0.19 300 / 0.16)' },
    'Client':        { color: 'oklch(0.75 0.12 160)', bg: 'oklch(0.75 0.12 160 / 0.16)' },
    'Lost':          { color: 'oklch(0.6 0.02 280)',  bg: 'oklch(0.6 0.02 280 / 0.16)' },
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
  function daysLeftOf(dstr) {
    if (!dstr) return null;
    const d = new Date(dstr + 'T00:00:00');
    return Math.round((d - TODAY) / 86400000);
  }
  function daysLeftLabelAndColor(days) {
    if (days === null) return { label: 'No date', color: 'oklch(0.5 0.02 280)' };
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: 'oklch(0.7 0.19 25)' };
    if (days === 0) return { label: 'Today', color: 'oklch(0.7 0.19 25)' };
    if (days <= 3) return { label: `${days}d left`, color: 'oklch(0.7 0.19 25)' };
    if (days <= 7) return { label: `${days}d left`, color: 'oklch(0.78 0.14 80)' };
    return { label: `${days}d left`, color: 'oklch(0.6 0.02 280)' };
  }
  function statusMeta(status) { return STATUS_META.find(s => s.value === status) || STATUS_META[0]; }
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
        bg: isSelected ? 'oklch(0.72 0.19 300 / 0.22)' : (isToday ? 'oklch(1 0 0 / 0.06)' : 'oklch(0.24 0.02 280)'),
        border: isSelected ? 'oklch(0.72 0.19 300 / 0.6)' : 'oklch(1 0 0 / 0.05)',
        textColor: isToday ? 'oklch(0.85 0.15 300)' : 'oklch(0.85 0.01 280)',
        dots: dayShoots.slice(0, 4).map(s => (PRIORITY_META[s.priority] || PRIORITY_META.Medium).color),
      });
    }
    return cells;
  }

  function monthlyTotals(items, dateKey, amountKey, monthsBack) {
    const months = [];
    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const total = items.filter(x => x[dateKey] && x[dateKey].slice(0, 7) === key).reduce((s, x) => s + (Number(x[amountKey]) || 0), 0);
      months.push({ key, label, total });
    }
    return months;
  }

  /* ---------------- access lock ---------------- */

  const LOCK_PASSWORD_HASH = 'd8b801bcbd0a8be19c2454a45d6600e22e02c81ef8a90e1046a66cd022b0631e';

  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
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
          ${showError ? `<div style="color:oklch(0.7 0.19 25);font-size:12.5px">Incorrect password. Please try again.</div>` : ''}
          <button type="submit" class="btn-primary" style="text-align:center">Unlock</button>
        </form>
      </div>`;
    const input = document.getElementById('lock-password');
    input.focus();
    document.getElementById('lock-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const hash = await sha256Hex(input.value);
      if (hash === LOCK_PASSWORD_HASH) {
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
      financeTab: 'sidehustle',
      ftDraft: { source: '', amount: '', date: TODAY_STR },
      modal: null,
      draft: null,
      shootsMode: 'board',
      calendarYear: TODAY.getFullYear(),
      calendarMonth: TODAY.getMonth(),
      selectedDate: TODAY_STR,
      telegramModalOpen: false,
      expenseDraft: { description: '', amount: '', date: TODAY_STR },
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

  const PERSIST_KEYS = ['shoots', 'expenses', 'loans', 'fullTimeIncome', 'goals', 'clients'];
  const PERSIST_COLUMNS = { shoots: 'shoots', expenses: 'expenses', loans: 'loans', fullTimeIncome: 'full_time_income', goals: 'goals', clients: 'clients' };

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

  function setState(patch) {
    const partial = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...partial };
    const changedKeys = PERSIST_KEYS.filter(k => k in partial);
    if (changedKeys.length) persist(changedKeys);
    render();
  }

  /* ---------------- derived data ---------------- */

  function decorate(sh) {
    const pm = PRIORITY_META[sh.priority] || PRIORITY_META.Medium;
    const sm = statusMeta(sh.status);
    const scm = SCRIPT_STATUS_META[sh.scriptStatus] || SCRIPT_STATUS_META['Not Started'];
    const days = daysLeftOf(sh.date);
    const dl = daysLeftLabelAndColor(days);
    const balance = (Number(sh.package) || 0) - (Number(sh.paid) || 0);
    return {
      ...sh,
      dateLabel: fmtDate(sh.date),
      timeLabel: fmtTime(sh.time),
      priorityColor: pm.color, priorityBg: pm.bg,
      scriptStatusLabel: sh.scriptStatus || 'Not Started',
      scriptStatusColor: scm.color, scriptStatusBg: scm.bg,
      showScriptBadge: (sh.shootType || 'Other') !== 'Vlog / Reel',
      packageTierLabel: (PACKAGE_TIERS.find(t => t.value === (sh.packageTier || 'custom')) || PACKAGE_TIERS[4]).label,
      shootType: sh.shootType || 'Other',
      statusLabel: sm.label,
      progressPercent: sm.progress,
      daysLeft: days,
      daysLeftLabel: dl.label, daysLeftColor: dl.color,
      packageLabel: fmtMoney(sh.package), paidLabel: fmtMoney(sh.paid),
      balanceLabel: balance > 0 ? fmtMoney(balance) : 'Paid up',
      balanceColor: balance > 0 ? 'oklch(0.7 0.18 40)' : 'oklch(0.75 0.15 160)',
    };
  }

  function buildCtx() {
    const view = state.view;
    const shoots = state.shoots.map(decorate);

    const navColor = (name) => view === name
      ? { color: 'oklch(0.95 0.01 280)', bg: 'oklch(0.72 0.19 300 / 0.15)' }
      : { color: 'oklch(0.65 0.02 280)', bg: 'transparent' };

    const goalCards = state.goals.map(g => ({
      ...g,
      percent: g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0,
      targetLabel: fmtMoney(g.target), currentLabel: fmtMoney(g.current),
    }));

    const thisMonth = shoots.filter(s => s.date && s.date.slice(0, 7) === THIS_MONTH_KEY);
    const completed = shoots.filter(s => s.status === 'posted');
    const openHigh = shoots.filter(s => s.priority === 'High' && s.status !== 'posted');
    const outstanding = shoots.reduce((sum, s) => sum + Math.max((Number(s.package) || 0) - (Number(s.paid) || 0), 0), 0);

    const upcomingList = shoots.filter(s => s.status !== 'posted' && s.daysLeft !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5);
    const highPriorityList = openHigh.slice().sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));

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
        statusColor: isPaid ? 'oklch(0.75 0.15 160)' : 'oklch(0.78 0.14 80)',
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
      analysisColor = 'oklch(0.7 0.18 40)';
    } else if (todayTotal > 0 && todayTotal < avgDaily * 0.7) {
      analysisText = `You're spending less today — only ${fmtMoney(todayTotal)} compared to your average of ${fmtMoney(Math.round(avgDaily))}/day.`;
      analysisColor = 'oklch(0.75 0.15 160)';
    } else {
      analysisText = `Your spending today is in the normal range (${fmtMoney(todayTotal)} vs ${fmtMoney(Math.round(avgDaily))}/day average).`;
      analysisColor = 'oklch(0.65 0.02 280)';
    }
    const decorateExpense = (e) => ({ ...e, dateLabel: fmtDate(e.date), amountLabel: fmtMoney(e.amount) });
    const recentExpenses = expenses.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map(decorateExpense);
    const allExpenseRows = expenses.slice().sort((a, b) => b.date.localeCompare(a.date)).map(decorateExpense);
    const filteredExpenseRows = allExpenseRows.filter(e => e.description.toLowerCase().includes(state.expensesSearch.toLowerCase()));
    const lastExp = expenses.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || { description: '—', amount: 0 };

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

    const monthlyFullTime = monthlyTotals(fullTimeIncome, 'date', 'amount', 6);
    const monthlySideHustle = monthlyTotals(shoots, 'date', 'paid', 6);
    const monthlyCombined = monthlyFullTime.map((m, i) => ({ key: m.key, label: m.label, total: m.total + monthlySideHustle[i].total }));

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

    const chipStats = [
      { key: 'thisMonth', label: 'Shoots this month', value: String(thisMonth.length), color: 'oklch(0.95 0.01 280)' },
      { key: 'completed', label: 'Completed', value: String(completed.length), color: 'oklch(0.75 0.15 160)' },
      { key: 'highPriority', label: 'High Priority Open', value: String(openHigh.length), color: 'oklch(0.7 0.19 25)' },
      { key: 'activeClients', label: 'Active Clients', value: String(activeClients), color: 'oklch(0.95 0.01 280)' },
    ];

    const chipModalKey = state.chipModal;
    const CHIP_MODAL_META = {
      thisMonth: { title: 'Shoots This Month', items: thisMonth.map(s => ({ primary: s.client, secondary: s.dateLabel })) },
      completed: { title: 'Completed Shoots', items: completed.map(s => ({ primary: s.client, secondary: s.dateLabel })) },
      highPriority: { title: 'High Priority Open', items: openHigh.map(s => ({ primary: s.client, secondary: s.daysLeftLabel })) },
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
      { icon: '📊', title: `${insightsPeriod === 'weekly' ? 'Weekly' : 'Monthly'} Report`, text: `${outstanding > 0 ? `You have ${fmtMoney(outstanding)} in outstanding balances across your shoots.` : 'No outstanding balance on any shoots — everything is paid up.'} ${openHigh.length > 0 ? `${openHigh.length} high-priority shoot(s) still need attention.` : 'No urgent high-priority shoots right now.'}` },
      { icon: '🎯', title: 'Goal Tracking', text: `Your savings goals are at an average of ${goalsAvgPercent}% completion. Yearly income progress: ${yearlyProgressPercent}% of the ${fmtMoney(yearlyGoalIncome)} target.` },
      { icon: '💡', title: 'Business Recommendations', text: activeClients < 3 ? 'You have relatively few active clients — try following up on leads marked "Contacted" or "Proposal Sent".' : `You have a solid client base (${activeClients} active). Keep following up on pending proposals to maintain momentum.` },
    ];
    const chartMax = Math.max(monthlyRevenue, monthTotal, 1);

    return {
      view, shoots, navColor, goalCards, thisMonth, completed, openHigh, outstanding,
      upcomingList, highPriorityList, columns, totalPackage, totalPaid, loanCards,
      todayTotal, monthTotal, analysisText, analysisColor, recentExpenses, allExpenseRows,
      filteredExpenseRows, lastExp, monthLabel, calendarCells, selectedDateShoots,
      totalFullTime, monthFullTime, fullTimeRows, combinedTotal, fullTimeSharePercent, sideHustleSharePercent,
      monthlyFullTime, monthlySideHustle, monthlyCombined,
      clientRows, activeClients, monthlyRevenue, netProfit, yearlyGoalIncome, yearlyProgressPercent,
      chipStats, chipModalKey, chipModalData, insightsPeriod, insightCards, chartMax,
    };
  }

  /* ---------------- small UI atoms ---------------- */

  function badge(label, color, bg) {
    return `<span class="badge" style="background:${bg};color:${color}">${esc(label)}</span>`;
  }
  function progressBar(percent, gradient) {
    const bg = gradient || 'linear-gradient(90deg, oklch(0.72 0.19 300), oklch(0.75 0.15 200))';
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
      <button type="button" class="nav-btn" style="margin-top:auto;color:oklch(0.7 0.19 25)" data-action="logout">
        <span class="ic">⏻</span>Log out
      </button>
    </aside>`;
  }

  /* ---------------- dashboard ---------------- */

  function viewDashboard(ctx) {
    return `
    <div class="page-head">
      <div>
        <div class="page-title sg">Dashboard</div>
        <div class="page-sub">Your production priorities at a glance</div>
      </div>
    </div>

    <div class="card" style="border-radius:18px;margin-bottom:16px;display:flex;align-items:center;gap:32px;flex-wrap:wrap">
      <div>
        <div style="color:oklch(0.6 0.02 280);font-size:12.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Net Profit This Month</div>
        <div class="sg" style="font-size:44px;font-weight:700;margin-top:6px;color:${ctx.netProfit >= 0 ? 'oklch(0.75 0.15 160)' : 'oklch(0.7 0.18 40)'}">${fmtMoney(ctx.netProfit)}</div>
      </div>
      <div style="display:flex;gap:28px;flex-wrap:wrap;margin-left:auto">
        <div><div style="color:oklch(0.55 0.02 280);font-size:11.5px;font-weight:600;text-transform:uppercase">Revenue</div><div class="sg" style="font-size:19px;font-weight:700;margin-top:3px">${fmtMoney(ctx.monthlyRevenue)}</div></div>
        <div><div style="color:oklch(0.55 0.02 280);font-size:11.5px;font-weight:600;text-transform:uppercase">Expenses</div><div class="sg" style="font-size:19px;font-weight:700;margin-top:3px">${fmtMoney(ctx.monthTotal)}</div></div>
        <div><div style="color:oklch(0.55 0.02 280);font-size:11.5px;font-weight:600;text-transform:uppercase">Pending</div><div class="sg" style="font-size:19px;font-weight:700;margin-top:3px;color:oklch(0.7 0.18 40)">${fmtMoney(ctx.outstanding)}</div></div>
      </div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px">
      ${ctx.chipStats.map(chip => `
        <button type="button" data-action="chip-open" data-key="${chip.key}" style="all:unset;cursor:pointer;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:9px 16px;display:flex;align-items:center;gap:8px">
          <span style="font-size:12.5px;color:oklch(0.6 0.02 280)">${esc(chip.label)}</span>
          <span class="sg" style="font-size:14.5px;font-weight:700;color:${chip.color}">${esc(chip.value)}</span>
        </button>`).join('')}
    </div>

    <div class="card" style="padding:18px 22px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <div class="sg" style="font-weight:700;font-size:13.5px">Yearly Progress</div>
        <div style="font-size:12px;color:oklch(0.6 0.02 280)">${fmtMoney(ctx.combinedTotal)} / ${fmtMoney(ctx.yearlyGoalIncome)}</div>
      </div>
      ${progressBar(ctx.yearlyProgressPercent)}
    </div>

    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:20px;align-items:start">
      <div class="card">
        <div class="card-title">High Priority</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${ctx.highPriorityList.map(s => `
            <div style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:var(--card2);border-radius:11px;cursor:pointer" data-action="shoot-edit" data-id="${esc(s.id)}">
              <div style="width:8px;height:8px;border-radius:50%;background:${s.priorityColor};flex:none"></div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.client)}</div>
                <div style="color:oklch(0.65 0.02 280);font-size:12.5px;margin-top:2px">${esc(s.location)} · ${esc(s.statusLabel)}</div>
              </div>
              <div style="font-size:12px;font-weight:700;color:${s.daysLeftColor};flex:none">${esc(s.daysLeftLabel)}</div>
            </div>`).join('')}
          ${ctx.highPriorityList.length === 0 ? `<div style="color:oklch(0.5 0.02 280);font-size:13.5px;padding:8px 4px">Nothing urgent right now.</div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Upcoming Deadlines</div>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${ctx.upcomingList.map(s => `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
                <div style="font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.client)}</div>
                <div style="font-size:11.5px;font-weight:700;color:${s.daysLeftColor};flex:none;margin-left:8px">${esc(s.daysLeftLabel)}</div>
              </div>
              ${progressBar(s.progressPercent)}
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <div class="card-title">Goals</div>
      <div style="display:flex;flex-direction:column;gap:9px">
        ${ctx.goalCards.map(g => `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${esc(g.name)}</span><span style="color:oklch(0.6 0.02 280)">${g.percent}%</span></div>
            ${progressBar(g.percent, 'oklch(0.75 0.15 200)')}
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
            ${progressBar(l.paidPercent, 'oklch(0.75 0.15 200)')}
            <div style="font-size:12px;color:oklch(0.6 0.02 280);margin-top:8px">${l.remainingLabel} left of ${l.amountLabel}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="card-title" style="margin-bottom:0">Daily Expenses</div>
        <button type="button" class="btn-telegram" data-action="telegram-open">✈ Log via Telegram</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:16px">
        <div><div style="color:oklch(0.6 0.02 280);font-size:12px;font-weight:600;text-transform:uppercase">Today</div><div class="sg" style="font-size:22px;font-weight:700;margin-top:4px">${fmtMoney(ctx.todayTotal)}</div></div>
        <div><div style="color:oklch(0.6 0.02 280);font-size:12px;font-weight:600;text-transform:uppercase">This Month</div><div class="sg" style="font-size:22px;font-weight:700;margin-top:4px">${fmtMoney(ctx.monthTotal)}</div></div>
      </div>
      <div style="background:oklch(0.16 0.02 280);border:1px solid oklch(1 0 0 / 0.06);border-radius:11px;padding:13px 15px;font-size:13px;color:${ctx.analysisColor};margin-bottom:14px;line-height:1.5">${esc(ctx.analysisText)}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${ctx.recentExpenses.map(ex => `
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;gap:10px">
            <span style="color:oklch(0.8 0.01 280);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ex.description)}</span>
            <span style="color:oklch(0.55 0.02 280);flex:none">${ex.dateLabel}</span>
            <span style="font-weight:600;flex:none;width:80px;text-align:right">${ex.amountLabel}</span>
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
        ${badge(s.priority, s.priorityColor, s.priorityBg)}
      </div>
      <div style="color:oklch(0.65 0.02 280);font-size:12.5px;margin-bottom:3px">${esc(s.location)} · ${esc(s.shootType)}</div>
      <div style="color:oklch(0.6 0.02 280);font-size:12px;margin-bottom:8px">${s.dateLabel} · ${s.timeLabel}</div>
      ${s.showScriptBadge ? `<div style="margin-bottom:10px">${badge('Script: ' + s.scriptStatusLabel, s.scriptStatusColor, s.scriptStatusBg)}</div>` : ''}
      ${progressBar(s.progressPercent, 'oklch(0.75 0.15 200)')}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <div style="font-size:11.5px;font-weight:700;color:${s.daysLeftColor}">${s.daysLeftLabel}</div>
        <div style="font-size:11.5px;color:oklch(0.6 0.02 280)">${s.balanceLabel}</div>
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
              <div style="color:oklch(0.55 0.02 280);font-size:12px;margin-left:auto">${col.shoots.length}</div>
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
            ${WEEKDAY_LABELS.map(wd => `<div style="text-align:center;font-size:11px;color:oklch(0.5 0.02 280);font-weight:700;padding-bottom:4px">${wd}</div>`).join('')}
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
                <div style="color:oklch(0.6 0.02 280);font-size:12px">${s.timeLabel} · ${esc(s.location)}</div>
              </div>`).join('')}
            ${ctx.selectedDateShoots.length === 0 ? `<div style="color:oklch(0.5 0.02 280);font-size:13px">No shoots this day.</div>` : ''}
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
          <button type="button" class="tab-btn" style="color:${state.shootsMode === 'board' ? 'oklch(0.95 0.01 280)' : 'oklch(0.6 0.02 280)'};background:${state.shootsMode === 'board' ? 'oklch(0.72 0.19 300 / 0.2)' : 'transparent'}" data-action="shoots-mode" data-mode="board">Board</button>
          <button type="button" class="tab-btn" style="color:${state.shootsMode === 'calendar' ? 'oklch(0.95 0.01 280)' : 'oklch(0.6 0.02 280)'};background:${state.shootsMode === 'calendar' ? 'oklch(0.72 0.19 300 / 0.2)' : 'transparent'}" data-action="shoots-mode" data-mode="calendar">Calendar</button>
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

  function monthlyBreakdownCard(title, months) {
    const max = Math.max(1, ...months.map(m => m.total));
    return `
      <div class="card" style="margin-top:20px">
        <div class="card-title">${esc(title)}</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${months.map(m => `
            <div>
              <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span style="color:oklch(0.7 0.02 280)">${esc(m.label)}</span><span style="font-weight:700">${fmtMoney(m.total)}</span></div>
              ${progressBar(Math.round((m.total / max) * 100))}
            </div>`).join('')}
        </div>
      </div>`;
  }

  function viewFinances(ctx) {
    const tab = (key, label) => `<button type="button" class="tab-btn" style="color:${state.financeTab === key ? 'oklch(0.95 0.01 280)' : 'oklch(0.6 0.02 280)'};background:${state.financeTab === key ? 'oklch(0.72 0.19 300 / 0.2)' : 'transparent'}" data-action="finance-tab" data-tab="${key}">${label}</button>`;

    const sideHustle = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:28px">
        <div class="card" style="padding:20px"><div style="color:oklch(0.65 0.02 280);font-size:12.5px;font-weight:600;text-transform:uppercase">Total Package Value</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px">${fmtMoney(ctx.totalPackage)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.65 0.02 280);font-size:12.5px;font-weight:600;text-transform:uppercase">Collected</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px;color:oklch(0.75 0.15 160)">${fmtMoney(ctx.totalPaid)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.65 0.02 280);font-size:12.5px;font-weight:600;text-transform:uppercase">Remaining Balance</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px;color:oklch(0.7 0.18 40)">${fmtMoney(ctx.outstanding)}</div></div>
      </div>
      <div class="table-wrap">
        <div class="t-head" style="grid-template-columns:1.6fr 1fr 1fr 1fr 1fr"><div>Client / Project</div><div>Status</div><div>Package</div><div>Paid</div><div>Remaining Balance</div></div>
        ${ctx.shoots.map(s => `
          <div class="t-row" style="grid-template-columns:1.6fr 1fr 1fr 1fr 1fr;cursor:pointer" data-action="shoot-edit" data-id="${esc(s.id)}">
            <div><div style="font-weight:600;font-size:14px">${esc(s.client)}</div><div style="color:oklch(0.6 0.02 280);font-size:12px;margin-top:2px">${esc(s.location)}</div></div>
            <div style="font-size:12.5px;color:oklch(0.75 0.02 280)">${s.statusLabel}</div>
            <div><div style="font-size:13.5px;font-weight:600">${s.packageLabel}</div><div style="color:oklch(0.55 0.02 280);font-size:11px;margin-top:2px">${s.packageTierLabel}</div></div>
            <div style="font-size:13.5px;color:oklch(0.75 0.15 160)">${s.paidLabel}</div>
            <div style="font-size:13.5px;font-weight:700;color:${s.balanceColor}">${s.balanceLabel}</div>
          </div>`).join('')}
      </div>
      ${monthlyBreakdownCard('Monthly Comparison (Side Hustle Collected)', ctx.monthlySideHustle)}`;

    const fullTime = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
        <div class="card" style="padding:20px"><div style="color:oklch(0.65 0.02 280);font-size:12.5px;font-weight:600;text-transform:uppercase">Total Full-Time Income</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px">${fmtMoney(ctx.totalFullTime)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.65 0.02 280);font-size:12.5px;font-weight:600;text-transform:uppercase">This Month</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px">${fmtMoney(ctx.monthFullTime)}</div></div>
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
        ${ctx.fullTimeRows.map(f => `
          <div class="t-row" style="grid-template-columns:2fr 1fr 1fr 32px">
            <div style="font-weight:600;font-size:14px">${esc(f.source)}</div>
            <div style="font-size:12.5px;color:oklch(0.65 0.02 280)">${f.dateLabel}</div>
            <div style="font-size:13.5px;font-weight:600;color:oklch(0.75 0.15 160)">${f.amountLabel}</div>
            <button type="button" style="all:unset;cursor:pointer;color:oklch(0.6 0.02 280);font-size:14px;text-align:right" data-action="fulltime-delete" data-id="${esc(f.id)}" title="Delete">✕</button>
          </div>`).join('')}
      </div>
      ${monthlyBreakdownCard('Monthly Comparison (Full-Time)', ctx.monthlyFullTime)}`;

    const combined = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
        <div class="card" style="padding:20px"><div style="color:oklch(0.65 0.02 280);font-size:12.5px;font-weight:600;text-transform:uppercase">Full-Time</div><div class="sg" style="font-size:24px;font-weight:700;margin-top:8px">${fmtMoney(ctx.totalFullTime)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.65 0.02 280);font-size:12.5px;font-weight:600;text-transform:uppercase">Side Hustle Collected</div><div class="sg" style="font-size:24px;font-weight:700;margin-top:8px">${fmtMoney(ctx.totalPaid)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.65 0.02 280);font-size:12.5px;font-weight:600;text-transform:uppercase">Combined Income</div><div class="sg" style="font-size:24px;font-weight:700;margin-top:8px;color:oklch(0.75 0.15 200)">${fmtMoney(ctx.combinedTotal)}</div></div>
        <div class="card" style="padding:20px"><div style="color:oklch(0.65 0.02 280);font-size:12.5px;font-weight:600;text-transform:uppercase">Remaining Balance</div><div class="sg" style="font-size:24px;font-weight:700;margin-top:8px;color:oklch(0.7 0.18 40)">${fmtMoney(ctx.outstanding)}</div></div>
      </div>
      <div class="card">
        <div class="card-title">Income Split</div>
        <div style="height:14px;border-radius:8px;overflow:hidden;display:flex;background:oklch(0.3 0.02 280)">
          <div style="width:${ctx.fullTimeSharePercent}%;background:oklch(0.75 0.15 200)"></div>
          <div style="width:${ctx.sideHustleSharePercent}%;background:oklch(0.72 0.19 300)"></div>
        </div>
        <div style="display:flex;gap:20px;margin-top:12px;font-size:12.5px">
          <div style="display:flex;align-items:center;gap:6px;color:oklch(0.7 0.02 280)"><span style="width:9px;height:9px;border-radius:50%;background:oklch(0.75 0.15 200)"></span>Full-Time (${ctx.fullTimeSharePercent}%)</div>
          <div style="display:flex;align-items:center;gap:6px;color:oklch(0.7 0.02 280)"><span style="width:9px;height:9px;border-radius:50%;background:oklch(0.72 0.19 300)"></span>Side Hustle (${ctx.sideHustleSharePercent}%)</div>
        </div>
      </div>
      ${monthlyBreakdownCard('Monthly Comparison (Combined)', ctx.monthlyCombined)}`;

    return `
    <div class="page-head"><div><div class="page-title sg">Finances</div><div class="page-sub">Package value vs. what's been collected</div></div></div>
    <div class="tabbar" style="margin-bottom:24px">
      ${tab('sidehustle', 'Side Hustle')}${tab('fulltime', 'Full-Time')}${tab('combined', 'Combined')}
    </div>
    ${state.financeTab === 'sidehustle' ? sideHustle : state.financeTab === 'fulltime' ? fullTime : combined}`;
  }

  /* ---------------- expenses ---------------- */

  function viewExpenses(ctx) {
    const searchClear = state.expensesSearch ? `<button type="button" class="search-clear" data-action="search-clear" data-field="expensesSearch">✕</button>` : '';
    return `
    <div class="page-head">
      <div><div class="page-title sg">Expenses</div><div class="page-sub">Everything you've spent, logged via Telegram or manually</div></div>
      <button type="button" class="btn-telegram" data-action="telegram-open">✈ Log via Telegram</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
      <div class="card" style="padding:20px"><div style="color:oklch(0.65 0.02 280);font-size:12.5px;font-weight:600;text-transform:uppercase">Today</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px">${fmtMoney(ctx.todayTotal)}</div></div>
      <div class="card" style="padding:20px"><div style="color:oklch(0.65 0.02 280);font-size:12.5px;font-weight:600;text-transform:uppercase">This Month</div><div class="sg" style="font-size:26px;font-weight:700;margin-top:8px">${fmtMoney(ctx.monthTotal)}</div></div>
    </div>
    <div style="background:oklch(0.16 0.02 280);border:1px solid oklch(1 0 0 / 0.06);border-radius:11px;padding:14px 16px;font-size:13.5px;color:${ctx.analysisColor};margin-bottom:20px;line-height:1.5">${esc(ctx.analysisText)}</div>
    <div class="search-wrap">
      <input type="text" value="${esc(state.expensesSearch)}" data-bind="expensesSearch" placeholder="Search expenses..."/>
      ${searchClear}
    </div>
    <div class="table-wrap">
      <div class="t-head" style="grid-template-columns:2fr 1fr 1fr 32px"><div>Description</div><div>Date</div><div>Amount</div><div></div></div>
      ${ctx.filteredExpenseRows.map(ex => `
        <div class="t-row" style="grid-template-columns:2fr 1fr 1fr 32px">
          <div style="font-weight:600;font-size:14px">${esc(ex.description)}</div>
          <div style="font-size:12.5px;color:oklch(0.65 0.02 280)">${ex.dateLabel}</div>
          <div style="font-size:13.5px;font-weight:600">${ex.amountLabel}</div>
          <button type="button" style="all:unset;cursor:pointer;color:oklch(0.6 0.02 280);font-size:14px;text-align:right" data-action="expense-delete" data-id="${esc(ex.id)}" title="Delete">✕</button>
        </div>`).join('')}
      ${ctx.filteredExpenseRows.length === 0 ? `<div style="padding:24px 20px;color:oklch(0.5 0.02 280);font-size:13.5px">No expenses match your search.</div>` : ''}
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
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
      ${filtered.map(l => `
        <div class="card" style="padding:20px;cursor:pointer" data-action="loan-edit" data-id="${esc(l.id)}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div><div style="font-weight:700;font-size:14.5px">${esc(l.lender)}</div><div style="color:oklch(0.6 0.02 280);font-size:12px;margin-top:2px">${esc(l.dueLabel)}</div></div>
            ${badge(l.statusLabel, l.statusColor, l.statusBg)}
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;color:oklch(0.65 0.02 280);margin-bottom:6px"><span>${l.remainingLabel} left</span><span>${l.amountLabel} total</span></div>
          ${progressBar(l.paidPercent)}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
            <div style="font-size:12.5px;color:oklch(0.6 0.02 280)">Monthly due: <span style="color:oklch(0.9 0.01 280);font-weight:600">${l.monthlyDueLabel}</span></div>
            ${l.showDueBadge ? `<div style="font-size:11px;font-weight:700;color:${l.dueBadgeColor}">${l.dueBadgeLabel}</div>` : ''}
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
            <div style="font-size:12.5px;color:oklch(0.75 0.02 280)">${esc(c.phone)}</div>
            <div style="font-size:11.5px;color:oklch(0.55 0.02 280);margin-top:1px">${esc(c.email)}</div>
          </div>
          <div style="cursor:pointer" data-action="client-edit" data-id="${esc(c.id)}">${badge(c.leadStatus, c.statusColor, c.statusBg)}</div>
          <div style="cursor:pointer" data-action="client-edit" data-id="${esc(c.id)}"><div style="font-size:12.5px;color:oklch(0.65 0.02 280)">${c.followUpLabel}</div></div>
          <button type="button" style="all:unset;cursor:pointer;font-size:11.5px;color:oklch(0.72 0.19 300);text-decoration:underline" data-action="client-view-shoots" data-id="${esc(c.id)}">${esc(c.shootCountLabel)}</button>
        </div>`).join('')}
      ${ctx.clientRows.length === 0 ? `<div style="padding:24px 20px;color:oklch(0.5 0.02 280);font-size:13.5px">No clients match your search.</div>` : ''}
    </div>`;
  }

  /* ---------------- documents ---------------- */

  function viewDocs(ctx) {
    const d = state.docDraft;
    const docType = state.docType;
    const meta = DOC_TYPE_META[docType];
    const isInvoice = docType === 'invoice';
    const paymentStatusColor = d.paymentStatus === 'Paid' ? 'oklch(0.4 0.12 160)' : d.paymentStatus === 'Partial' ? 'oklch(0.4 0.12 80)' : 'oklch(0.4 0.15 25)';
    const paymentStatusBg = d.paymentStatus === 'Paid' ? 'oklch(0.9 0.08 160)' : d.paymentStatus === 'Partial' ? 'oklch(0.9 0.08 80)' : 'oklch(0.9 0.08 25)';
    const tab = (key, label) => `<button type="button" class="tab-btn" style="color:${docType === key ? 'oklch(0.95 0.01 280)' : 'oklch(0.6 0.02 280)'};background:${docType === key ? 'oklch(0.72 0.19 300 / 0.2)' : 'transparent'}" data-action="doc-type" data-doctype="${key}">${label}</button>`;

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
        <div style="border-top:1px solid oklch(1 0 0 / 0.07);margin-top:4px;padding-top:14px;display:flex;flex-direction:column;gap:14px">
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
      <div id="doc-preview-panel" style="background:oklch(0.97 0 0);color:oklch(0.2 0.01 280);border-radius:16px;padding:32px;min-height:360px">
        <div class="sg" style="font-weight:700;font-size:20px;letter-spacing:-0.02em;margin-bottom:16px">pol.</div>
        <div class="sg" style="font-weight:700;font-size:18px;margin-bottom:4px">${meta.title}</div>
        <div style="font-size:12px;color:oklch(0.45 0.01 280);margin-bottom:20px">Pol Film Productions · ${esc(d.date)}</div>
        ${isInvoice ? `
          <div style="font-size:12.5px;color:oklch(0.5 0.01 280);margin-bottom:14px">Invoice #${esc(d.invoiceNumber)} · Due ${esc(d.dueDate)}</div>
          <div style="font-size:13px;color:oklch(0.35 0.01 280);margin-bottom:14px">${esc(d.clientContact)}</div>` : ''}
        <div style="font-size:13.5px;line-height:1.7">${esc(meta.body(d))}</div>
        ${isInvoice ? `
          <div style="margin-top:16px;font-size:13px;line-height:1.7;color:oklch(0.3 0.01 280)"><div style="font-weight:700;margin-bottom:4px">Breakdown</div><div>${esc(d.lineItems)}</div></div>
          <div style="margin-top:16px;font-size:13px;line-height:1.7"><div style="font-weight:700;margin-bottom:4px">Payment Details</div><div>${esc(d.paymentDetails)}</div></div>
          <div style="margin-top:12px;font-size:12.5px;font-weight:700;display:inline-block;padding:4px 10px;border-radius:6px;background:${paymentStatusBg};color:${paymentStatusColor}">${esc(d.paymentStatus)}</div>` : ''}
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid oklch(0.85 0 0);font-size:13px;color:oklch(0.4 0.01 280)">${esc(d.notes)}</div>
      </div>
    </div>`;
  }

  /* ---------------- insights ---------------- */

  function viewInsights(ctx) {
    const tab = (key, label) => `<button type="button" class="tab-btn" style="color:${ctx.insightsPeriod === key ? 'oklch(0.95 0.01 280)' : 'oklch(0.6 0.02 280)'};background:${ctx.insightsPeriod === key ? 'oklch(0.72 0.19 300 / 0.2)' : 'transparent'}" data-action="insights-period" data-period="${key}">${label}</button>`;
    return `
    <div class="page-head">
      <div><div class="page-title sg">Insights</div><div class="page-sub">AI-generated analysis of your business</div></div>
      <div class="tabbar">${tab('weekly', 'Weekly')}${tab('monthly', 'Monthly')}</div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:14px">Revenue vs Expenses</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span style="color:oklch(0.7 0.02 280)">Revenue</span><span style="font-weight:700">${fmtMoney(ctx.monthlyRevenue)}</span></div>
          <div style="height:10px;background:oklch(0.3 0.02 280);border-radius:5px;overflow:hidden"><div style="height:100%;width:${Math.round((ctx.monthlyRevenue / ctx.chartMax) * 100)}%;background:oklch(0.75 0.15 200);border-radius:5px"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span style="color:oklch(0.7 0.02 280)">Expenses</span><span style="font-weight:700">${fmtMoney(ctx.monthTotal)}</span></div>
          <div style="height:10px;background:oklch(0.3 0.02 280);border-radius:5px;overflow:hidden"><div style="height:100%;width:${Math.round((ctx.monthTotal / ctx.chartMax) * 100)}%;background:oklch(0.7 0.18 40);border-radius:5px"></div></div>
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      ${ctx.insightCards.map(ic => `
        <div class="card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="color:oklch(0.72 0.19 300)">${ic.icon}</span><div class="sg" style="font-weight:700;font-size:15px">${esc(ic.title)}</div></div>
          <div style="font-size:13.5px;line-height:1.6;color:oklch(0.8 0.01 280)">${esc(ic.text)}</div>
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
            <div style="font-weight:700;font-size:14.5px">${esc(g.name)}</div>
            <div style="font-size:12px;font-weight:700;color:oklch(0.75 0.15 200)">${g.percent}%</div>
          </div>
          ${progressBar(g.percent)}
          <div style="display:flex;justify-content:space-between;font-size:12.5px;color:oklch(0.65 0.02 280);margin-top:10px"><span>${g.currentLabel} saved</span><span>${g.targetLabel} goal</span></div>
        </div>`).join('')}
    </div>`;
  }

  /* ---------------- modals ---------------- */

  function modalShoot() {
    if (!state.modal) return '';
    const d = state.draft;
    const isEdit = state.modal.mode === 'edit';
    const isPaidType = d.shootType !== 'Vlog / Reel' && d.shootType !== 'Personal Project';
    const isScripted = d.shootType !== 'Vlog / Reel';
    const isCustomPackage = (d.packageTier || 'custom') === 'custom';
    return `
    <div class="modal-backdrop" data-action="modal-backdrop-close" data-which="shoot">
      <form class="modal-box" style="width:460px" data-stop data-action="save-shoot">
        <div class="modal-head"><div class="modal-title">${isEdit ? 'Edit Shoot' : 'New Shoot'}</div><button type="button" class="modal-close" data-action="modal-close" data-which="shoot">✕</button></div>
        <div class="modal-fields">
          <div class="field"><label>Client / Project</label><input type="text" list="clientNamesList" value="${esc(d.client)}" data-bind="draft.client" placeholder="e.g. Globe Telecom Anthem"/>
            <datalist id="clientNamesList">${state.clients.map(c => `<option value="${esc(c.name)}"></option>`).join('')}</datalist>
          </div>
          <div class="field"><label>Location / Venue</label><input type="text" value="${esc(d.location)}" data-bind="draft.location" placeholder="e.g. BGC Studio"/></div>
          <div class="row-2">
            <div class="field"><label>Date</label><input type="date" value="${esc(d.date)}" data-bind="draft.date"/></div>
            <div class="field"><label>Time</label><input type="time" value="${esc(d.time)}" data-bind="draft.time"/></div>
          </div>
          <div class="field"><label>Shoot Type</label>
            <select data-bind="draft.shootType" data-special="shootType">
              ${SHOOT_TYPES.map(t => `<option value="${t}" ${d.shootType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="row-2">
            <div class="field"><label>Priority</label>
              <select data-bind="draft.priority">${['High', 'Medium', 'Low'].map(v => `<option value="${v}" ${d.priority === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Status</label>
              <select data-bind="draft.status">${STATUS_META.map(sm => `<option value="${sm.value}" ${d.status === sm.value ? 'selected' : ''}>${sm.label}</option>`).join('')}</select>
            </div>
          </div>
          ${isPaidType ? `
          <div class="row-2">
            <div class="field"><label>Package</label>
              <select data-bind="draft.packageTier" data-special="packageTier">${PACKAGE_TIERS.map(t => `<option value="${t.value}" ${d.packageTier === t.value ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Paid so far (₱)</label><input type="text" inputmode="decimal" value="${esc(d.paid)}" data-bind="draft.paid" placeholder="0"/></div>
          </div>
          ${isCustomPackage ? `<div class="field"><label>Custom Package Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(d.package)}" data-bind="draft.package" placeholder="0"/></div>` : ''}
          ` : ''}
          ${isScripted ? `
          <div class="field"><label>Script Status</label>
            <select data-bind="draft.scriptStatus">${Object.keys(SCRIPT_STATUS_META).map(v => `<option value="${v}" ${d.scriptStatus === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
          </div>` : ''}
          <div class="field"><label>Notes / Deck / Script link</label><input type="text" value="${esc(d.notes)}" data-bind="draft.notes" placeholder="Optional link or note"/></div>
        </div>
        <div class="modal-actions">
          ${isEdit ? `<button type="button" class="btn-danger" data-action="shoot-delete">Delete</button>` : ''}
          <button type="submit" class="btn-primary" style="flex:1;text-align:center">${isEdit ? 'Save Changes' : 'Add Shoot'}</button>
        </div>
      </form>
    </div>`;
  }

  function modalTelegram(ctx) {
    if (!state.telegramModalOpen) return '';
    const d = state.expenseDraft;
    return `
    <div class="modal-backdrop chip" data-action="modal-backdrop-close" data-which="telegram">
      <div class="modal-box" style="width:420px" data-stop>
        <div class="modal-head"><div class="modal-title">Log via Telegram</div><button type="button" class="modal-close" data-action="modal-close" data-which="telegram">✕</button></div>
        <div style="background:oklch(0.14 0.03 235);border-radius:12px;padding:14px;margin-bottom:18px;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:flex-end"><div style="background:oklch(0.35 0.1 235);border-radius:12px 12px 2px 12px;padding:9px 13px;font-size:13px;color:oklch(0.95 0.01 235);display:flex;align-items:center;gap:8px">🎤 <span>0:14 voice note</span></div></div>
          <div style="display:flex;justify-content:flex-start"><div style="background:var(--card);border-radius:12px 12px 12px 2px;padding:9px 13px;font-size:13px;color:oklch(0.85 0.01 280);max-width:280px">Logged: "${esc(ctx.lastExp.description)}" — ${fmtMoney(ctx.lastExp.amount)}. ${esc(ctx.analysisText)}</div></div>
        </div>
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
    return `
    <div class="modal-backdrop chip" data-action="modal-backdrop-close" data-which="goal">
      <form class="modal-box" style="width:400px" data-stop data-action="save-goal">
        <div class="modal-head"><div class="modal-title">${isEdit ? 'Edit Goal' : 'Add Goal'}</div><button type="button" class="modal-close" data-action="modal-close" data-which="goal">✕</button></div>
        <div class="modal-fields">
          <div class="field"><label>Goal Name</label><input type="text" value="${esc(d.name)}" data-bind="goalDraft.name" placeholder="e.g. Car Fund"/></div>
          <div class="row-2">
            <div class="field"><label>Target Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(d.target)}" data-bind="goalDraft.target"/></div>
            <div class="field"><label>Current Amount (₱)</label><input type="text" inputmode="decimal" value="${esc(d.current)}" data-bind="goalDraft.current"/></div>
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
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid oklch(1 0 0 / 0.05)">
              <span style="font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.primary)}</span>
              <span style="font-size:12px;color:oklch(0.6 0.02 280);flex:none">${esc(it.secondary)}</span>
            </div>`).join('')}
          ${(!data || data.items.length === 0) ? `<div style="color:oklch(0.5 0.02 280);font-size:13px;padding:6px 4px">Nothing here yet.</div>` : ''}
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
      ${modalTelegram(ctx)}
      ${modalLoan()}
      ${modalGoal()}
      ${modalClient()}
    `;

    const app = document.getElementById('app');
    app.innerHTML = html;

    const mainEl = app.querySelector('.main');
    if (mainEl) mainEl.scrollTop = scrollTop;

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
    setState({ modal: { mode: 'add' }, draft: { id: null, client: '', location: '', date: TODAY_STR, time: '09:00', priority: 'Medium', status: 'idea', scriptStatus: 'Not Started', shootType: 'Vlog / Reel', notes: '', packageTier: 'none', package: '', paid: '' } });
  }
  function openEditShoot(id) {
    const sh = state.shoots.find(s => s.id === id);
    if (!sh) return;
    setState({ modal: { mode: 'edit', id }, draft: { packageTier: 'custom', shootType: 'Other', ...sh } });
  }
  function openEditLoan(id) {
    const l = state.loans.find(x => x.id === id);
    if (!l) return;
    setState({ loanModal: { mode: 'edit', id }, loanDraft: { ...l } });
  }
  function openEditGoal(id) {
    const g = state.goals.find(x => x.id === id);
    if (!g) return;
    setState({ goalModal: { mode: 'edit', id }, goalDraft: { ...g } });
  }
  function openEditClient(id) {
    const c = state.clients.find(x => x.id === id);
    if (!c) return;
    setState({ clientModal: { mode: 'edit', id }, clientDraft: { ...c } });
  }

  function handleAction(action, el, ev) {
    const id = el.dataset.id;
    switch (action) {
      case 'nav': setState({ view: el.dataset.view, mobileNavOpen: false }); break;
      case 'mobile-nav-toggle': setState(s => ({ mobileNavOpen: !s.mobileNavOpen })); break;
      case 'mobile-nav-close': setState({ mobileNavOpen: false }); break;
      case 'logout': renderLockScreen(false); break;
      case 'chip-open': setState({ chipModal: el.dataset.key }); break;
      case 'telegram-open': setState({ telegramModalOpen: true, expenseDraft: { description: '', amount: '', date: TODAY_STR } }); break;
      case 'search-clear': setState({ [el.dataset.field]: '' }); break;

      case 'shoot-add-open': openAddShoot(); break;
      case 'shoot-edit': openEditShoot(id); break;
      case 'shoot-delete': setState(s => ({ shoots: s.shoots.filter(sh => sh.id !== s.draft.id), modal: null, draft: null })); break;
      case 'shoots-mode': setState({ shootsMode: el.dataset.mode }); break;
      case 'cal-prev': setState(s => { let m = s.calendarMonth - 1, y = s.calendarYear; if (m < 0) { m = 11; y--; } return { calendarMonth: m, calendarYear: y }; }); break;
      case 'cal-next': setState(s => { let m = s.calendarMonth + 1, y = s.calendarYear; if (m > 11) { m = 0; y++; } return { calendarMonth: m, calendarYear: y }; }); break;
      case 'cal-select': setState({ selectedDate: el.dataset.date }); break;

      case 'finance-tab': setState({ financeTab: el.dataset.tab }); break;
      case 'fulltime-delete': setState(s => ({ fullTimeIncome: s.fullTimeIncome.filter(f => f.id !== id) })); break;
      case 'expense-delete': setState(s => ({ expenses: s.expenses.filter(e => e.id !== id) })); break;

      case 'loan-add-open': setState({ loanModal: { mode: 'add' }, loanDraft: { id: null, lender: '', amount: '', monthlyDue: '', remainingBalance: '', dueDate: '', status: 'ongoing' } }); break;
      case 'loan-edit': openEditLoan(id); break;
      case 'loan-delete':
        if (!confirm(`Are you sure you want to delete the loan "${state.loanDraft.lender || 'this loan'}"? This cannot be undone.`)) break;
        setState(s => ({ loans: s.loans.filter(l => l.id !== s.loanDraft.id), loanModal: null, loanDraft: null }));
        break;

      case 'goal-add-open': setState({ goalModal: { mode: 'add' }, goalDraft: { id: null, name: '', target: '', current: '' } }); break;
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
        closeModalOf(el.dataset.which);
        break;
      default: break;
    }
  }

  function closeModalOf(which) {
    if (which === 'shoot') setState({ modal: null, draft: null });
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
    if (special === 'shootType') {
      const nonPaid = value === 'Vlog / Reel' || value === 'Personal Project';
      state = setPath(state, 'draft.shootType', value);
      if (nonPaid) {
        state = setPath(state, 'draft.packageTier', 'none');
        state = setPath(state, 'draft.package', 0);
        state = setPath(state, 'draft.paid', 0);
      }
    } else if (special === 'packageTier') {
      const meta = PACKAGE_TIERS.find(t => t.value === value);
      state = setPath(state, 'draft.packageTier', value);
      if (meta && meta.price !== null) state = setPath(state, 'draft.package', meta.price);
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
        setState(s => ({ shoots: s.shoots.map(sh => sh.id === draggingId ? { ...sh, status } : sh) }));
        draggingId = null;
      }
    });

    app.addEventListener('input', (e) => {
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
      const special = el.dataset.special;
      if (special) { applySpecialSideEffect(special, el.value); render(); return; }
      const bind = el.dataset.bind;
      if (bind) { applyBind(bind, el.value); render(); }
    });

    app.addEventListener('submit', (e) => {
      const form = e.target.closest('form[data-action]');
      if (!form) return;
      e.preventDefault();
      const action = form.dataset.action;
      if (action === 'save-shoot') {
        const d = state.draft;
        const cleaned = { ...d, package: Number(d.package) || 0, paid: Number(d.paid) || 0 };
        setState(s => s.modal.mode === 'add'
          ? { shoots: [...s.shoots, { ...cleaned, id: 'sh' + Date.now() }], modal: null, draft: null }
          : { shoots: s.shoots.map(sh => sh.id === cleaned.id ? cleaned : sh), modal: null, draft: null });
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
        const cleaned = { ...d, target: Number(d.target) || 0, current: Number(d.current) || 0 };
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

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (state.modal) setState({ modal: null, draft: null });
        else if (state.telegramModalOpen) setState({ telegramModalOpen: false });
        else if (state.loanModal) setState({ loanModal: null, loanDraft: null });
        else if (state.goalModal) setState({ goalModal: null, goalDraft: null });
        else if (state.clientModal) setState({ clientModal: null, clientDraft: null });
        else if (state.chipModal) setState({ chipModal: null });
      }
    });
  }

  async function init() {
    wireListeners();
    const app = document.getElementById('app');
    app.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:14px">Loading your data…</div>`;

    try {
      const remote = await fetchRemoteState();
      if (remote) {
        // null/undefined = column never saved to yet (show empty); an actual [] means
        // someone intentionally emptied that list, which must be respected, not overwritten.
        PERSIST_KEYS.forEach(k => {
          const val = remote[PERSIST_COLUMNS[k]];
          if (val != null) state = { ...state, [k]: val };
        });
      }
    } catch (e) {
      console.error('Failed to load shared data, showing local defaults', e);
    }

    render();
  }

  document.addEventListener('DOMContentLoaded', () => renderLockScreen(false));
})();
