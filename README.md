# Aurevia Invest

Aurevia Invest is a Next.js 14 application using TypeScript, PostgreSQL, Prisma, NextAuth, Socket.IO, Zustand, Tailwind CSS, Recharts and Lightweight Charts. Trading and market prices used by the trading engine remain internal simulations; the `/markets` dashboard separately displays live-provider quotes and history. This repository does not connect to a live broker, exchange, bank, or payment network.

## What is implemented

### User application
- Landing page, registration and credential login
- JWT sessions with USER/ADMIN role enforcement
- KYC submission and review status
- Profile and account settings
- 2FA security flag
- Live dashboard with cash equity and open positions
- Realtime market ticker
- Trading terminal with Market, Limit and Stop orders
- Simulated order book and realtime candles/price chart
- Open-order cancellation
- One-click position close
- Unrealized P&L display
- Wallet balance from the ledger
- Deposit and withdrawal requests
- Funding history

### Administration
- Role-protected admin area
- User list and freeze/unfreeze
- Role changes
- KYC approval/rejection
- Deposit/withdrawal approval queue
- Force-close open positions
- Instrument enable/disable and configuration API
- System settings
- Audit log
- Realtime operational statistics

### Financial engine
- PostgreSQL persistence
- Prisma transactions
- Double-entry ledger
- Ledger balance derived from entries
- Serializable transactions for financial mutations
- Atomic funding approval
- Atomic trade reservation
- Margin release and realized P&L settlement
- Trading fees
- Insufficient-funds protection
- No direct mutable customer cash balance

### Market engine
- Internal simulated instruments
- Random-walk price engine
- One-minute candles
- Automatic Limit/Stop order processing
- Socket.io market:update events
- Socket.io trade:update events
- REST market, candle and order-book endpoints

### Live market dashboard

The `/markets` page uses Yahoo Finance's unofficial chart endpoint through same-origin Next.js API routes. It requires no API key or new environment variable. Quotes refresh every five seconds for the selected asset; watchlist quotes refresh every 30 seconds, and server-side in-process caching reduces duplicate provider requests. Historical OHLCV data supports the displayed ranges and is cached for up to one minute. Yahoo Finance is not an official API and can delay, limit, or discontinue access; provider errors are shown in the dashboard rather than replaced with simulated prices. The ticker and chart are informational and are not connected to trade execution.

## Important scope boundary

The platform's funding and market environment is intentionally internal simulation. `BANK_SIM`, `CRYPTO_SIM`, and `INTERNAL_TRANSFER` are not bank, card, blockchain, custody, or exchange integrations. Connecting real customer money or external execution requires regulated providers, KYC/AML/sanctions controls, reconciliation, custody, licensing, security review and jurisdiction-specific compliance.

The 2FA control currently stores the account-security flag. A real deployment must connect a TOTP/WebAuthn challenge and recovery process before treating it as actual multi-factor authentication.

## Requirements

- Node.js 20+
- Docker Desktop or PostgreSQL 15+
- npm

## Environment

Copy `.env.example` to `.env`.

Set the values shown in `.env.example` in your ignored `.env` file. `DATABASE_URL` is the application connection (use the Supabase pooler URL when appropriate); Prisma uses `DIRECT_URL` for migrations and introspection. Both point to the existing Supabase Postgres database. The application does not use a Supabase client or service-role key; database access stays on the server through Prisma.

`NEXT_PUBLIC_SUPABASE_URL` identifies the configured Supabase project and is not a database credential. The application does not send it to a browser-side Supabase client. Never add a Supabase service-role/secret key to a `NEXT_PUBLIC_` variable.

`ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` are used by the existing admin login and seed. Use a unique password of at least 12 characters. The seed updates the configured admin account, adopts an existing admin rather than creating another, and provisions an admin only when none exists.

Registration can complete without a verification challenge when no delivery provider is configured. For email verification, configure `VERIFICATION_EMAIL_API_URL` and `VERIFICATION_EMAIL_API_KEY`. If `PHONE_VERIFICATION_REQUIRED=true`, configure `VERIFICATION_SMS_API_URL` and `VERIFICATION_SMS_API_KEY`; registration then requires a phone number. Keep provider credentials server-only. `NEXT_PUBLIC_APP_URL`, `PORT`, and `MARKET_TICK_MS` are optional and have runtime defaults.

