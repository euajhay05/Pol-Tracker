# Pol Tracker — Project Memory

_This is the single source of truth going forward. Older discussions/checkpoints (e.g. `PROJECT_CHECKPOINT.md`) are historical only — refer to them just if explicitly asked about past iterations._

## What this app is

Personal production/finance tracker for Pol Film Productions (real estate videography + general video production side hustle). Vanilla HTML/CSS/JS, no build step — `index.html` + `app.js`. Two people share it against one live Supabase-backed dataset.

## Live deployment

- **URL**: https://euajhay05.github.io/Pol-Tracker/
- **Source repo**: github.com/euajhay05/Pol-Tracker (public, GitHub Pages "Deploy from a branch" / main / root)
- **Password**: client-side SHA-256 check on load (no real backend auth); 5-minute grace period on refresh; "Log out" in sidebar forces re-entry.

## Standing workflow (always follow this)

1. Claude edits `app.js` / `index.html` directly in the mounted `Pol-Tracker` folder.
2. Run `node --check app.js` after every edit, before anything else.
3. Bump the cache-busting version in `index.html`'s `<script src="app.js?v=N">` in the **same** change — every single `app.js` edit requires this, or GitHub Pages/mobile browsers can serve stale code.
4. Claude never runs `git add`/`commit`/`push` itself. It hands the user a numbered, copy-paste command sequence, one command at a time when asked "isa isa":
   ```
   cd ~/Desktop/Pol-Tracker
   rm -f .git/index.lock
   git add -A
   git commit -m "..."
   git push
   ```
   `rm -f .git/index.lock` is always included first (recurring stale-lock issue on this machine).
5. Claude can verify local git state via read-only `git status --short` / `git log --oneline`, but cannot verify the live GitHub Pages site reliably — its own `web_fetch`/`raw.githubusercontent.com` calls have been observed serving stale/cached content. If a fix "isn't showing," ask the user to hard-refresh (Cmd+Shift+R) or test in an Incognito window before assuming the push failed. Reading live Supabase data directly (via `apikey` as a URL query param on the REST endpoint) is a reliable way to check what's actually saved, when needed.
6. Current cache version: **v=111** (bump on next edit).

## Working style / communication preferences

- User (Pol) communicates in Taglish, values concise answers.
- Established loop: when asked "may pa bang need i-improve," Claude proactively reviews the app, reports ONE concrete finding at a time, and only implements after explicit approval (e.g. "sige," "go push").
- For open-ended feature requests ("baka pwede..."), Claude clarifies scope via multiple-choice options before building, rather than guessing.
- Every shipped change gets a cache bump + numbered push commands, given one at a time if the user says "isa isa."

## Data storage (critical — do not break this)

- Supabase project at `https://lufmszmhflmecvpislwy.supabase.co`, publishable key embedded in `app.js` (safe to be public).
- Table `tracker_state`, single row `id=1`, **one jsonb column per entity type** (deliberately split, not a shared blob, after a past data-loss incident from concurrent-write clobbering): `shoots`, `expenses`, `loans`, `full_time_income`, `goals`, `clients`, `package_rates`, `documents`.
- `persist(changedKeys)` in `app.js` only PATCHes the columns that actually changed in a given `setState()` call — never resends the whole state. This isolation is what protects the two users from clobbering each other's unrelated edits.
- `null` in a column = never saved yet; `[]` = user emptied it on purpose — both render empty but only `[]` counts as "confirmed no data."

## Current feature set by page

**Dashboard** — month-switchable hero card (income/expenses/net profit/pending), "Shoots This Week" bar chart, clickable stat cards (Shoots This Month, Completed, Active Clients) opening a detail chip-modal, Yearly Progress bar, "Who's Up Next" list, Goals + Loans summary cards.

**Shoots** — Kanban board (Tentative→Booked→Resched→Editing→Revision→Completed) and calendar view. Shoot modal: Real Estate (package tiers Basic/Standard/Premium/Ultimate/Custom Quote, with add-ons: Raw Footage, Walkthrough Video, AI Scene) vs General Project (flat Project Amount). Deadline field (optional, drives "overdue" instead of shoot date when set). Spreadsheet-style inline autocomplete on Client/Project field.

