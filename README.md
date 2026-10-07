# MessMate · Smart Meal, Bazar & Household Expense Manager

A web + mobile app for bachelor messes, shared flats and family households. Each month is its own
workspace: members, meals, bazar (grocery) purchases, other expenses, deposits, settlements, reports
and a dashboard. The app calculates the meal rate and every member's due or refund, and shows the
breakdown behind every number.

```
frontend/   React + Vite + Tailwind CSS, Recharts, Capacitor (Android/iOS)
backend/    Node.js + Express REST API, MongoDB (Mongoose), JWT + bcrypt
```

## Quick start (local)

Requirements: Node.js 18+ and a MongoDB database (MongoDB Atlas free tier, or a local `mongod`).

```bash
# 1. API
cd backend
cp .env.example .env          # set MONGODB_URI and a long random JWT_SECRET
npm install
npm run dev                   # http://localhost:5000/api/health

# 2. Web app (second terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :5000)
```

Register an account, create your household and first month, add members, and start recording meals.

### Tests

```bash
cd backend
npm test
```

- `tests/calculation.test.js` covers the calculation engine (meal weights, guests, prorated and
  percentage/custom splits, refunds, cancelled items, carry-forward, rounding, budgets).
- `tests/api.test.js` runs the full API flow against an in-memory MongoDB (auth, invites, meals,
  bazar, permissions, soft delete/restore, close/reopen, next-month carry-forward, password reset).
  `mongodb-memory-server` downloads a MongoDB binary on first run; set `MONGOMS_SYSTEM_BINARY` to use
  an installed `mongod` instead.

## How the calculation works

Everything is configurable per month under **Settings → Meal rules / Calculation rules**; nothing is
hard-coded. The engine is one pure function: `backend/src/services/calculation.service.js`.

1. **Meals.** Each member/day stores a count per meal type. In *custom weight* mode each meal type has a
   weight (e.g. breakfast 0.5). Total meals = sum of weighted meals (+ guest meals when guests are
   charged to the host).
2. **Costs.** Every bazar item and expense belongs to a category, and each category has a type:
   food, household, utility or other. Cancelled records are ignored; refunds subtract.
3. **Distribution.** Each type (or a single category, via an override) is shared by one method:
   - *Per meal*: added to the meal-rate pool.
   - *Equal*: split among members present that month, optionally prorated by days present.
   - *Percentage*: by each member's percentage (scaled to 100% if needed).
   - *Custom*: fixed amounts per member; any difference is split equally (and flagged).
4. **Meal rate** = per-meal costs ÷ total meals (rounded per the rounding settings).
5. **Per member:** meal cost = meals × meal rate; plus shared costs → **total payable**.
   Credits = carried balance + deposits + purchases they paid personally + dues paid − refunds received.
   **Balance = credits − payable** → refund (positive), due (negative) or settled.
6. **Cash in hand** = starting balance + carried cash + deposits + dues collected − fund-paid costs −
   refunds paid out. Purchases a member pays from their own pocket credit that member instead.

