# Athlete Finance App

A React Native mobile app built with Expo for tracking finances for individual athletes. Includes income and expense tracking, budget management, tax categories, reports, and CSV export.

---

## Tech Stack

- **React Native** — mobile UI framework
- **Expo** — development toolchain and device preview
- **Supabase** — backend, database, and authentication
- **React Navigation** — bottom tab and stack navigation
- **expo-haptics** — haptic feedback on interactions
- **expo-file-system/legacy** — file writing for CSV export
- **expo-sharing** — native share sheet for file export
- **@react-native-community/datetimepicker** — date picker on Add Transaction

---

## Project Structure

```
athlete-finance/
├── App.js                      # Navigation shell (stack + bottom tab bar)
├── supabase.js                 # Supabase client configuration
└── screens/
    ├── LoadingScreen.js            # Animated loading screen on app open
    ├── LoginScreen.js              # Email/password login
    ├── SignupScreen.js             # Account creation with success animation
    ├── DashboardScreen.js          # Home — balance, budget, transactions, tax widget
    ├── TransactionsScreen.js       # Full transaction history with search and filter
    ├── AddTransactionScreen.js     # Log a transaction with date picker
    ├── BudgetScreen.js             # Set and manage budget limits per category
    ├── ReportsScreen.js            # Charts, monthly summaries, CSV export
    ├── TaxScreen.js                # Tax estimates, deductibles, quarterly payments
    └── ProfileScreen.js            # Edit name, sport, view stats, sign out
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (LTS version)
- [Expo Go](https://expo.dev/client) installed on your iPhone or Android device
- A [Supabase](https://supabase.com) account and project

### Installation

1. Navigate into the project:
   ```bash
   cd athlete-finance
   ```

2. Install dependencies:
   ```bash
   npm install
   npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
   npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack
   npx expo install react-native-screens react-native-safe-area-context
   npx expo install expo-haptics expo-file-system expo-sharing
   npx expo install @react-native-community/datetimepicker
   npm install xlsx
   ```

3. Configure Supabase by opening `supabase.js` and adding your credentials:
   ```js
   const SUPABASE_URL = 'https://your-project-id.supabase.co'
   const SUPABASE_ANON_KEY = 'your-anon-public-key'
   ```
   Find these in your Supabase dashboard under **Project Settings → API**.

4. Start the development server:
   ```bash
   npx expo start
   ```

5. Scan the QR code with your iPhone camera to open the app in Expo Go.

> Your phone and laptop must be on the same WiFi network. If it doesn't connect, press `t` in the terminal to switch to tunnel mode.

---

## Supabase Setup

### Tables Required

**profiles**
| Column | Type |
|---|---|
| id | uuid (matches auth user id) |
| full_name | text |
| sport | text |

**transactions**
| Column | Type |
|---|---|
| id | int8 (auto increment) |
| user_id | uuid |
| label | text |
| amount | numeric |
| type | text (income / expense) |
| category | text |
| date | date |

**budgets**
| Column | Type |
|---|---|
| id | int8 (auto increment) |
| user_id | uuid |
| category | text |
| limit_amount | numeric |

### RLS Policies Required

Each table needs these Row Level Security policies:

**profiles**
- SELECT: `auth.uid() = id`
- UPDATE: `auth.uid() = id`
- INSERT: `auth.uid() = id`

**transactions**
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

**budgets**
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

---

## Screens

| Screen | Description |
|---|---|
| Loading | Animated logo and bouncing dots while session loads |
| Login | Email and password sign in with error handling |
| Signup | Full name, sport, email, password with success animation |
| Dashboard | Live balance, budget progress bars, recent transactions, dynamic quarterly tax widget |
| Transactions | Full history grouped by month, search by name or category, filter by income or expense, delete |
| Add Transaction | Log income or expense with amount, description, date picker, and category selector including custom categories |
| Budget | Set monthly limits per category, add custom categories, delete custom categories, progress bars with overspend alerts |
| Reports | Bar chart of income vs expenses by month, category spending breakdown, CSV export |
| Tax | Monthly tax estimate, deductible expenses, quarterly payment tracker |
| Profile | Edit name and sport, view monthly stats, sign out |

---

## Features

### Authentication
- Email and password login and signup
- Session persisted across app restarts
- Profile automatically created on signup
- Sign out from profile screen

### Transactions
- Log income or expenses with label, amount, category and date
- Date picker — log transactions for any past date
- Categories include defaults and any custom budget categories
- Search transactions by name or category
- Filter by all, income or expenses
- Delete transactions with confirmation
- Grouped by month in transaction history

### Budget
- Set monthly spending limits per category
- Default categories: Training, Travel, Equipment, Medical, Agent fees, Tax payment
- Add unlimited custom categories with their own limits
- Delete custom categories
- Progress bars showing spent vs limit
- Color coded: green under 80%, amber 80-100%, red over budget
- Dashboard syncs automatically with budget limits

### Reports
- Bar chart showing income vs expenses for every month of the year
- Tap any month bar to see that month's summary
- Category breakdown view showing spending by category with percentages
- CSV export with 5 sections: athlete info, annual summary, monthly summary, all transactions, deductible expenses
- CSV opens in Excel, Google Sheets, and Numbers

### Tax
- Estimated tax calculated at 30% of taxable income
- Deductible categories: Training, Travel, Equipment, Medical, Agent fees
- Monthly deductible expenses listed separately
- Quarterly payment tracker with due dates
- Mark quarters as paid
- Dynamic tax widget on dashboard showing current quarter estimate

### UX
- Fade in animations on every screen
- Haptic feedback on all key interactions
- Pull to refresh on every screen
- Empty states with icons and helpful messages
- Sport badge on dashboard
- Profile avatar with initials
- Loading screen on app open
- Success animation after saving a transaction
- Success animation after creating an account

---

## Security Notes

- The `anon` public key is safe to use in client-side code
- Never use the `service_role` key in the app
- RLS policies ensure each athlete can only access their own data
- Email confirmation is disabled for prototype — enable before launch
- Add proper password reset flow before production

---

## Known Limitations (Prototype)

- Tax rate is hardcoded at 30% — should be configurable per athlete
- Quarterly payment paid status resets when app restarts — needs a database table to persist
- No push notifications yet for tax due date reminders
- No edit transaction yet — can only delete and re-add
- No multi-currency support
- No agent/advisor view for managing multiple athletes
- Excel .xlsx export not supported due to Hermes engine incompatibility — using CSV instead

---

## Status

> Prototype stage. All core features functional with real Supabase backend. Ready for client demo.