**Finances** — Side Hustle / Full-Time / Combined tabs, month picker, detailed transaction list on Combined tab properly labeled by source.

**Expenses** — Month picker + always-visible calendar (click a date to see that day's actual expense line items in a side panel, not just a total) + collapsible "Full list" (search/table, collapsed by default to reduce clutter) + **Monthly Report**: a 12-month bar chart (with year nav) at the bottom of the page, clickable bars to jump the whole page to that month. **Export** button (top, next to "+ Add Expense") downloads a CSV of every actual expense for the selected year, grouped by month with per-month subtotals and a year total — not just monthly totals — since the user needs the itemized list for outside analysis.

**Loans** — Recurring "Due Day of Month" (not a one-time date) with automatic next-occurrence calculation across month-length differences, plus an estimated "~N months left to pay off." Log Payment modal now keeps a **Payment History** list (date + amount per entry) with a delete option (removing an entry adds its amount back to the remaining balance, and reverts "Paid Off" status if balance becomes positive again).

**Goals** — PHP/USD toggle. Add/Withdraw Fund modal now keeps a **Contribution History** list (date + amount + deposit/withdraw) with a delete option that reverses its effect on the saved total.

**Clients** — Follow-up Date column is highlighted (red, bold, ⚠) when overdue, but only for leads still "in play" (New Lead / Contacted / Proposal Sent) — Booked/Client/Lost are excluded since they have a final outcome.

**Documents** — Contract / Quotation / Invoice tabs. The Invoice type is now branded **"Statement of Account"** (was "Billing Invoice"), with a **"Reference Number"** field (was "Invoice Number") auto-suggested with an **`SOA-YYYY-NNN`** prefix (was `INV-`; existing old documents keep their original `INV-` numbers, not renamed retroactively). Issue Date / Due Date now always show the year (e.g. "Jul 27, 2026") in both the on-screen preview and the generated PDF. Document history list has delete confirmation.

**Insights** — Overview earnings-by-month bar chart (year nav, click a bar to filter "Revenue vs Expenses" below it to that month), Outstanding Balances (clickable), Goal Tracking (progress bars), Top Clients, Biggest Expenses. Data Export button lives here too for the full multi-entity backup (separate 6-file CSV export: Shoots/Expenses/Income/Clients/Loans/Goals — distinct from the Expenses page's year-itemized export).

**App-wide** — Delete confirmations on every delete action. Required-field validation + explicit alert (not silent-fail) on every data-entry form. `fmtMoney()` shows consistent decimals (0 or 2, never 1). Sidebar: icon-only collapsed rail (Gmail-style) on desktop via the in-sidebar hamburger toggle; full drawer on mobile.

## Known architecture gotchas (read before touching these areas)

- **Money inputs** (`data-fmt="money"`): sanitized (commas stripped) on every keystroke via the `input` listener. The `change` listener's generic fallback **must skip any element with `data-fmt` set** — re-applying the raw (comma-formatted) `el.value` on blur/change was a real, shipped bug that silently corrupted values like "11,000" into `NaN → 0` right before save. Do not remove that guard.
- **Custom package amount vs. add-ons** (Shoots, Real Estate + Custom tier): `sh.package` in storage is always the **grand total** (base + add-ons already summed). When re-opening a shoot for edit, `openEditShoot` must subtract the current add-ons total back out before pre-filling the "Custom Package Amount" field, or re-saving double-counts the add-ons every time.
- **`packageTier` fallback**: treat a falsy/missing `packageTier` as `'custom'` consistently everywhere it's checked (preview calc, save calc, display), not just in one place — inconsistent fallbacks caused custom amounts to silently zero out.
- `buildCalendarCells(year, month, shoots, selectedDate, disableFuture)` — the 5th param is opt-in; only the Full-Time Income date picker passes `true`. Shoots/Documents calendars must keep allowing future dates (shoots are legitimately scheduled ahead).
- `MONTH_SHORT_LABELS` and `WEEKDAY_LABELS` are top-level constants (near the top of `app.js`) — reusable by any month/day-based UI without redeclaration issues.