Problems (e.g. food cost but no meals recorded, split amounts that don't add up) appear as
"calculation checks" on the dashboard and close-month screen instead of silently producing wrong numbers.

## Features

- Monthly workspaces with history; previous months are never modified when a new one is created.
  New months can copy members, settings and budget, and carry forward cash and member balances.
- Members with joining/leaving dates (partial months), active/inactive, roles (admin/member), and
  optional login linked by email (invites are resolved when that person registers).
- Fast meal entry: day grid with one-tap toggles, "all present / all absent", copy previous day,
  and a quick-add sheet (date → members → meal → Save). Guest meals with host charging.
- Bazar with multi-item trips, quantity × unit price, split purchases between several members,
  paid-from-fund vs. paid-personally, receipts, refunds. Shopping list with "convert to bazar".
- Expenses (household, utility, other), recurring bills with reminders next month.
- Deposits (cash, bKash, Nagad, bank…), settlements (dues collected, refunds paid).
- Dashboard, daily view, calendar, monthly sheet, meal summary, reports with PDF and CSV export.
- Budgets per type with configurable warning thresholds; notifications with per-user settings.
- Close month (locks editing, stores a frozen snapshot), admin reopen.
- Audit log of every create/edit/delete/close; soft delete with Trash → restore.
- Site owner page: every sign-up, last activity and household on the server (first account, or `OWNER_EMAILS`).
- Search, filters (date range, member, category, type, method, amount) and sorting with pagination.

## API

All routes are under `/api`. Authenticated routes need `Authorization: Bearer <token>`.

| Area | Routes |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`; `GET/PATCH /auth/me` |
| Households | `GET/POST /households`; `GET/PATCH /households/:id`; `/users` (access & invites); `/categories`; `/months` (list/create); `/history`; `/audit` |
| Month | `GET/PATCH /months/:id`; `/calculation`; `/dashboard`; `/daily/:date`; `/close-preview`; `POST /close`, `/reopen`; `/trash` |
| Members | `/months/:id/members` (+ `/:memberId`, `/:memberId/restore`) |
| Meals | `GET /months/:id/meals`; `GET/PUT /meals/day/:date`; `POST /meals/quick`; `POST /meals/copy`; `/guests` |
| Records | `/months/:id/bazar` (+ `/bulk`), `/expenses` (+ `/recurring`), `/contributions`, `/settlements`, `/shopping-list` (+ `/:itemId/convert`), `/meal-plans` |
| Reports | `GET /months/:id/reports`, `GET /months/:id/reports/export.csv?section=settlement|meals|bazar|expenses|contributions` |
| Notifications | `GET /months/:id/notifications`, `POST /months/:id/notifications/dismiss` |
| Site owner | `GET /owner/stats`, `/owner/users?q=&sort=newest|active&page=`, `/owner/households` |
| Uploads | `POST /uploads` (multipart `file`; JPG/PNG/WEBP/PDF) |

List endpoints accept `q`, `from`, `to`, `member`, `category`, `expenseType`, `paymentMethod`,
`minAmount`, `maxAmount`, `sort=newest|oldest|highest|lowest`, `page`, `limit`.

Backend layout: `src/models` (Mongoose schemas), `src/controllers`, `src/services`
(calculation, audit, notifications, month caching), `src/routes`, `src/middleware`
(auth, access/roles, validation with zod, sanitising, errors).

## Mobile app

- **Install from the website:** the site is a Progressive Web App. On Android (Chrome) tap
  **Install app** in the menu or ⋮ → *Install app*; on iPhone (Safari) tap Share → *Add to Home Screen*.
- **Android APK:** `.github/workflows/android.yml` builds the Capacitor app on every push that
  changes `frontend/` and publishes it at
  `https://github.com/Sokkho25/Meal-Management-System/releases/download/android-latest/MessMate.apk`
  (set a repository variable `API_URL` to point it at a different server).

### Building it yourself (Capacitor)

The same React build is packaged for Android and iOS and talks to the same API.

```bash
cd frontend
echo "VITE_API_URL=https://your-api.example.com" > .env.production   # public API URL
npm run build
npx cap add android          # once (requires Android Studio)
npx cap add ios              # once (requires macOS + Xcode)
npx cap sync
npx cap open android         # build/run from Android Studio
```

Add `capacitor://localhost,https://localhost` to the API's `CORS_ORIGINS`. App id and name are in
`frontend/capacitor.config.json`.

## Deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Sokkho25/meal-management-system)

**Step-by-step always-on hosting (Render + MongoDB Atlas): see [DEPLOY.md](DEPLOY.md).** The root
`render.yaml` deploys the API and web app as one service; the root `package.json` has the
`build`/`start` scripts it uses.

- **Database:** MongoDB Atlas. Create a database user with access to one database only, restrict
  network access to your API host, and turn on Atlas continuous backups (or scheduled snapshots).
- **API:** any Node host (Render, Railway, Fly.io, a VPS). Set the variables from
  `backend/.env.example`; `NODE_ENV=production` requires `JWT_SECRET`. With `NODE_ENV=production`
  the API also serves `frontend/dist` if it exists, so one service can host both.
- **Web:** or deploy `frontend/dist` to any static host (Netlify, Vercel, Cloudflare Pages) with
  `VITE_API_URL` set and a SPA fallback to `index.html`.
- **Uploads:** stored on local disk in `backend/uploads/` by default. On hosts with ephemeral disks,
  swap the storage in `backend/src/controllers/upload.controller.js` for S3/Cloudinary.
- **Password reset email:** `forgotPassword` in `backend/src/controllers/auth.controller.js` writes the
  reset link to the server log. Plug in an email provider there before going live.

## Data safety

- Financial records (bazar, expenses, deposits, settlements, guests, members) are soft-deleted and can
  be restored from Settings → Trash. Deleting asks for confirmation first.
- Closing a month stores a frozen copy of its calculation (`MonthlyReport`), and closed months reject
  edits until an admin reopens them.
- Every change is written to the audit log with before/after values.
- Backups: rely on Atlas backups, and/or run `mongodump --uri "$MONGODB_URI" --out backup-$(date +%F)`
  on a schedule and keep copies off the server.

## Security

bcrypt password hashing (cost 12), JWT auth with tokens invalidated after a password change,
role-based authorisation per household, zod validation on every input, operator-key sanitising,
Helmet headers, CORS allow-list, rate limiting (stricter on auth routes), upload type/size limits,
CSV formula-injection protection, and no secrets in the repository (`.env` is git-ignored).
