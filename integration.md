# Arena Protocol — Integration Guide

This document covers how to integrate Arena Protocol components into the Adrena frontend.

---

## Overview

Arena Protocol runs as a Next.js app alongside (or embedded within) the Adrena frontend. Four lightweight components can be dropped into the Adrena UI to surface Arena data contextually:

| Component           | Where to use               |
| ------------------- | -------------------------- |
| `ArenaNavLink`      | Main navigation bar        |
| `TradeClosedToast`  | After every position close |
| `QuestCpsIndicator` | Quest card UI              |
| `AccountArenaStats` | Account / profile page     |

All components live in `src/components/adrena-integration/`.

---

## 1. Nav Link

**File:** `src/components/adrena-integration/ArenaNavLink.tsx`

Shows an "Arena" link in the nav. Displays a gold pulsing dot when a mid-season event (Gauntlet, Sprint) is active.

```tsx
import ArenaNavLink from "@/components/adrena-integration/ArenaNavLink";

// Inside your nav:
<ArenaNavLink className="text-white" />;
```

**Confirms with team:** File path for the Adrena nav component.

---

## 2. Trade Closed Toast

**File:** `src/components/adrena-integration/TradeClosedToast.tsx`

Shows a slide-in notification after a position closes: `"+4.2K CPS earned"`. During Gauntlet (Days 7–10), adds `"⚡ 1.5× bonus applied"`.

**Mount once** in your app root:

```tsx
import TradeClosedToastContainer from "@/components/adrena-integration/TradeClosedToast";

// In your layout or _app:
<TradeClosedToastContainer />;
```

**Trigger** wherever Adrena fires position-close events:

```tsx
import { showCpsToast } from "@/components/adrena-integration/TradeClosedToast";

// When a position closes:
showCpsToast(cpsEarned, isGauntletActive);
```

`cpsEarned` is the RAR score for that position (available from the Arena `/api/trader/{wallet}` response or from the scoring engine directly).

---

## 3. Quest CPS Indicator

**File:** `src/components/adrena-integration/QuestCpsIndicator.tsx`

Shows the connected wallet's total season CPS on quest cards, alongside the quest's own rewards.

```tsx
import QuestCpsIndicator from "@/components/adrena-integration/QuestCpsIndicator";

// Inside a quest card:
<QuestCpsIndicator
  wallet={connectedWallet}
  seasonNumber={activeSeasonNumber}
  variant="badge" // or "full" for a larger stats block
/>;
```

---

## 4. Account Arena Stats

**File:** `src/components/adrena-integration/AccountArenaStats.tsx`

Displays a full Arena stats block on the Adrena account/profile page: division badge, AR, season rank, CPS, streak, and achievement count.

```tsx
import AccountArenaStats from "@/components/adrena-integration/AccountArenaStats";

// On the account page:
<AccountArenaStats wallet={connectedWallet} />;
```

---

## API Reference

All components call the Arena API. In production these are same-origin requests. In development, set:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Key endpoints

| Endpoint                                         | Description                                              |
| ------------------------------------------------ | -------------------------------------------------------- |
| `GET /api/seasons/active`                        | Active season info — number, name, day, end date         |
| `GET /api/trader/{wallet}`                       | Full trader profile — AR, CPS, rank, squad, achievements |
| `GET /api/leaderboard/{season}/division/{div}`   | Paginated division leaderboard                           |
| `GET /api/leaderboard/{season}/squads`           | Paginated squad leaderboard                              |
| `GET /api/leaderboard/{season}/mid-season-event` | Current event phase and standings                        |
| `GET /api/status`                                | Database and system health check                         |
| `GET /api/config`                                | Scoring weights and configuration constants              |
| `POST /api/auth/nonce`                           | Get a sign-in nonce                                      |
| `POST /api/auth/register`                        | Verify signature and receive JWT                         |

### Authentication

Protected endpoints require a Bearer JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

Obtain a token via the sign-in flow:

```ts
// 1. Get nonce
const { nonce } = await fetch("/api/auth/nonce").then((r) => r.json());

// 2. Sign message with wallet
const message = `Arena Protocol login\nNonce: ${nonce}\nWallet: ${wallet}`;
const signature = await signMessage(new TextEncoder().encode(message));

// 3. Get JWT
const { token } = await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    wallet,
    signedMessage: bs58.encode(signature),
    message,
  }),
}).then((r) => r.json());
```

---

## Webhooks

Arena listens for two webhooks from Adrena's backend:

### Quest completion

```
POST /api/quests/complete
X-Adrena-Secret: {ADRENA_WEBHOOK_SECRET}

{
  "wallet": "...",
  "seasonNumber": 1,
  "questId": "weekly_volume_q1",
  "questType": "volume"
}
```

### Streak update

```
POST /api/streak/update
X-Adrena-Secret: {ADRENA_WEBHOOK_SECRET}

{
  "wallet": "...",
  "tradedAt": "2026-03-15T10:30:00Z"
}
```

Set `ADRENA_WEBHOOK_SECRET` in `.env.local` on both sides.

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Solana
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com

# Auth
JWT_SECRET=your-secret-key

# Webhooks
ADRENA_WEBHOOK_SECRET=shared-secret-with-adrena-backend

# Cron jobs (Vercel)
CRON_SECRET=your-cron-secret

# Admin
ADMIN_TOKEN=your-admin-token
```

---

## Cron Jobs (Vercel)

Three cron jobs run automatically on Vercel:

| Job                            | Schedule        | Purpose                                            |
| ------------------------------ | --------------- | -------------------------------------------------- |
| `/api/cron/position-sync`      | Every minute    | Fetch closed positions from Adrena API, score them |
| `/api/cron/leaderboard-update` | Every 5 minutes | Recalculate all CPS totals and division ranks      |
| `/api/cron/squad-lock`         | Every hour      | Lock squads after Day 3                            |

Configured in `vercel.json`.

---

## Mobile Breakpoints

All Arena components are tested at 375px (iPhone SE). Key responsive behaviours:

- `SquadPanel` slide-over: `width: min(420px, 100vw)` — full screen on mobile
- `MyStatsCard`: `grid-cols-2` on mobile, `grid-cols-6` on desktop
- `LeaderboardClient`: horizontal scroll on mobile tables
- `BottomBar`: social links visible on all sizes, nav links hidden on mobile (`hidden sm:flex`)

---

## Pages

| Route              | Description                                       |
| ------------------ | ------------------------------------------------- |
| `/`                | Season lobby — leaderboard, my stats, squad panel |
| `/trader/{wallet}` | Public trader profile                             |
| `/status`          | System and database health                        |
