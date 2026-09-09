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
10. [Troubleshooting](#10-troubleshooting)
11. [Notes on this build](#11-notes-on-this-build)

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

### What it creates

| Object | Purpose |
| --- | --- |
| `custom_roles` | Role definitions, pre-filled with Admin / Manager / Kitchen Staff |
| `profiles` | One row per auth user: email, full name, role |
| `categories` | Item groupings |
| `items` | The catalogue, including `current_stock`, `is_important`, `display_order` |
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
6. **New item** → name `Basmati Rice`, code `RICE-B`, size `5kg`, unit `kg`, category `Dry Goods`, tick **Important**, display order `1`, opening stock `50`.
7. Add 3–4 more items, some important, some not, with different display orders.
8. Try reusing a shortcut code → "That shortcut code is already used by another item."

**Dashboard** (`/dashboard`)

9. Important items appear in their own panel, **ordered by display order**.
10. Stock by category shows each group with counts and per-item stock.
11. Recent activity lists the opening balances as `INITIAL`.

**Inventory** (`/items/view`)

12. Sort by clicking any column header; click again to reverse.
13. Filter with the per-column boxes under the headers, and the search box.
14. Set a row's quantity box to `5` and press **+** → stock rises by 5 instantly.
15. Press **−** → stock falls by 5.
16. Debit more than you have → "Insufficient stock…" and nothing changes.
17. Click the **history icon** on a row → modal lists that item's movements.
18. Tick several rows → the bulk bar appears → **Bulk debit** `2` → all selected items drop by 2.
19. Bulk debit a quantity one item cannot cover → the whole batch is rejected, nothing changes.

**History** (`/history`)

20. Every action above is listed.
21. Filter by date range, item, user and action type; combine them.
22. Sort by any column. With more than 50 rows, page through with Previous/Next.

**Roles and permissions** (`/admin`)

23. Create a user with the **Kitchen Staff** role.
24. Sign out, sign in as them, and confirm:
    - No **Item Config** or **Admin** link in the header.
    - Visiting `/items/config` directly bounces to the dashboard with a permission notice.
    - Rows show a **−** button but **no +** button.
25. Sign back in as Admin and create a **Manager**; they get Item Config but not Admin.

### Build check

Before deploying, confirm a production build passes:

```bash
npm run build
npm run lint
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
components/                 Topbar, Modal, shared UI primitives
lib/
  supabase/client.js        Browser client
  supabase/server.js        Server-component client
  supabase/admin.js         Service-role client (server only)
  auth.js                   getCurrentUser / requireUser / requireRole
  requireAdmin.js           Bearer-token Admin guard for /api/admin/*
  constants.js              Units, action types, role helpers
middleware.js               Refreshes the session, redirects signed-out users
scripts/seed-admin.mjs      Creates the first Admin account
supabase/migrations/        SQL schema, RLS policies and RPCs
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

## 10. Troubleshooting

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
These endpoints require a signed-in Admin's access token. That is deliberate — see [Notes](#11-notes-on-this-build).

**Dashboard is empty after adding items**
Check you are signed in with a role. Signed-out and role-less accounts read nothing, by design.

**Build warning: `A Node.js API is used (process.version) … not supported in the Edge Runtime`**
Harmless. It comes from Supabase's browser bundle being reachable from middleware; that code path never executes there.

**`npm audit` reports postcss advisories**
They come from PostCSS bundled inside Next 15 and only affect build-time CSS processing, not the deployed app. Fixing them requires Next 16.

---

## 11. Notes on this build

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

### Possible next steps

- **Low-stock alerts** — add a `min_stock` column to `items` and flag anything below it on the dashboard. The schema has no threshold today, so "out of stock" means exactly zero.
- **Editing and deactivating staff accounts** — `/admin` creates users but cannot yet change a role or disable an account.
- **CSV export** of the history log.
