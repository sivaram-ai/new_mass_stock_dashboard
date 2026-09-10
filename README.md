# New Mass Stock Dashboard

Role-based inventory management built with Next.js 15 (App Router), React 19, Tailwind CSS v4 and Supabase.

Staff sign in with an email and password. What they can do is decided by the role attached to their profile:

| Role | Catalogue (items & categories) | Credit stock | Debit stock | Create roles & users |
| --- | --- | --- | --- | --- |
| **Admin** | ✅ | ✅ | ✅ | ✅ |
| **Manager** | ✅ | ✅ | ✅ | ❌ |
| **Kitchen Staff** | ❌ | ❌ | ✅ | ❌ |

Permissions are enforced in the database (Row Level Security + a `SECURITY DEFINER` function), not just in the UI — so they hold even if someone calls the API directly.

---

## Table of contents

1. [What you need first](#1-what-you-need-first)
2. [Local setup](#2-local-setup)
3. [Supabase setup](#3-supabase-setup)
4. [Seed the first Admin](#4-seed-the-first-admin)
5. [Run and test locally](#5-run-and-test-locally)
6. [Testing in Supabase](#6-testing-in-supabase)
7. [Deploy to Vercel](#7-deploy-to-vercel)
8. [Project structure](#8-project-structure)
9. [How stock changes work](#9-how-stock-changes-work)
10. [Feature reference](#10-feature-reference)
11. [API reference](#11-api-reference)
12. [Database migrations](#12-database-migrations)
13. [Automated tests](#13-automated-tests)
14. [Troubleshooting](#14-troubleshooting)
15. [Notes on this build](#15-notes-on-this-build)

---

## 1. What you need first

- **Node.js 20.9 or newer.** Next.js 15 will not run on Node 16 or 18.17.
- A Supabase project (this repo is wired to `xdecknnkjptlusqmbhsm`).
- Git, and a GitHub account if you want to push.

### Checking and switching Node on Windows

```bash
node -v
```

If that prints anything below `v20.9.0` and you use **nvm for Windows**:

```bash
nvm install 20.19.4
nvm use 20.19.4
```

> `nvm use` rewrites a symlink under `C:\Program Files\nodejs`, which needs administrator rights. If it prints "Now using node v20.19.4" but `node -v` still shows the old version, **run it again from a PowerShell window opened with "Run as administrator"**. That is the fix — it is not a broken install.

Verify it took effect:

```bash
node -v
```

---

## 2. Local setup

```bash
npm install
```

Create `.env.local` in the project root (it is git-ignored — never commit it):

```
NEXT_PUBLIC_SUPABASE_URL=https://xdecknnkjptlusqmbhsm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<secret key>

SEED_ADMIN_EMAIL=riyas@newmass.com
SEED_ADMIN_PASSWORD=riyas@7867916984
SEED_ADMIN_NAME=Riyas
```

`.env.example` in the repo lists the same keys with blank values, as a template.

Find the two key values in the Supabase dashboard under **Project Settings → API Keys**. The publishable key is shown openly; the secret key has to be revealed.

**Which key is which:**

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe in the browser. On its own it can read nothing — every table denies access to signed-out callers.
- `SUPABASE_SERVICE_ROLE_KEY` **bypasses all security rules**. It is only ever read on the server, in `/api/admin/*` and the seed script. Never rename it with a `NEXT_PUBLIC_` prefix.

---

## 3. Supabase setup

The database is empty until you run the migration. This is a one-time, copy-paste step.

1. Open the [Supabase dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **SQL Editor** → **New query**.
3. Open `supabase/migrations/0001_init.sql` from this repo, copy the whole file, paste it in.
4. Click **Run**.

You should see `Success. No rows returned`. The script is idempotent — running it twice is safe.

> **Already have a database from before low stock alerts?** `0001_init.sql` is safe to re-run and will add the new column, but the smaller `0002_add_alert_size.sql` is the intended upgrade path. See [Database migrations](#12-database-migrations).

### What it creates

| Object | Purpose |
| --- | --- |
| `custom_roles` | Role definitions, pre-filled with Admin / Manager / Kitchen Staff |
| `profiles` | One row per auth user: email, full name, role |
| `categories` | Item groupings |
| `items` | The catalogue, including `current_stock`, `alert_size`, `is_important`, `display_order` |
| `inventory_history` | Append-only audit log of every stock movement |
| `inventory_history_view` | The log joined to item, category and user names |
| `adjust_stock()` | The only sanctioned way to move stock |
| `adjust_stock_bulk()` | Applies one adjustment across many items atomically |
| RLS policies | Signed-in staff can read; writes are role-gated |

### Verify it worked

**Table Editor** should now list five tables. Or run this in the SQL Editor:

```sql
select role_name, description from custom_roles order by role_name;
```

Three rows means you are set.

### Optional: live stock updates

The inventory table refreshes by itself when someone else moves stock, if Realtime is on:

**Database → Replication → `supabase_realtime`** → enable the **`items`** table.

Skip this and everything still works — the table just refreshes after your own actions instead.

---

## 4. Seed the first Admin

Nobody can sign in yet, and account creation requires an Admin — so the first one is created by script.

```bash
npm run seed:admin
```

Expected output:

```
  Seeding Admin account for riyas@newmass.com…

  · Admin role found (…)
  · Auth user created (…)
  · Profile row linked to the Admin role

  ✓ Done. Sign in at http://localhost:3000/login
```

Credentials come from `.env.local`:

- **Email:** `riyas@newmass.com`
- **Password:** `riyas@7867916984`

The script is safe to re-run — it resets the password and repairs the profile row rather than failing.

> Supabase requires an email-format login, so the plain username `riyas` is not possible. Change `SEED_ADMIN_EMAIL` if you would rather use a different address.

---

## 5. Run and test locally

```bash
npm run dev
```

Open <http://localhost:3000>. You will be redirected to `/login`.

### Test checklist

Work through this in order — each step sets up the next.

**Sign in**
1. Sign in as `riyas@newmass.com`.
2. Confirm the **top-left corner shows `Riyas` and `Admin`** on every page.
3. Try a wrong password → "Wrong email or password."

**Item configuration** (`/items/config`)

4. Add categories, e.g. `Vegetables`, `Dry Goods`, `Dairy`.
5. Rename one with the pencil icon; delete one with the bin icon.
6. **New item** → name `Basmati Rice`, code `RICE-B`, size `5kg`, unit `kg`, category `Dry Goods`, tick **Important**, display order `1`, **alert size `20`**, opening stock `50`.
7. Add 3–4 more items, some important, some not, with different display orders.
8. Try reusing a shortcut code → "That shortcut code is already used by another item."

**Dashboard** (`/dashboard`)

9. Important items appear in their own panel, **ordered by display order**.
10. Stock by category shows each group with counts and per-item stock. **Every** item is listed — long categories scroll inside their own box, with no "+N more".
11. Items in each category are ordered **lowest stock first**.
12. Recent activity lists the opening balances as `INITIAL`.

**Inventory** (`/items/view`)

13. Sort by clicking any column header; click again to reverse.
14. Filter with the per-column boxes under the headers, and the search box.
15. Set a row's quantity box to `5` and press **+** → stock rises by 5 instantly.
16. Press **−** → stock falls by 5.
17. **A toast appears bottom-right** showing the item, Added/Removed, the quantity and the new total. **The table does not move.**
18. Click **−** five times fast → five toasts stack, none overwrite each other, rows stay put, and each clears itself after ~4 seconds.
19. Debit more than you have → a red toast reads "Insufficient stock…" and nothing changes.
20. Debit `Basmati Rice` below its alert size of 20 → **the row turns red immediately** and shows a `Low` badge. The alert size number itself is **not** shown on this page.
21. Click the **history icon** on a row → modal lists that item's movements.
22. Tick several rows → the bulk bar appears → **Bulk debit** `2` → all selected items drop by 2.
23. Bulk debit a quantity one item cannot cover → the whole batch is rejected, nothing changes.

**History** (`/history`)

24. Every action above is listed.
25. Filter by date range, item, user and action type; combine them.
26. Sort by any column. With more than 50 rows, page through with Previous/Next.

**Roles and permissions** (`/admin`)

27. Create a user with the **Kitchen Staff** role.
28. Sign out, sign in as them, and confirm:
    - No **Item Config** or **Admin** link in the header.
    - Visiting `/items/config` directly bounces to the dashboard with a permission notice.
    - Rows show a **−** button but **no +** button.
29. Sign back in as Admin and create a **Manager**; they get Item Config but not Admin.

**Editing staff accounts** (`/admin`)

30. Click the pencil on a staff row → the edit dialog opens with their current name and role.
31. Change the name and save → the list updates immediately.
32. Change their role to **Manager** and save → the badge updates; sign in as them to confirm the new access.
33. Set a new password, save, then sign in as that user with it.
34. Leave the password box blank and save → their existing password still works.
35. Try a password under 8 characters → rejected with a clear message.
36. Try changing **your own** role → refused: "You cannot change your own role."

### Build check

Before deploying, confirm the build, the linter and the tests all pass:

```bash
npm run build
```

```bash
npm run lint
```

```bash
npm test
```

---

## 6. Testing in Supabase

Useful checks straight against the database.

**Stock and history agree** — run in the SQL Editor:

```sql
select i.name,
       i.current_stock,
       sum(h.quantity_changed) as history_total
from items i
left join inventory_history h on h.item_id = i.id
group by i.id, i.name, i.current_stock
having i.current_stock is distinct from coalesce(sum(h.quantity_changed), 0);
```

Zero rows means every running total matches its audit trail. This should *always* be zero — if it is not, something wrote to `items` outside `adjust_stock()`.

**Recent movements:**

```sql
select created_at, item_name, action_type, quantity_changed, new_total, user_name
from inventory_history_view
order by created_at desc
limit 20;
```

**Confirm the anon key is locked down.** In a terminal:

```bash
curl "https://xdecknnkjptlusqmbhsm.supabase.co/rest/v1/items?select=*" -H "apikey: <your publishable key>"
```

An empty array `[]` is the correct answer — RLS denies signed-out readers. Anything else means RLS is off.

**Check role enforcement.** Auth → Users shows your accounts; Database → Roles/Policies shows the active policies. To prove Kitchen Staff cannot credit, sign in as one in the app and confirm the **+** button is absent — then, if you want to be thorough, call the RPC from the browser console on that session:

```js
// Expected: error "Kitchen Staff can only debit stock"
await window.supabase?.rpc('adjust_stock', { p_item_id: '<uuid>', p_action: 'CREDIT', p_quantity: 1 })
```

---

## 7. Deploy to Vercel

### Push to GitHub

```bash
git remote add origin https://github.com/sivaram-ai/new_mass_stock_dashboard.git
git branch -M main
git push -u origin main
```

### Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
2. Framework preset: **Next.js** (detected automatically). Leave build settings alone.
3. Before deploying, open **Environment Variables** and add all three, for **Production, Preview and Development**:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xdecknnkjptlusqmbhsm.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_…` |

   The `SEED_ADMIN_*` variables are **not** needed on Vercel — seeding is a local, one-time job.

4. Click **Deploy**.

> Vercel builds on Node 22 by default, which is fine. If you ever need to pin it: Project Settings → General → Node.js Version.

### After deploying

1. Open the deployment URL and sign in with the Admin account.
2. Add `https://<your-app>.vercel.app` to Supabase → **Authentication → URL Configuration → Redirect URLs**, and set **Site URL** to the same. (Password sign-in works without this; it matters for email links.)
3. Walk the [test checklist](#test-checklist) again against the live URL.

### Deploying updates

Every push to `main` redeploys automatically. Database changes are **not** included — run new SQL in the Supabase SQL Editor yourself.

**Order matters when a release adds a column.** Apply the migration *first*, then deploy:

1. Run the new script from `supabase/migrations/` in the SQL Editor (see [Database migrations](#12-database-migrations)).
2. Push to `main` / let Vercel deploy.

Doing it the other way round leaves the new build querying a column that does not exist yet, and the inventory pages fail to load until the migration lands. Because every migration here is additive and idempotent, the old build keeps working fine against the migrated database in the gap between steps 1 and 2.

No configuration or environment-variable changes are needed for the current release — the same three Supabase keys still cover everything.

---

## 8. Project structure

```
app/
  layout.js                 Root layout — renders the top bar with name + role
  page.js                   Redirects to /dashboard
  login/                    Email + password sign-in
  dashboard/                Important items, stock by category, recent activity
  items/config/             Category and item CRUD (Admin, Manager)
  items/view/               Sortable/filterable table, inline +/−, bulk, history
  history/                  Master audit log with filters, sorting, paging
  admin/                    Create roles and staff accounts (Admin only)
  api/admin/roles/          POST create role · GET list roles
  api/admin/users/          POST create user · GET list users
  api/admin/users/[id]/     PATCH update name, role or password
components/                 Topbar, Modal, Toast, shared UI primitives
lib/
  supabase/client.js        Browser client
  supabase/server.js        Server-component client
  supabase/admin.js         Service-role client (server only)
  auth.js                   getCurrentUser / requireUser / requireRole
  requireAdmin.js           Bearer-token Admin guard for /api/admin/*
  constants.js              Units, action types, role helpers
  stock.js                  Low-stock rule shared by every screen
  table.js                  Sort comparator shared by the tables
  validation.js             Payload rules shared by the admin routes
middleware.js               Refreshes the session, redirects signed-out users
scripts/seed-admin.mjs      Creates the first Admin account
supabase/migrations/        SQL schema, RLS policies, RPCs and upgrades
tests/                      Vitest unit tests (npm test)
```

---

## 9. How stock changes work

Every movement goes through one database function, `adjust_stock()`:

1. Checks you are signed in and reads your role.
2. Rejects the action if your role is not allowed (Kitchen Staff may only `DEBIT`).
3. Locks the item row, so two people adjusting at once cannot both read the same old total.
4. Rejects the change if it would push stock below zero.
5. Updates `items.current_stock` **and** inserts into `inventory_history` — in one transaction.

Because both writes share a transaction, the running total and the audit trail can never drift apart. Direct writes to `items` are blocked for anyone but Admin/Manager, and even they use this path from the UI.

`adjust_stock_bulk()` loops the same function inside a single transaction: if one item in a bulk debit lacks stock, the entire batch is rejected rather than half-applied.

---

## 10. Feature reference

### Low stock alerts (`alert_size`)

Every item carries an optional **Alert size** — the level at or below which it should be flagged as running low.

| `alert_size` | Behaviour |
| --- | --- |
| `NULL`, blank, or `0` | No alert. The item is never highlighted, however low it goes. |
| `> 0` | Highlighted whenever `current_stock <= alert_size`. |

The rule lives in one place, `lib/stock.js` (`isLowStock`), so every screen agrees.

**Maintaining it** — Item Config → **New item** / **Edit**. Set it to the level at which you would reorder: an item you reorder at 10kg gets `10`. Leave it blank for anything you do not want to track. Only Admin and Manager can change it, the same as any other item field.

**Where the highlight appears:**

| Screen | How low stock reads |
| --- | --- |
| Dashboard → Important items | Card tinted red, stock pill turns red |
| Dashboard → Stock by category | Row tinted red, count badge shows `N low` |
| Inventory (`/items/view`) | Row tinted red, `Low` badge next to the name |
| Item Config | Row tinted red, `Low` badge, plus the **Alert at** column |
| Dashboard stat tile | "Low / out of stock" counts both |

The **Alert size value itself is deliberately not shown on the Inventory page** — staff working stock only need the visual signal. It is visible and editable in Item Config, where admins maintain it.

Highlighting recalculates from the stock number in the page, so it updates the moment a credit or debit lands — no refresh needed.

> Out-of-stock (`0`) is always highlighted regardless of `alert_size`, since it needs attention whether or not a threshold was configured.

### Toast notifications

Crediting or debiting on the Inventory page raises a toast in the bottom-right rather than a banner in the page body.

The banner was the problem it fixes: it occupied layout space, so it pushed every inventory row down as it appeared and let them snap back as it cleared. During quick repeated clicks a row could move under the cursor between clicks and the wrong item got adjusted.

- The stack is `position: fixed`, so **rows never move**.
- Each click adds its own toast; they stack, newest on top, and never overwrite one another.
- Each shows the item name, whether stock was Added or Removed, the quantity, and the resulting total.
- Toasts clear themselves after 4 seconds, or on the × button.
- At most 5 are shown at once; older ones drop off so the stack cannot run off screen.
- Failures (for example "Insufficient stock") appear as red toasts, so an error during rapid clicking does not shift the table either.

Ids come from a counter rather than a timestamp — rapid clicks land inside the same millisecond, and duplicate React keys would make one toast visually replace another instead of stacking.

Implementation: `components/Toast.js` (`useToasts` hook + `ToastStack`).

### Stock by category

The dashboard panel lists **every** item in each category — there is no truncation and no "+N more".

- Each category list scrolls inside its own fixed-height box, so a category with 40 items does not stretch the page.
- Items are sorted **lowest stock first**, so whatever needs reordering is what you see without scrolling. Ties break by name.
- Low-stock rows are tinted, and the header badge counts them.

### Editing staff accounts

Admin → **Staff accounts** → pencil icon on any row.

Editable: **Full name**, **Role**, and **New password**. In this app the role *is* the access level and permission set — permissions are attached to roles, not to individuals — so changing the role is how you change what someone can do.

- Leaving the password box blank leaves the current password untouched. Filling it sets a new one (minimum 8 characters), hashed by Supabase Auth through the same path as sign-up.
- **Email cannot be changed** after creation; it is the account identity. Create a new account instead.
- **You cannot change your own role.** Otherwise the only Admin could demote themselves and lock everyone out of user management. Ask another Admin.
- Changes apply immediately: the staff list refreshes, and the affected user picks up the new role on their next request.

---

## 11. API reference

All `/api/admin/*` endpoints require `Authorization: Bearer <access_token>` for a signed-in **Admin**. Without it they return `401`; with a non-Admin token, `403`. They run with the service-role key, which bypasses RLS, so this check is the only thing between them and full account control.

```js
const { data: { session } } = await supabase.auth.getSession();
await fetch(url, { headers: { Authorization: 'Bearer ' + session.access_token } });
```

### `GET /api/admin/roles`

Lists roles. Any signed-in user (the create-user form needs it to populate its dropdown).

```json
{ "data": [{ "id": "uuid", "role_name": "Admin", "description": "...", "created_at": "..." }] }
```

### `POST /api/admin/roles`

```json
{ "roleName": "Store Keeper", "description": "Optional" }
```

`400` missing/oversized name · `409` name already exists · `200` `{ "success": true, "data": {...} }`

### `GET /api/admin/users`

Lists staff accounts with their roles. Admin only.

```json
{ "data": [{ "id": "uuid", "email": "...", "full_name": "...", "created_at": "...",
             "custom_roles": { "id": "uuid", "role_name": "Manager" } }] }
```

### `POST /api/admin/users`

```json
{ "email": "chef@newmass.com", "password": "at least 8 chars",
  "roleId": "uuid", "fullName": "Optional" }
```

`400` invalid payload or unknown role · `409` email already registered · `200` `{ "success": true, "userId": "uuid" }`

If the profile row cannot be written, the auth user just created is deleted again, so a half-provisioned account is never left behind.

### `PATCH /api/admin/users/:id` *(new)*

Updates an existing account. **Every field is optional** — only what you send changes — but at least one must be present.

```json
{ "fullName": "New Name", "roleId": "uuid", "password": "at least 8 chars" }
```

| Field | Notes |
| --- | --- |
| `fullName` | Blank string clears the name; the app then falls back to the email prefix. |
| `roleId` | Must be an existing role. This is the access level. |
| `password` | Omit or send `""` to leave it unchanged. |

`400` invalid id/payload/unknown role · `403` caller is not Admin · `404` user not found · `409` attempt to change your own role · `200` `{ "success": true, "userId": "uuid" }`

Profile fields are written before the password. If the password step then fails, the response says so explicitly — the reverse order could leave someone holding a new password nobody told them about.

### Changed payloads

`items` rows now carry **`alert_size`** (`integer`, nullable). It is written directly through the Supabase client from Item Config; no API route is involved. Existing clients that ignore the field keep working.

---

## 12. Database migrations

Migrations live in `supabase/migrations/` and are applied by pasting them into the Supabase **SQL Editor** (Dashboard → SQL Editor → New query → paste → **Run**). Every script is idempotent, so re-running one is safe.

| Script | Purpose |
| --- | --- |
| `0001_init.sql` | Full schema. Run this on a new project. Already includes `alert_size`. |
| `0002_add_alert_size.sql` | Adds `items.alert_size` to a database created before that column existed. |
| `0002_add_alert_size_rollback.sql` | Removes it again. |

### Upgrading an existing database

If your project was set up before low stock alerts, run **`0002_add_alert_size.sql`** once. Its core statement is:

```sql
alter table items add column if not exists alert_size integer default 0;
```

The full script also adds a `CHECK (alert_size is null or alert_size >= 0)` constraint and a partial index on rows where `alert_size > 0`.

It is `ALTER TABLE` only — nothing is dropped or recreated, no existing row is rewritten, and `DEFAULT 0` means every existing item starts with alerts off, so behaviour is unchanged until someone sets a threshold. Older application builds keep working against a migrated database.

**Deploy order is forgiving, but migrate first anyway.** If the app is deployed before the migration runs, it detects the missing column, retries the query without it and carries on with low stock alerts dormant — a banner reads "Low stock alerts are inactive until supabase/migrations/0002_add_alert_size.sql is run". Saving an item still works; only its alert threshold is dropped, and the save message says so.

Nothing is cached, so the moment the migration lands the app picks the column up with no restart or redeploy. The fallback costs one wasted round trip per page load while the database is behind, which is why migrating first is still the right order.

### Rolling back

```sql
-- optional: keep the thresholds first
create table if not exists items_alert_size_backup as
select id, alert_size from items where alert_size is not null and alert_size > 0;
```

Then run `0002_add_alert_size_rollback.sql`. Deploy the previous application build **before** rolling back, since the current build reads the column.

### Verify

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'items' and column_name = 'alert_size';
```

No data migration is required: `DEFAULT 0` backfills existing rows, and 0 means "no alert".

---

## 13. Automated tests

```bash
npm test
```

```bash
npm run test:watch
```

[Vitest](https://vitest.dev) covers the pure logic that the UI and the API routes both depend on:

| File | Covers |
| --- | --- |
| `tests/stock.test.js` | `isLowStock` (inclusive boundary, null/blank/0/negative thresholds, numeric strings, fractional stock, junk input), `parseAlertSize`, row-class precedence |
| `tests/validation.test.js` | User create/update and role create payload rules — required fields, email format, password floor, uuid checks, partial updates, blank-password-means-unchanged |
| `tests/table.test.js` | Sort comparator — numeric vs lexicographic, natural string order, empties last in both directions, zero treated as a value, direction cycling |

React components and end-to-end flows are not covered by automated tests; they are verified manually against the checklist in [Run and test locally](#5-run-and-test-locally).

---

## 14. Troubleshooting

**`Could not find the table 'public.items'`**
The migration has not been run. See [Supabase setup](#3-supabase-setup).

**`No 'Admin' role found in custom_roles`** when seeding
Same cause — run the migration first, then `npm run seed:admin`.

**`You are using Node.js 16.19.0. For Next.js, Node.js version >= v18.18.0 is required.`**
Switch Node versions. See [What you need first](#1-what-you-need-first).

**`nvm use` says it worked but `node -v` disagrees**
It needs administrator rights. Re-run it in an elevated PowerShell.

**Signed in but every page says "no role assigned"**
The auth user exists without a matching `profiles` row. Re-run `npm run seed:admin` for the Admin, or recreate the user from `/admin`.

**`Missing bearer token` from `/api/admin/*`**
These endpoints require a signed-in Admin's access token. That is deliberate — see [Notes](#15-notes-on-this-build).

**Banner: "Low stock alerts are inactive until … 0002_add_alert_size.sql is run"**
Exactly what it says — the app is working, but the low-stock column is missing. Apply `supabase/migrations/0002_add_alert_size.sql` in the SQL Editor and the banner disappears on the next page load. See [Database migrations](#12-database-migrations).

**`/api/admin/*` returns an HTML login page instead of JSON**
Fixed in this release: `middleware.js` used to redirect unauthenticated requests to `/login` for every path, including API routes, so a bearer-token caller got a `200` HTML page rather than the route's `401`. API routes are now exempt from the middleware redirect and answer with their own status codes.

**Dashboard is empty after adding items**
Check you are signed in with a role. Signed-out and role-less accounts read nothing, by design.

**Build warning: `A Node.js API is used (process.version) … not supported in the Edge Runtime`**
Harmless. It comes from Supabase's browser bundle being reachable from middleware; that code path never executes there.

**`npm audit` reports postcss advisories**
They come from PostCSS bundled inside Next 15 and only affect build-time CSS processing, not the deployed app. Fixing them requires Next 16.

---

## 15. Notes on this build

A few things differ from the original specification. Each was a deliberate call:

**The `/api/admin/*` routes require an Admin bearer token.**
As originally drafted they had no authentication at all — anyone who found the URL could create themselves an Admin account, because the service-role key bypasses every database rule. `lib/requireAdmin.js` now verifies the caller's token and role first. The frontend already holds a session, so this costs nothing to use.

**The migration does not drop the `profiles` table.**
`DROP TABLE IF EXISTS profiles` would delete every staff account on a re-run. `CREATE TABLE IF NOT EXISTS` is used instead, making the migration safe to replay.

**`profiles` has a `full_name` column.**
The spec asks the layout to show the user's *profile name*, which the original schema had nowhere to store. When it is empty, the app falls back to the part of the email before the `@`.

**Row Level Security is enabled on every table.**
Without it the publishable key alone would expose all inventory data to the internet. Signed-in staff can read; writes are gated by role.

**Auth uses `@supabase/ssr`, not `@supabase/auth-helpers-nextjs`.**
The auth-helpers package is deprecated and its server clients break on Next 15, where `cookies()` became async. `@supabase/ssr` is Supabase's supported replacement. `@supabase/auth-ui-react` was likewise dropped — it is deprecated, and the sign-in form is a plain form.

**Next.js 15 rather than 16.**
`create-next-app@latest` now installs Next 16, which renames `middleware.js` to `proxy.js` and carries other breaking changes. Next 15 was pinned for a longer-lived, better-documented base.

**"Access level" and "permissions" are the role.**
The edit-user dialog exposes Name, Role and Password. This app has no per-user permission grants: a role carries its permissions, and the RLS policies and `adjust_stock()` decide what each role may do. Changing someone's role is therefore how you change their access level and their permissions. Per-user overrides would need a new table and a rewrite of the policy functions, which is a much larger change than this one.

**`alert_size` is the column name, not `alertSize`.**
The database uses snake_case throughout (`display_order`, `is_important`, `shortcut_code`), so the new column follows suit. The admin API payloads stay camelCase, matching the existing `roleId` / `fullName` convention.

### Possible next steps

- **Deactivating staff accounts** — `/admin` can now create and edit users, but not suspend or delete one.
- **Per-item reorder quantities** — `alert_size` says *when* to reorder; it does not say how much.
- **CSV export** of the history log.
- **Automated component and end-to-end tests** — the unit tests cover the shared logic; the UI is still verified by hand.
