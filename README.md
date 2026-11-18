# ☕ BrewDesk — Coffee Shop Management System

A management system for small coffee shops: a point of sale, menu management, recipe-based inventory, staff roles and a sales dashboard.

**Stack:** React (Vite) · Node serverless API (Vercel) · Firebase Auth · Cloud Firestore

**Cost:** ₱0. Firebase's free Spark plan plus Vercel's free Hobby plan, no credit card.

---

## Features

| Module | Status |
|---|---|
| Login with role-based access (owner / manager / barista) | ✅ Phase 1 |
| Menu: categories, items, sizes, add-ons, availability toggle | ✅ Phase 2 |
| POS: category tabs, search, options picker, cart, cash / GCash, change, receipt | ✅ Phase 3 |
| Server-side checkout with automatic stock deduction from recipes | ✅ Phase 3–4 (backend) |
| Order history | ✅ |
| Dashboard: today's sales, best sellers, low stock, recent orders | ✅ (basic) |
| Inventory screens (restock, waste, movement log) | ⏳ Phase 4 |
| Customers + loyalty points | ⏳ Phase 5 |
| Staff accounts: owner creates accounts, sets roles, resets passwords, deactivates (no public sign-up) | ✅ |
| Shifts, clock-in/out | ⏳ Phase 6 |

## How checkout works

The browser never writes orders or stock levels directly. The POS sends the cart to the `/api/complete-order` serverless route, which verifies the user's Firebase ID token and, which runs all of these steps in **one Firestore transaction**:

1. Re-prices every line from the menu stored in the database, so a modified client can't change prices.
2. Adds up ingredient usage from the item's recipe, the chosen size's recipe and each add-on's recipe.
   For example, a 16oz Café Latte with an extra shot uses 27 g beans, 280 ml milk and one 16oz cup.
3. Creates the order with a sequential order number.
4. Deducts each ingredient and logs a `stockMovement` record for auditing.
5. Returns any ingredients that are now low on stock so the barista sees a warning.

Firestore Security Rules enforce the roles on the server. Baristas can't edit the menu, and nobody can write orders or stock movements from the client.

## Staff accounts (no public sign-up)

There is no sign-up page and no email verification. The **owner** creates every account from the **Staff** page. The `/api/create-staff` route creates the login with the Admin SDK and saves the staff profile. The owner gives the staff member a temporary password, and can later change their role, reset their password or deactivate them. Deactivating disables the login and signs them out everywhere.

On a real Firebase project, also turn off self sign-up: **Authentication → Settings → User actions →** uncheck **Enable create (sign-up)**. Then nobody can create an account through the Firebase API directly.

## Project structure

```
brewdesk/
├── api/                     Node serverless routes (Vercel) — run inside `npm run dev` locally too
│   ├── complete-order.js
│   ├── create-staff.js · update-staff.js · reset-staff-password.js
│   └── _lib/                Admin SDK setup, auth check, order + staff logic
├── firestore.rules          Role-based security rules
├── scripts/seed.mjs         Demo staff, menu and inventory (emulator only)
├── vercel.json              SPA routing
└── src/
    ├── firebase.js          Firebase init + emulator wiring
    ├── lib/api.js           Calls /api with the user's ID token
    ├── context/ · components/ · hooks/ · lib/
    └── pages/               Login, Dashboard, POS, Orders, Menu, Staff
```

## Run it locally (no Firebase account needed)

**Requirements:** Node.js 20+ and Java 11+ (for the Firestore emulator).

```bash
npm install
cp .env.example .env.local      # Windows: copy .env.example .env.local
npm run emulators               # terminal 1
npm run seed                    # terminal 2
npm run dev                     # terminal 2 → http://localhost:5173
```

| Role | Email | Password |
|---|---|---|
| Owner | owner@brewdesk.demo | demo1234 |
| Manager | manager@brewdesk.demo | demo1234 |
| Barista | barista@brewdesk.demo | demo1234 |

Emulator UI (browse the database): http://localhost:4000

## Deploy for free (Firebase Spark + Vercel Hobby)

1. **Firebase project** — create one at https://console.firebase.google.com (stay on the free Spark plan).
   Enable **Authentication → Email/Password** and create a **Firestore** database (asia-southeast1).
2. **Security rules** — put your project ID in `.firebaserc`, then `npx firebase login` and `npm run deploy:rules`.
3. **First owner** — Authentication → Add user; then Firestore → `users/{UID}` with
   `name`, `email`, `role: "owner"`, `active: true`. Everyone else is added from the Staff page.
4. **Service account** — Project settings → Service accounts → Generate new private key. Don't commit this file.
5. **Vercel** — push to GitHub, import the repo at https://vercel.com, and add environment variables:
   - `VITE_USE_EMULATORS=false`, `VITE_SHOW_DEMO_LOGIN=false`, and the six `VITE_FIREBASE_*` values from the web app config
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` from the service account file
6. Add your Vercel domain under Authentication → Settings → Authorized domains.

## Data model

| Collection | Key fields |
|---|---|
| `users` | name, email, role, active |
| `categories` | name, sortOrder |
| `menuItems` | name, categoryId, price, available, recipe[], sizes[{name, priceDelta, recipe[]}], addOns[{name, price, recipe[]}] |
| `ingredients` | name, unit, stock, lowStockThreshold, costPerUnit |
| `stockMovements` | ingredientId, change, reason, orderId, byUserId, at |
| `orders` | orderNumber, items[], subtotal, discount, total, paymentMethod, cashReceived, change, cashierId, status, createdAt |
| `counters/orders` | next |
| `settings/shop` | shopName, taxRate, pointsPerPeso, rewardThreshold |

## Roadmap

- [x] Phase 1: Setup, auth, role-based routing
- [x] Phase 2: Menu and categories
- [x] Phase 3: POS and orders
- [ ] Phase 4: Inventory screens: recipes editor, restock, waste, movement log
- [ ] Phase 5: Customers and loyalty
- [ ] Phase 6: Staff, shifts, time logs
- [ ] Phase 7: Dashboard reports (date ranges, charts)
- [ ] Phase 8: Polish, screenshots, deploy
