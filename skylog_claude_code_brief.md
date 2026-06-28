# SkyLog — Smart Skydive Logbook App
## Claude Code Build Brief

---

## Overview

Build a personal skydiving logbook web app called **SkyLog**. Single-user React app with a **Supabase** backend (Postgres + Auth) for cloud persistence, so data is safe across devices and if a phone is lost. Mobile-first (used at dropzones on a phone), dark-themed, Apple-inspired aesthetic.

All logbook and gear data is stored in Supabase. `localStorage` is used only for UI caching and offline buffering — when the app comes back online it syncs any buffered writes.

The app uses the **Anthropic Claude API** (`claude-sonnet-4-20250514`) in two places:
1. An in-app AI assistant chat bubble for natural language jump logging
2. An AI-powered legacy logbook import parser (Excel/CSV)

A **Google Drive backup** can be triggered from Settings — exports a full JSON snapshot to the user's connected Google Drive.

---

## Tech Stack

- **React** (with hooks)
- **Supabase** — Postgres database + Google OAuth authentication + real-time subscriptions
  - `@supabase/supabase-js` client library
  - User signs in with Google (one tap, no passwords)
  - All DB rows are scoped to `user_id` via Supabase Row Level Security (RLS)
- **localStorage** — offline write buffer + UI cache only
- **Web Speech API** — voice input to AI assistant
- **SheetJS (`xlsx`)** — reading uploaded Excel files for logbook import
- **Anthropic API** (`/v1/messages`) — called directly from the frontend
- **Google Drive API** — for manual backup export (user is already connected)
- **CSS variables** — dark theme throughout, SF Pro system font stack

---

## Supabase Setup Instructions (for Claude Code to scaffold)

1. Create a Supabase project at https://supabase.com (free tier)
2. Enable Google OAuth in Supabase Auth settings
3. Store credentials in `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
4. Run the SQL schema below to create all tables
5. Enable Row Level Security on all tables

### SQL Schema

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Jumps
create table jumps (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  date date not null,
  jump_number_start integer not null,
  jump_number_end integer not null,
  number_of_jumps integer not null default 1,
  location text,
  event_name text,
  jump_type text,
  notes text,
  per_jump_notes jsonb default '{}',
  gear_snapshot jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table jumps enable row level security;
create policy "Users own their jumps" on jumps
  for all using (auth.uid() = user_id);

-- Gear items (covers canopies, reserves, rigs, linesets, AADs)
create table gear_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  category text not null, -- 'main_canopy' | 'reserve' | 'rig' | 'lineset' | 'aad'
  is_active boolean default false,
  label text,
  data jsonb not null default '{}', -- all category-specific fields stored here
  purchase_date date,
  purchase_price numeric,
  purchase_condition text,
  currency text default 'EUR',
  lifespan_jumps integer,
  lifespan_years integer,
  retired_date date,
  retired_reason text,
  sale_price numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table gear_items enable row level security;
create policy "Users own their gear" on gear_items
  for all using (auth.uid() = user_id);

-- Templates (dropdown options)
create table templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  category text not null, -- 'location' | 'jump_type' | 'event_name'
  value text not null,
  created_at timestamptz default now()
);
alter table templates enable row level security;
create policy "Users own their templates" on templates
  for all using (auth.uid() = user_id);

-- Settings (one row per user)
create table settings (
  user_id uuid primary key references auth.users,
  starting_jump_number integer default 1,
  currency text default 'EUR',
  weight_unit text default 'kg',
  season_start_month integer default 1,
  reserve_repack_warning_days integer default 30,
  lineset_warning_jumps integer default 20,
  aad_service_warning_days integer default 60,
  aad_battery_warning_days integer default 60,
  updated_at timestamptz default now()
);
alter table settings enable row level security;
create policy "Users own their settings" on settings
  for all using (auth.uid() = user_id);

-- Gear swap log (tracks when active gear changes, for accurate per-item jump counts)
create table gear_swaps (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  category text not null,
  old_gear_id uuid,
  new_gear_id uuid,
  swapped_at timestamptz default now(),
  jump_number_at_swap integer
);
alter table gear_swaps enable row level security;
create policy "Users own their swap log" on gear_swaps
  for all using (auth.uid() = user_id);
```

---

## Authentication Flow