For production, set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to the canonical HTTPS domain configured for that deployment. Production startup rejects a missing `NEXTAUTH_SECRET` or `NEXTAUTH_URL`; it never trusts an arbitrary Host header to establish the auth origin. Configure `SUPPORT_EMAIL` and `COMPLAINTS_EMAIL` separately from `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. When SMTP is missing, password recovery is unavailable and support/funding actions report that no email was sent; in-app tickets and notifications remain recorded.

Private receipt, support attachment, and profile avatar uploads require a private Supabase Storage bucket named by `SUPABASE_PRIVATE_BUCKET` (default `aurevia-private`), `SUPABASE_URL` (or the existing project URL), and server-only `SUPABASE_SERVICE_ROLE_KEY`. Never use a public bucket or expose that key to a browser. Upload APIs validate file signatures and size, store opaque keys in Postgres, and return only short-lived signed URLs after owner/admin checks. Apply Storage policies appropriate to the trusted server service-role model and keep the bucket private.

Password recovery tokens are random, single-use, expire after 30 minutes, and are stored only as SHA-256 hashes. Resetting a password revokes the active account session. Successful and failed credential attempts are written to the existing admin-only audit log with a validated IP when available, bounded user-agent text, and a hashed identifier for unknown accounts; no password or raw token is stored.

For a real deployment, use a unique high-entropy `NEXTAUTH_SECRET`, a strong administrator password, and managed secret storage.

## Local setup

```bash
npm install
cp .env.example .env
# For the local Postgres container, set DATABASE_URL and DIRECT_URL to its connection URL.
docker compose up -d postgres
npx prisma generate
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run build
npm run dev
```

Open `http://localhost:3000`.

The application server owns the HTTP server and Socket.io endpoint, so use `npm run dev` rather than `next dev` when realtime functionality is required.

## Administrator provisioning

```text
Username: configured with ADMIN_USERNAME
Email: configured with ADMIN_EMAIL
Password: configured with ADMIN_PASSWORD
```

Set `ADMIN_USERNAME`, `ADMIN_EMAIL`, and a unique, strong `ADMIN_PASSWORD` in an ignored `.env` file or managed secret store, then run `npm run db:seed`. No administrator password is included in the repository. The seed refuses to run without these values.

## Docker

```bash
docker compose up --build
```

The included compose file starts PostgreSQL and the app. It requires the database, NextAuth, and administrator values from `.env`; it contains no default credentials.

## Test workflow

### 1. Health

Open:

```text
GET /api/health
```

Expected response includes `ok: true` and `database: "ok"`.

### 2. Admin login

Open `/login` and use the configured administrator credentials. `/admin` must be accessible only to an ADMIN JWT.

### 3. User registration

Create a normal account from `/register`, sign in, and confirm `/dashboard`, `/trade`, `/wallet`, `/kyc` and `/settings` are protected routes.

### 4. KYC

Submit the KYC form. Admin can approve or reject the account from `/admin`.

### 5. Funding

Create a deposit request in `/wallet`. Admin approves it. The customer's USD ledger balance increases through a double-entry transaction.

Create a withdrawal request. Approval checks available ledger balance inside a serializable database transaction before posting the debit.

### 6. Trading

After funding a user account:

1. Open `/trade`.
2. Select an instrument.
3. Place a Market order.
4. Confirm an execution and position appear.
5. Watch the price update through Socket.io.
6. Confirm unrealized P&L changes.
7. Close the position.
8. Confirm margin plus realized P&L is returned to the user ledger.

For Limit and Stop orders, place an order outside the current trigger price, then wait for the market simulator to reach its trigger. The server processes eligible open orders on market ticks.

### 7. Ledger invariant

Every posted monetary transaction contains exactly one debit and one credit for the same amount. The test suite also covers positive monetary quantities.

### 8. Admin controls

From `/admin`, test:

- Freeze/unfreeze a user
- Approve/reject KYC
- Change USER/ADMIN role
- Approve/reject funding
- Force-close positions
- Enable/disable instruments

Client stories are private drafts until an administrator links and verifies the client, records a completed REAL withdrawal with its settlement reference, records publication consent, and approves the story. The repository does not include the supplied story photos or a configured image-storage provider, so seeded drafts have no image reference. No story, financial amount, or verification badge is published by seeding.
- Change system settings
- Inspect audit logs

### 9. API checks

Useful endpoints:

```text
GET  /api/health
GET  /api/market
GET  /api/candles?instrumentId=<id>&limit=100
GET  /api/orderbook?instrumentId=<id>
GET  /api/orders
POST /api/orders
DELETE /api/orders
GET  /api/positions
POST /api/positions
GET  /api/wallet
POST /api/wallet
GET  /api/kyc
POST /api/kyc
```

## Production hardening checklist

Before real-money use, add and independently verify:

