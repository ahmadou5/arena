# Arena Protocol — How It Works

Arena Protocol is a competitive trading season system built on top of [Adrena](https://adrena.trade), a perpetuals exchange on Solana. It turns regular trading activity into a ranked competition with divisions, squads, prizes, and achievements.

---

## The Season

A season runs for **28 days**. Every trade you close on Adrena earns you **CPS (Competitive Performance Score)** — the core currency of Arena.

At the end of the season:

- Final CPS determines your rank within your division
- Your **Arena Rating (AR)** is updated based on how well you performed
- Prize pool is distributed across top traders, squads, and achievements
- Promotion and relegation move you between divisions

---

## Arena Rating & Divisions

Your **Arena Rating** is a persistent score that carries across seasons. It determines which division you compete in:

| Division    | AR Range  |
| ----------- | --------- |
| Grandmaster | 2000+     |
| Diamond     | 1600–1999 |
| Platinum    | 1200–1599 |
| Gold        | 800–1199  |
| Silver      | 0–799     |

After each season your AR goes up or down based on your percentile finish within your division. Finishing in the top 10% of your division earns a promotion to the next tier for the following season.

---

## How CPS Is Calculated

Every closed position generates a **RAR score** (Risk-Adjusted Return):

```
RAR = (PnL / drawdown_floor) × ln(1 + hours_held)
```

- **PnL** — profit or loss on the position
- **Drawdown floor** — a risk normaliser based on fees and collateral
- **Hours held** — longer holds multiply the score logarithmically

RAR is combined with quest bonuses, streak bonuses, and consistency bonuses to produce your final CPS.

**Gauntlet (Days 7–10):** All CPS earned during this window is multiplied by **1.5×**.

---

## Quests & Streaks

**Quests** are weekly trading objectives. Completing them earns bonus CPS on top of your trade score.

**Streaks** track how many consecutive calendar days you have traded. Longer streaks unlock higher streak bonuses on your season CPS total.

---

## Squads

Join or create a squad of up to **5 traders** before Day 3 (squad lock day).

Squads compete for their own leaderboard and 20% of the prize pool. Your squad score is the sum of all member CPS.

**Synergy bonuses:**

- **Quest Sync (+5%)** — all members complete the weekly quest in the same week
- **Trade Streak (+10%)** — all members trade on the same 7 consecutive days

---

## Mid-Season Events

| Phase       | Days  | Focus                         |
| ----------- | ----- | ----------------------------- |
| Gauntlet    | 7–10  | 1.5× CPS multiplier active    |
| Momentum    | 8–14  | Biggest rank improvement      |
| Consistency | 15–21 | Highest win rate (≥5 trades)  |
| Sprint      | 22–28 | Final push — countdown active |

**Halfway Shake (Day 14):** Traders in the bottom 15% of their division see a warning. Last chance to push before standings crystallise.

---

## Prizes

| Category      | Share |
| ------------- | ----- |
| Individual    | 60%   |
| Squad         | 20%   |
| Participation | 10%   |
| Achievements  | 10%   |

Prizes are allocated in USDC at season close.

---

## Achievements

| Achievement        | Condition                                  |
| ------------------ | ------------------------------------------ |
| Iron Hands         | Zero losing trades with 10+ trades         |
| Comeback King      | Bottom 25% at Day 14, finished top 25%     |
| Division Dominator | 1.2× the CPS of 2nd place in your division |
| Squad MVP          | Highest CPS in the #1 ranked squad         |
| Perfect Streak     | Traded every calendar day of the season    |
| Completionist      | Completed every available quest            |

---

## Signing In

1. Click **Connect** in the top nav
2. Select Phantom or Solflare
3. Click **Sign In** — sign a short message (no transaction, no gas fees)
4. Your profile is created automatically on first sign-in

Your session lasts 7 days. After that, sign in again with the same wallet.

---

## Your Profile

Visit `/trader/{wallet}` for your public profile:

- Arena Rating and division badge
- Current season stats (CPS, rank, win rate, trades)
- Season history with AR delta
- Squad membership and achievements

Profiles are fully public — anyone can view any trader by wallet address.