- App opens → check Supabase session
- If no session → show **Login screen**: single "Continue with Google" pill button, centered, clean
- Google OAuth redirects back → session established → app loads
- User avatar/name shown subtly in Settings page
- Sign out option in Settings

---

## Offline Handling

The app should work at a dropzone with poor connectivity:

1. On every write (log jumps, update gear), **try Supabase first**
2. If offline → save to `localStorage` buffer (`skylog_offline_queue`)
3. Show subtle "Offline — changes saved locally" indicator
4. On reconnect → flush queue to Supabase in order
5. On load → fetch latest from Supabase, merge with any local buffer

Keep it simple — last-write-wins is fine for a single-user app.

---

## App Structure

Bottom navigation bar with 4 tabs:

| Tab | Icon | Description |
|-----|------|-------------|
| **Log** | ✏️ | Home — today's jump entry form |
| **Logbook** | 📖 | Full history, stats, expandable rows |
| **Gear** | 🪂 | Equipment management + wingload calculator |
| **Settings** | ⚙️ | Alerts, templates, import, preferences, backup |

A **floating AI assistant button** (bottom right, above nav) is accessible from all pages.

---

## Data Models

### Jump Entry
```js
{
  id: uuid,
  user_id: uuid,
  date: "2026-06-07",
  jumpNumberStart: 1000,       // auto-calculated from DB
  jumpNumberEnd: 1003,
  numberOfJumps: 4,
  location: "Skytime DZ Castellon, Spain",
  eventName: "Paradise 2026",
  jumpType: "FF Coach",
  notes: "",
  perJumpNotes: {              // JSONB — optional per-jump notes within a batch
    1000: "2-way with Marco",
    1001: "",
    1002: "coached AFF student",
    1003: ""
  },
  gearSnapshot: {              // JSONB — gear active at time of logging
    mainCanopyId: uuid,
    mainCanopyLabel: "Pilot 188",
    linesetId: uuid,
    linesetLabel: "Lineset #2 - HMA"
  }
}
```

### Gear Item (all categories use the `gear_items` table, category-specific fields in `data` JSONB)

**Main Canopy `data` fields:**
```js
{ brand, model, size_sqft, serial }
```

**Reserve `data` fields:**
```js
{ brand, model, size_sqft, serial, manufacture_year,
  last_repack_date, repack_validity_months, repack_count, deployment_count }
```

**Rig / Container `data` fields:**
```js
{ brand, model, serial, manufacture_year }
```

**Lineset `data` fields:**
```js
{ line_type,         // "HMA" | "Vectran" | "Dacron" | "Spectra" | "Custom"
  installed_date, max_jumps, alert_threshold }
```

**AAD `data` fields:**
```js
{ brand,             // "Cypres" | "Vigil" | "MARS" | "Astra" | "Custom"
  model, serial, manufacture_date,
  last_service_date, service_interval_years,
  battery_replacement_date }
```

### Templates
```js
// Stored as individual rows in templates table
{ id, user_id, category: "location" | "jump_type" | "event_name", value }
```

### Settings
```js
{
  startingJumpNumber: 1,
  currency: "EUR",
  weightUnit: "kg",            // "kg" | "lbs"
  seasonStartMonth: 1,
  reserveRepackWarningDays: 30,
  linesetWarningJumps: 20,
  aadServiceWarningDays: 60,
  aadBatteryWarningDays: 60
}
```

---

## Page Specifications

---

### 1. Log Page (Home)

**Purpose:** Log jumps from today (or a past date).

**Layout — Primary Fields:**
- **Date** — date picker, defaults to today
- **Number of jumps** — number input (min 1)
- **Location** — searchable dropdown from templates + "Add new"
- **Event name** — searchable dropdown from templates + "Add new" (optional/clearable)
- **Jump type** — searchable dropdown from templates + "Add new"
- **Notes / Remarks** — textarea

**Layout — Secondary Fields (pre-filled from active gear):**
- **Main canopy** — shows active canopy label, tap to override for this entry
- **Lineset** — shows active lineset label, tap to override

**Jump number preview (read-only):**
*"These will be logged as jumps #1004 – #1007"* — calculated live from Supabase count + startingJumpNumber

**"Log Jumps" CTA** — prominent pill button, full width, gradient fill. On tap:
1. Validates required fields
2. Inserts row to Supabase (or queues offline)
3. Brief success animation
4. Resets number-of-jumps to 1, keeps other defaults