- Managed PostgreSQL with backups and point-in-time recovery
- Distributed rate limiting rather than process-memory rate limiting
- TOTP/WebAuthn 2FA with recovery codes
- Email/phone verification
- KYC document storage and verification provider
- AML and sanctions screening
- Real payment/custody integrations
- External market-data and execution integrations
- Reconciliation jobs
- Idempotency keys for every financial POST operation
- CSRF/origin controls appropriate to the deployment topology
- Structured security logging and alerting
- Secrets manager
- WAF/DDoS controls
- Database connection pooling
- Penetration testing
- Dependency/SBOM scanning
- Disaster recovery testing
- Regulatory review for every operating jurisdiction

## Project structure

```text
app/
  api/                 REST API routes
  admin/               admin control center
  dashboard/           portfolio dashboard
  trade/               trading terminal
  wallet/              funding interface
  kyc/                 KYC interface
  settings/            account settings
  login/               authentication UI
  register/            onboarding UI
components/            reusable React components
lib/                    authentication, ledger, market and order engines
prisma/                 schema and seed
server.ts               Next.js + Socket.io application server
tests/                  automated tests
Dockerfile              application image
docker-compose.yml      PostgreSQL + application orchestration
```

## Final implemented application surface

The current source includes:

- Dedicated `/admin/login` administrator entry point with role enforcement.
- Realtime Socket.io market ticks and execution broadcasts.
- Synthetic depth/order-book endpoint at `/api/orderbook`.
- Historical candle endpoint at `/api/candles`.
- User ledger transaction endpoint at `/api/ledger`.
- Full order retrieval and cancellation API.
- Market, limit and stop order triggering.
- Serializable order execution and leverage-aware margin reservation.
- Trading-fee ledger postings.
- Open-position unrealized P&L on the dashboard and trading terminal.
- Pending-withdrawal balance reservation checks.
- Admin instrument creation, enable/disable, price and leverage editing.
- Admin self-protection against freezing or demoting the currently logged-in administrator.
- Global loading, error and not-found UI states.
- Health endpoint suitable for container/load-balancer checks.

## Verification evidence

A repository-wide TypeScript/TSX parser scan was run after the final source edits and returned `parse_errors=0`.

A full dependency installation and therefore a complete `typecheck`, Prisma generation, Next production build and browser E2E run could not be completed in the execution environment because `npm install --no-audit --no-fund` timed out. Those commands remain the authoritative final verification commands on a machine with normal npm registry access.

Run:

```bash
npm install
npx prisma generate
npm run db:push
npm run db:seed
npm run typecheck
npm test
npm run build
npm run dev
```

This remains a simulated/internal trading and accounting platform. It is not, by itself, a licensed real-money brokerage, payment processor, custodian, KYC provider, or external execution venue.

## Aurevia stability and UX upgrade (2026-09)

This revision incorporates the recurring issues identified during the Aurevia deployment journey:

- Explicit client-side registration/login actions prevent the browser's native form GET from racing React hydration.
- Registration and login now expose network/API failures instead of silently stalling.
- Authentication keeps the existing NextAuth JWT session model; logout returns to `/login` without invalidating a valid session on ordinary refresh.
- A single startup shell provides an 8-second first-entry animation and a 3-second transition for subsequent route changes. It uses session storage to avoid an endless loading loop.
- The loading UI is finite and deterministic; there is no perpetual page reload or blinking redirect loop.
- Mobile navigation is full-width, touch-friendly, and avoids desktop side gutters/zoom-style layouts.
- The Aurevia metallic gold emblem supplied in the project assets is included at `public/aurevia-logo.png` and used in startup, navigation, login, registration, and the landing page.
- The interface uses a forest-green/black/gold visual system and broker-style trading cards, market views, order ticket, positions, notifications, KYC and account controls.
- The Stanbic IBTC E-Trade page was used only as a UX/functionality reference: mobile/web trading, live market data, account control, order workflows, portfolio visibility and trade notifications. Proprietary logos, copy, artwork and source code are not copied.

### Regression checklist

1. First visit: startup overlay completes once in 8 seconds.
2. Internal navigation: transition completes in 3 seconds.
3. Browser refresh: session is not deliberately cleared.
4. Logout: returns to login and does not trigger an infinite startup/redirect loop.
5. Registration: no native `/register?` submission; request goes to `/api/register` only after the user presses Continue.
6. Login: failed authentication shows an error and does not silently hang.
7. Mobile: navigation opens as an overlay and content remains within the viewport.
8. Branding: supplied Aurevia logo is loaded from the app's public assets.
