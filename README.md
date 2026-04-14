# Convention Manager

A full-stack convention management system with NFC/RFID integration for managing players, vouchers, tix (earned currency), and events.

## Architecture

```
ConventionManager/
├── backend/          # Node.js + Express + TypeScript API
├── admin-panel/      # React + Vite + Tailwind admin dashboard
└── android-nfc/      # Kotlin Android NFC scanner app
```

## Core Concepts

- **Vouchers** — Purchased currency used to enter events
- **Tix** — Earned currency awarded as prizes
- **Ledger-based** — Balances are never stored directly; they are always computed as `SUM(amount)` from the `transactions` table
- **NFC/RFID** — Players are identified by scanning their NFC tag UID

---

## 1. Backend Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Install & Configure

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your PostgreSQL credentials and API key
```

### Environment Variables (`.env`)

```
DB_USER=postgres
DB_HOST=localhost
DB_NAME=convention_manager
DB_PASSWORD=yourpassword
DB_PORT=5432
PORT=3000
API_KEY=your_secret_api_key
JWT_SECRET=your_jwt_secret
```

### Initialize Database

```bash
# Create the database first in psql:
# CREATE DATABASE convention_manager;

npm run db:init    # Creates tables
npm run db:seed    # Seeds sample data
```

### Run

```bash
npm run dev        # Development (ts-node)
npm run build      # Compile TypeScript
npm start          # Production (compiled JS)
```

### API Endpoints

All requests require `x-api-key` header.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| **Users** | | |
| POST | `/api/users/register` | Register user (name, nfc_uid) |
| GET | `/api/users` | List all users |
| GET | `/api/users/search?q=` | Search users |
| GET | `/api/users/:id` | Get user details + balances |
| PUT | `/api/users/:id` | Update user |
| **Vouchers** | | |
| POST | `/api/vouchers/topup` | Admin top-up (user_id, amount) |
| POST | `/api/vouchers/adjust` | Admin adjustment |
| GET | `/api/vouchers/balance/:userId` | Get voucher balance |
| GET | `/api/vouchers/history/:userId` | Transaction history |
| **Tix** | | |
| GET | `/api/tix/balance/:userId` | Get tix balance |
| GET | `/api/tix/history/:userId` | Transaction history |
| POST | `/api/tix/adjust` | Admin adjustment |
| **Events** | | |
| GET | `/api/events/types` | List event types |
| POST | `/api/events/types` | Create event type |
| POST | `/api/events` | Create event |
| GET | `/api/events` | List events (?status=open) |
| GET | `/api/events/:id` | Event details + participants |
| POST | `/api/events/:id/register` | Register player |
| POST | `/api/events/:id/start` | Start event |
| POST | `/api/events/:id/results` | Set results |
| POST | `/api/events/:id/finish` | Finish & award prizes |
| POST | `/api/events/:id/cancel` | Cancel & refund |
| **NFC Scan** | | |
| POST | `/api/scan` | Scan NFC tag (nfc_uid) |
| POST | `/api/scan/balance` | Quick balance check |

---

## 2. Admin Panel Setup

### Prerequisites
- Node.js 18+

### Install & Run

```bash
cd admin-panel
npm install
npm run dev        # Starts on http://localhost:5173
```

The admin panel proxies `/api` requests to `http://localhost:3000` (the backend).

### Features
- **Dashboard** — Overview with user count, event stats, quick links
- **Users** — Register, search, list users
- **Events** — Create, manage lifecycle (open → ongoing → finished/cancelled)
- **Event Types** — Define formats with entry costs and prize structures
- **Vouchers & Tix** — Look up by NFC UID, top-up vouchers, view history
- **NFC Scanner** — Manual NFC UID lookup with balance display

### Build for Production

```bash
npm run build      # Output in dist/
npm run preview    # Preview production build
```

---

## 3. Android NFC App

### Prerequisites
- Android Studio Hedgehog (2023.1.1) or newer
- Android SDK 34
- Physical Android device with NFC

### Setup

1. Open `android-nfc/` in Android Studio
2. Edit `app/build.gradle.kts`:
   - Set `API_BASE_URL` to your backend's URL (use `10.0.2.2` for emulator → localhost)
   - Set `API_KEY` to match your backend's API key
3. Build and run on a physical device (NFC requires real hardware)

### How It Works

1. App starts with NFC foreground dispatch enabled
2. When an NFC tag is tapped, the UID is extracted as a hex string
3. The UID is sent to `POST /api/scan` on the backend
4. The app displays the player's name, voucher balance, and tix balance

### Key Files
- `MainActivity.kt` — NFC scan handling + UI
- `NfcHelper.kt` — NFC adapter setup and tag UID extraction
- `ApiClient.kt` — Backend API communication via OkHttp

---

## Database Schema

```
users           — Player profiles with NFC UIDs
event_types     — Event format definitions (cost, prizes, max players)
events          — Actual event instances with status tracking
event_participants — Player registrations and results
transactions    — Immutable ledger for all voucher/tix movements
```

### Key Principle

> **Never update balances directly.** Balance = `SELECT SUM(amount) FROM transactions WHERE user_id = X AND type = 'voucher'`

All balance changes go through `addTransaction()` which inserts into the immutable ledger.

---

## Event Lifecycle

```
open → ongoing → finished (prizes awarded)
  └──→ cancelled (refunds issued)
```

1. **Create** event from an event type
2. **Register** players (deducts voucher entry cost)
3. **Start** event (status: ongoing)
4. **Set results** (assign positions)
5. **Finish** event (distributes tix prizes based on prize_structure)
6. Or **Cancel** event (refunds all entry fees)

---

## Security

- All API routes require `x-api-key` header
- Database transactions (`BEGIN/COMMIT/ROLLBACK`) protect multi-step operations
- `SELECT ... FOR UPDATE` prevents race conditions on event registration
- Server-defined amounts for transactions (never trust client input)