---

### 2. Logbook Page

**Top stats bar (horizontally scrollable cards):**
- Total jumps all time
- Jumps this season (since season start month)
- Jumps last 90 days
- Jumps on current canopy
- Jumps on current lineset

**Jump list — one row per batch:**

| # | Date | Location | Type | Count |
|---|------|----------|------|-------|
| 1000–1003 | Jun 7 | Castellon | FF Coach | 4 |

- Tap row → expands to sub-rows for each individual jump number
- Sub-rows: `#1000 · Freefly · [notes if any]`
- Individual jump notes editable by tapping a sub-row
- Filter/search bar: date range, jump type, location

**Pagination:** Load 50 rows at a time, infinite scroll fetching from Supabase.

---

### 3. Gear Page

**Layout:** Scrollable page with 5 gear category cards + wingload calculator at bottom.

Each card shows:
- Embossed icon tile (color-coded per category) + category name
- Active item label
- Key stat (jumps on canopy / days to repack / jumps on lineset / days to AAD service)
- Alert badge if warnings active
- **"Closet →"** chevron to open that category's closet sub-page

**Gear categories:**
1. 🔵 Main Canopy
2. 🟢 Lineset
3. 🟣 Reserve
4. 🟠 Rig / Container
5. 🔴 AAD

---

#### Gear Closet (sub-page per category)

List of all items in that category, each as a card:

```
[ACTIVE ✓]  Pilot 188 — PD
            312 jumps · Bought Apr 2022 · €1,200 → ~€743
            ████████░░░░  38% depreciated  |  ~688 jumps remaining

[ ]         Pilot 210 — PD
            44 jumps · Bought Jan 2021 · €900 → ~€510
            ████████████░  57% depreciated

[RETIRED]   Sabre2 170
            Sold Jun 2023 · Bought €1,100 → Sold €650
```

**Actions per item:**
- Tap → full detail/edit sheet slides up
- "Set as Active" on inactive items (confirm dialog + logs swap to `gear_swaps` table)
- "Retire" → retirement reason + optional sale price

**Financial summary at top:**
- Total spent: €X · Current fleet value: ~€X · Recovered (sold): €X

**"+ Add new"** button at bottom.

---

#### Depreciation Calculation

```
jumpWear = jumpsOnItem / lifespanJumps    (0 if no lifespan set)
ageWear  = yearsOld / lifespanYears       (0 if no lifespan set)
depreciationRate = max(jumpWear, ageWear)
currentValue = max(purchasePrice × (1 - depreciationRate), 0)
```

Default lifespans (editable per item):
- Main canopy: 1000 jumps / 20 years
- Reserve: no jump limit / 20 years
- Rig: 3000 jumps / 20 years
- AAD: no jump limit / 15 years
- Lineset: user-defined max / no year limit

**Jump count per item** is calculated from `jumps` table filtered by date ranges from `gear_swaps` log — not stored directly.

---

#### Wingload Calculator (bottom of Gear page)

- **Current canopy size** — auto-filled from active canopy (sqft), editable
- **Weight** — number input with kg/lbs toggle (1 kg = 2.205 lbs)
- **Result:** `X.XX lbs/sqft`
- Segmented color bar:
  - 🟢 < 1.0 · 🟡 1.0–1.3 · 🟠 1.3–1.6 · 🔴 > 1.6
- Option to override canopy size (for calculating for someone else)

---

### 4. Settings Page

#### Account
- Google profile name + avatar
- Sign out button

#### General Preferences
- Currency (EUR / USD / GBP / AUD)
- Weight unit (kg / lbs)
- Season start month
- Starting jump number (editable — baseline for number sequence)

#### Alert Thresholds
- Reserve repack warning: X days before expiry (default 30)
- Lineset warning: warn when X jumps remaining (default 20)
- AAD service warning: X days before due (default 60)
- AAD battery warning: X days before due (default 60)

#### Dropdown Template Manager
- Manage Locations, Jump Types, Event Names (add / rename / delete)

#### Import Previous Logbook
Full AI-powered import — see spec below.

#### Backup to Google Drive
- Button: "Export backup to Google Drive"
- Creates/overwrites `SkyLog_Backup_YYYY-MM-DD.json` in Google Drive root
- Shows last backup date
- Uses Google Drive MCP / API (user is already connected)

