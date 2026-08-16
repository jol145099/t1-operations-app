# T1 Operations App

MVP starter for a single codebase that can run as:

- iOS app
- Android app
- Web app

## MVP roles

- **Customer**: see own spending / orders / VIP
- **Player**: see assigned orders, complete orders, see two-week settlement
- **Staff**: create orders, assign one or multiple players, manage adjustments
- **Admin**: full operational access

## Current implemented starter

- Supabase email/password login
- role-aware home screen
- order list protected by database RLS
- staff/admin new-order screen
- supports 1..N players
- direct-order mode (`requires_player = false`)
- two-week settlement screen
- production-oriented relational schema
- starter RLS policies

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase

Create a NEW Supabase project and run:

```text
supabase/schema.sql
```

in the Supabase SQL Editor.

See `supabase/README.md`.

### 3. Environment

Copy:

```bash
cp .env.example .env
```

Then add your Supabase project URL and publishable key.

### 4. Run

```bash
npx expo start
```

- press `w` for web
- use Android/iOS development tooling for native
- Expo Go support depends on the current Expo SDK compatibility on your device

## Important next build items

1. Searchable customer/player/order-type selectors
2. Staff order detail + edit screen
3. Player accept/complete workflow
4. Completion form: end date, games played, extracts, order-type-specific fields
5. Automatic pay calculation engine
6. Ledger UI for rental / compensation / advance / penalty
7. Settlement generation for 1–15 and 16–end-of-month
8. Customer VIP dashboard and VIP rules
9. Notifications for player assignment and completion
10. EAS build configuration for downloadable iOS/Android packages

## Security

This project intentionally keeps authorization in Supabase RLS, not only in the UI.
Before production, add stricter database triggers so player updates can only modify
allowed completion fields on their own assignments.
