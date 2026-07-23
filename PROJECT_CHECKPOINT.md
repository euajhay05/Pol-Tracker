# ShootTracker — Project Checkpoint

_Last updated: 2026-07-23 — "Simplified Preview" redesign complete, pending final push._

## What this app is

Personal production/finance tracker for Pol Film Productions (real estate videography + general video production side hustle). Two people share it and need to see the same live data. Standalone vanilla HTML/CSS/JS, no build step — `index.html` + `app.js`.

## Live deployment

- **URL**: https://euajhay05.github.io/Pol-Tracker/
- **Password**: `0302Jpvn24!` (client-side SHA-256 check, no real backend auth). 5-minute grace period before re-asking on refresh; "Log out" button in sidebar forces it immediately.
- **Source repo**: github.com/euajhay05/Pol-Tracker (public, GitHub Pages "Deploy from a branch" / main / root)
- **Push mechanism**: plain `git push` from this machine — GitHub credentials are cached in macOS `osxkeychain`, so it doesn't prompt.
- **Cache-busting rule**: every time `app.js` changes, bump the version query string in `index.html`'s `<script src="app.js?v=N">` in the same commit before pushing, or GitHub Pages'/mobile browsers' caching can serve stale code. Currently at **v=24**.

## Data storage (critical — do not break this)

- Supabase project "Pol Tracker" at `https://lufmszmhflmecvpislwy.supabase.co`, publishable key embedded in `app.js` (`SUPABASE_KEY`) — safe to be public, it's the new "publishable key" naming for the old anon key.
- Table `tracker_state`, single row `id=1`, **one jsonb column per entity type** (not one shared blob — deliberately split after a real data-loss incident where a shared-blob design let concurrent writes wipe unrelated data): `shoots`, `expenses`, `loans`, `full_time_income`, `goals`, `clients`, `package_rates`.
- Columns are nullable with no default: `null` = "never saved yet, show empty"; an actual `[]` = "user emptied it on purpose" — both render as empty, but only `[]` should be treated as "confirmed no data", not overwritten by defaults.
- `persist()` in `app.js` only PATCHes the specific column(s) that actually changed in a given `setState()` call — never resends the whole state. This isolation is what prevents concurrent edits by the two users from clobbering unrelated data.
- **Real data as of this checkpoint**: 10 real shoots, 0 loans, 0 clients, expenses/full_time_income/goals/package_rates all still null. Verified via direct Supabase query that nothing was lost during this session's extensive UI testing.

## Redesign status: COMPLETE (tasks 5–12, all verified)

The app was fully rebuilt to match the user's new claude.ai/design file **"ShootTracker Simplified Preview.dc.html"** (design project id `4cea5169-df43-4dd7-a930-6e817d61a887`), replacing the old dark-theme UI. All real Supabase data was retained and migrated forward via JS-side normalization (no destructive SQL).

| # | Task | Status |
|---|------|--------|
| 5 | Swap theme to light palette (`index.html`) | ✅ Done |
| 6 | Update constants/data model (`app.js`) | ✅ Done |
| 7 | Rebuild Dashboard view | ✅ Done |
| 8 | Rebuild Shoots page + modal (Real Estate/General Project split, package tiers, add-ons, payment terms) | ✅ Done |
| 9 | Date-range picker on Finances/Income page | ✅ Done |
| 10 | "Shoots: This Month vs Last Month" card on Insights | ✅ Done |
| 11 | Restyle Expenses/Loans/Clients/Documents/Goals + Goal PHP/USD toggle | ✅ Done |
| 12 | Full regression test + deploy | ✅ Verified locally, **push still pending** |

### Key decisions honored throughout

1. **Strict design fidelity** — anything visible in the old app not present in the new design was removed (Priority field, Deadline/Booked-Date fields, the old "Daily Expenses" dashboard card, Net Profit prev/next-month arrows, Finances page's old "Monthly Comparison" trend cards, Expenses page's "Today" stat card + analysis banner).
2. **Native `<input type=date/time>` and `<select>`**, not custom popover widgets, per the user's deferral to Claude's judgment (simpler, more robust on mobile).
3. Underlying data for removed fields (priority, deadline, bookedDate on old shoot records) was left untouched, just no longer read/rendered.

### Data model / migration notes

- `STATUS_META`: 6 stages (Tentative, Booked, Resched, Editing, Revision, Completed).
- `SHOOT_TYPES`: `['Real Estate', 'General Project']` only.
- `SCRIPT_STATUS_META`: Not Started / Drafting / In Review / Final.
- `PACKAGE_TIERS` + `getLiveTiers(state.packageRates)` for live-editable pricing (basic/standard/premium/ultimate), persisted via the `package_rates` Supabase column and editable from the Documents page's "Package Rates" section.
- `ADDON_DEFS` (Walkthrough Video, Raw Footage+Color Grading, AI Scene) wired into the Shoot modal's Add-ons stepper; addon totals are folded into the shoot's saved `package` amount so kanban/Finance balances stay accurate.
- Migration shims (`normalizeShootStatus`, `normalizeScriptStatus`, `normalizeShootType`) run both at Supabase-load time and defensively in `decorate()`, so old stored values (`'reschedule'`, `'Approved'`, `'Other'`, etc.) keep displaying correctly under the new vocabulary without any SQL migration.
- Goals gained a `currency: 'PHP'|'USD'` field with a toggle in the Goal modal; target/current are always persisted in PHP, converted for display/editing when USD is selected.
- Finances page date-range figures (`rangeShoots`, `rangeSideHustleCollected`, `rangeTotalFullTime`, etc.) are separate from the all-time totals used elsewhere (Dashboard's Yearly Progress, "Total Package Value", "Remaining Balance") — don't conflate the two when touching this code.

### Loose ends found and fixed along the way (not originally scoped, caught during verification)

- A handful of leftover dark-theme color literals that the original bulk find/replace missed (calendar "today"/"selected" cell colors using hue-300 purple, `.btn-telegram` and `.btn-danger` CSS classes in `index.html`, the Documents preview panel's text colors, a border on the Documents invoice divider) — all corrected to match the reference design's actual light-theme values.
- Dashboard's hero grid (`Net Profit` + `Shoots This Week`) didn't collapse to one column on mobile — added `.dash-hero-grid` override in the `@media (max-width: 860px)` block.

### Next steps

1. Commit and push (`app.js`, `index.html`, this checkpoint file).
2. Wait for GitHub Pages to rebuild, then verify the live URL matches local (compare `app.js` content/hash).
3. Tell the user the redesign is live.