#### Export
- Export logbook as CSV (download)
- Export full data as JSON (download)

---

## AI Assistant (Floating Chat Bubble)

**UI:** Floating pill button (bottom right, above nav). Tap → slide-up chat panel.

**Voice input:** Microphone button → Web Speech API → text → Claude API.

**System prompt (injected fresh each session from Supabase data):**
```
You are SkyLog Assistant, embedded in a personal skydiving logbook app.
Help the user log jumps, query their stats, and manage gear.

Current context:
- Total jumps: {totalJumps}
- Current canopy: {activeCanopyLabel} ({activeCanopySize} sqft)
- Current lineset: {activeLinesetLabel} ({linesetJumps} jumps on it, max {linesetMax})
- Reserve repack expires: {repackExpiry}
- Default location: {mostRecentLocation}
- Default jump type: {mostRecentJumpType}
- Today's date: {today}
- Next jump number: {nextJumpNumber}

When logging jumps, extract: date, numberOfJumps, location, jumpType, eventName (optional), notes (optional).
Use most recent location and jump type as defaults if not specified.
Respond with a JSON block for logging actions:
{"action": "log_jumps", "data": { ...fields }}
For questions, answer naturally in 1-2 sentences.
For ambiguous requests, ask one clarifying question.
```

**Response handling:**
- Contains `{"action": "log_jumps", ...}` → pre-fill Log form, show confirmation card, one-tap confirm
- Otherwise → display as chat bubble

**Example interactions:**
- *"3 jumps today in Castellon, use defaults"*
- *"How many jumps on my Pilot?"*
- *"When does my reserve expire?"*
- *"What's my wingload if I downsize to a 150?"*
- *"Log 5 jumps, Paradise event, freefly coach, June 7th"*

---

## AI Import (Settings Page)

**Purpose:** Parse an existing logbook (Excel/CSV) into SkyLog format.

**UI flow:**
1. Upload `.xlsx`, `.xls`, or `.csv`
2. SheetJS parses file → raw rows as JSON
3. First 20 rows sent to Claude API:

```
You are parsing a skydiving logbook export spreadsheet.

Headers and first 20 rows:
{rawData}

Map columns to these fields:
- date (required)
- jumpNumber
- location / dropzone
- jumpType / discipline
- altitude
- notes / remarks

Return ONLY valid JSON:
{
  "mappings": {
    "date": "column name or null",
    "jumpNumber": "column name or null",
    "location": "column name or null",
    "jumpType": "column name or null",
    "altitude": "column name or null",
    "notes": "column name or null"
  },
  "totalRowsDetected": number,
  "confidence": "high|medium|low",
  "notes": "observations about the data"
}
```

4. Show **preview table** with mapped columns highlighted, user can correct mappings
5. Confirm → bulk insert to Supabase `jumps` table
6. Set `startingJumpNumber` = highest jump number found (or row count)
7. Success: *"Imported 847 jumps. Your next jump will be #848."*

---

## Alert / Notification System

Evaluated on app load from live Supabase data. Displayed as:
- Banner at top of relevant page
- Red badge on Gear tab nav icon
- Alerts summary card at top of Gear page

| Alert | Condition | Severity |
|-------|-----------|----------|
| Reserve repack expired | today > repackExpiry | 🔴 Critical |
| Reserve repack expiring soon | repackExpiry − today ≤ warningDays | 🟡 Warning |
| Lineset max jumps exceeded | linesetJumps > linesetMax | 🔴 Critical |
| Lineset approaching max | linesetMax − linesetJumps ≤ alertThreshold | 🟡 Warning |
| AAD service overdue | today > nextServiceDue | 🔴 Critical |
| AAD service due soon | nextServiceDue − today ≤ aadServiceWarningDays | 🟡 Warning |
| AAD battery due soon | batteryReplacement − today ≤ aadBatteryWarningDays | 🟡 Warning |
| Gear near end of life | depreciationRate > 0.85 | 🟡 Warning |

---

## Build Order

Build in this order — each step is independently testable:

