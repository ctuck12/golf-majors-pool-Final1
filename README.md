# Family Budget

A private budget app for one family: connect your bank and credit cards, see
every dollar you spend in near real time, and track monthly budgets and
savings goals.

Built with Next.js (App Router), Tailwind CSS, Redis for storage, and Plaid
for bank connections. Deploys on Vercel via Git integration.

## Features

- **Bank & card sync** via Plaid — transactions land automatically through
  webhooks, with a scheduled sync as a safety net (`vercel.json` cron).
- **Demo mode** — with no Plaid keys set, seed a demo bank with ~90 days of
  realistic family spending and use every feature.
- **Budgets** — recurring monthly amounts per category with live
  spent-vs-remaining meters and over-budget warnings.
- **Goals** — savings targets with progress tracking and quick contributions.
- **Activity** — searchable transaction list; recategorize anything (your
  overrides survive re-syncs) or hide one-offs from budgets.
- **Family passcode** — one shared passcode gates the whole app.
- **Move & payoff plan** — loans/debts tracker, expected one-time money
  (tax refund), sale-day payoff math (equity − down payment − payoffs), and
  a phase-by-phase monthly plan with savings/investment percentages and a
  variable-spending allowance. Seeded from the household budget
  spreadsheet; editable in the app (`/plan`).
- **Debt auto-tracking** — loan balances decrement as matching payment
  transactions sync (name patterns + amount guard, each payment applied
  once); credit-card debts can mirror a linked account's live balance.
  Manual edits always allowed — tracking continues from your number.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `REDIS_URL` | yes (for persistence) | Storage. Without it, data lives in process memory only. |
| `FAMILY_PASSCODE` | recommended | Enables the passcode gate. Unset = app is open. |
| `PLAID_CLIENT_ID` | for bank linking | From the [Plaid dashboard](https://dashboard.plaid.com/developers/keys). |
| `PLAID_SECRET` | for bank linking | Use the sandbox secret first, production later. |
| `PLAID_ENV` | no | `sandbox` (default) or `production`. |
| `CRON_SECRET` | no | If set, the cron sync route requires it (Vercel sends it automatically). |

## Connecting real banks

1. Create a free account at [plaid.com](https://plaid.com) and grab the
   client ID and sandbox secret from the dashboard.
2. Set `PLAID_CLIENT_ID`, `PLAID_SECRET` (+ `PLAID_ENV=sandbox`) in Vercel.
3. On the **Accounts** page, click **Connect a bank**. In sandbox, use
   Plaid's test credentials (`user_good` / `pass_good`).
4. When ready for real data, request Production access in the Plaid
   dashboard, swap in the production secret, and set `PLAID_ENV=production`.

Webhooks are registered automatically per linked item, pointing at
`/api/budget/plaid/webhook` on the deployment's own origin.

## Development

```bash
npm install
npm run dev
```

Without `REDIS_URL` the app still runs (in-memory storage) — seed demo data
from the dashboard to look around.
