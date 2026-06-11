# 🛒 GroceryMonitor

A simple, friendly web app for tracking your grocery spending. No accounts, no
installs, no dependencies — your data stays in your browser.

## Features

- **Quick expense entry** — item, amount, date, category, and store (with
  auto-suggestions from stores you've used before)
- **Monthly dashboard** — total spent, comparison with last month, shopping
  trips, average spend per trip, and your top category
- **Budget tracking** — set a monthly budget and watch the progress bar change
  color as you approach (or pass) it
- **Charts** — category breakdown donut for the current month and a 6-month
  spending trend
- **Search & filters** — find expenses by item/store text, category, or month,
  with a filtered total shown at the bottom
- **CSV export** — download all expenses for use in Excel / Google Sheets
- **Dark mode** — follows your system preference, toggleable any time
- **Sample data** — one click to explore the app with realistic data

## Getting started

Just open `index.html` in any modern browser. That's it.

If you prefer serving it locally:

```bash
npx serve .
# or
python3 -m http.server 8000
```

then visit the printed URL.

## How your data is stored

Everything is saved in your browser's `localStorage` — nothing is sent
anywhere. Clearing your browser data will remove your expenses, so use
**Export CSV** if you want a backup.

## Tech

Plain HTML, CSS, and JavaScript. No frameworks, no build step, no network
requests.