1. **Supabase project setup** — create tables, RLS policies, enable Google OAuth
2. **Auth flow** — Google login screen, session management, protected routes
3. **Data layer** — Supabase client wrapper, CRUD helpers for all tables, offline queue
4. **Log page** — form, jump numbering (from DB count), gear snapshot on save
5. **Logbook page** — paginated list from Supabase, expandable rows, stats bar
6. **Gear page** — 5 category cards, wingload calculator
7. **Gear closets** — per-category sub-pages, active switching, depreciation, gear swap logging
8. **Alert system** — evaluation on load, display
9. **Settings page** — preferences, template manager, export, Google Drive backup
10. **AI Assistant** — Claude API, voice input, form pre-fill
11. **AI Import** — SheetJS + Claude API, preview, bulk Supabase insert
12. **Offline sync** — queue flush on reconnect
13. **Polish** — animations, transitions, edge cases

---

## Claude API Usage

```js
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: systemPrompt,
    messages: conversationHistory
  })
});
const data = await response.json();
const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
```

No API key passed from frontend — handled by environment.

---

## Design Direction

**Aesthetic:** Apple-inspired dark — visionOS / iOS 18 dark mode energy. Frosted glass, soft depth, premium feel. Clean and spacious, not cluttered. Feels like it belongs in the App Store next to Fantastical or Dark Sky.

**Theme:** Dark throughout.
- Background: `#0a0a0f` with subtle radial glow: `radial-gradient(ellipse at 50% 0%, #1a1a2e 0%, #0a0a0f 70%)`
- Cards: `rgba(255,255,255,0.07)` + `backdrop-filter: blur(24px)`
- Card borders: `1px solid rgba(255,255,255,0.10)`
- Card shadow: `box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)` — the inset gives the embossed glass edge
- Primary accent: `#007AFF`
- CTA gradient: `linear-gradient(135deg, #007AFF, #5AC8FA)` with glow: `box-shadow: 0 4px 20px rgba(0,122,255,0.4)`
- Success: `#30D158` · Warning: `#FF9F0A` · Danger: `#FF453A`
- Text primary: `#f5f5f7` · Text secondary: `#8e8e93`

**Typography:**
- `-apple-system, "SF Pro Display", "SF Pro Text", BlinkMacSystemFont, sans-serif`
- Large confident headings, tight letter-spacing
- Weight + size hierarchy only — no decorative elements

**Motion:**
- Page transitions: spring ease-out ~300ms
- Tap feedback: `transform: scale(0.97)`
- Stats cards: staggered fade-up on load
- Modals/sheets: slide up from bottom (iOS-style)
- Stats numbers: count-up animation on first render

**Components:**
- **Buttons:** Pill-shaped. Primary = gradient fill + blue glow. Secondary = frosted glass pill.
- **Inputs:** Rounded rect, `rgba(255,255,255,0.06)` fill, blue glowing ring on focus
- **Dropdowns:** iOS action sheets, slide up from bottom, dark frosted glass
- **Alerts:** Soft colored pills with color-matched glow — never harsh boxes
- **Progress bars:** Rounded, gradient-filled, softly glowing. Blue → amber → red as condition worsens.
- **Wingload bar:** Segmented, gradient-filled, iOS Health style
- **Icons:** Embossed — each gear category has a rounded-square icon tile with unique gradient tint and `inset` shadow. Blue (canopy), Green (lineset), Purple (reserve), Orange (rig), Red (AAD).

**Layout:**
- Mobile-first, 20–24px horizontal margins
- 44pt minimum tap targets (Apple HIG)
- Stats: horizontally scrollable frosted glass cards
- Bottom nav: frosted glass bar, floating above screen edge, rounded top corners
- Gear cards: full-width, 16px radius, glassy

---

## Notes for Claude Code

- Jump numbers are always recalculated from sorted DB data + `startingJumpNumber` — never trust a stored number blindly
- All tables have RLS — every query is automatically scoped to the logged-in user, no need to manually filter by user_id in queries
- When active gear changes, insert a row to `gear_swaps` with the jump number at time of swap — this enables accurate per-item jump count calculation
- Jumps on a gear item = count of jumps between its activation swap and its retirement swap (or now if still active)
- The Gear Closet component should be fully reusable — driven by a config object per category (tableName, fields, defaultLifespan, iconColor, etc.)
- Google Drive backup uses the user's existing Google OAuth token from Supabase — no separate auth needed
- App must be fully usable offline — the offline queue pattern is critical for DZ use
