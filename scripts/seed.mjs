/**
 * Seeds the LOCAL Firebase emulators with demo staff, menu and inventory.
 *
 *   npm run emulators   # terminal 1
 *   npm run seed        # terminal 2
 *
 * This script always points at the emulators, so it can't touch a real project.
 * Running it again resets the demo data (orders are kept).
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const { initializeApp } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-brewdesk';
initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

const DEMO_PASSWORD = 'demo1234';

const staff = [
  { uid: 'demo-owner', name: 'Maria Santos', email: 'owner@brewdesk.demo', role: 'owner' },
  { uid: 'demo-manager', name: 'Joel Reyes', email: 'manager@brewdesk.demo', role: 'manager' },
  { uid: 'demo-barista', name: 'Ana Cruz', email: 'barista@brewdesk.demo', role: 'barista' },
];

const categories = [
  { id: 'coffee', name: 'Coffee', sortOrder: 1 },
  { id: 'non-coffee', name: 'Non-Coffee', sortOrder: 2 },
  { id: 'pastries', name: 'Pastries', sortOrder: 3 },
];

// stock in the ingredient's unit; costPerUnit in PHP per unit
const ingredients = [
  { id: 'espresso-beans', name: 'Espresso beans', unit: 'g', stock: 5000, lowStockThreshold: 1000, costPerUnit: 1.2 },
  { id: 'fresh-milk', name: 'Fresh milk', unit: 'ml', stock: 12000, lowStockThreshold: 3000, costPerUnit: 0.095 },
  { id: 'condensed-milk', name: 'Condensed milk', unit: 'ml', stock: 2000, lowStockThreshold: 500, costPerUnit: 0.16 },
  { id: 'caramel-syrup', name: 'Caramel syrup', unit: 'ml', stock: 1500, lowStockThreshold: 300, costPerUnit: 0.45 },
  { id: 'chocolate-sauce', name: 'Chocolate sauce', unit: 'ml', stock: 1500, lowStockThreshold: 300, costPerUnit: 0.4 },
  { id: 'matcha-powder', name: 'Matcha powder', unit: 'g', stock: 400, lowStockThreshold: 100, costPerUnit: 4.5 },
  { id: 'cup-12oz', name: 'Cup 12oz', unit: 'pcs', stock: 300, lowStockThreshold: 50, costPerUnit: 4 },
  { id: 'cup-16oz', name: 'Cup 16oz', unit: 'pcs', stock: 300, lowStockThreshold: 50, costPerUnit: 5 },
  { id: 'croissant', name: 'Butter croissant', unit: 'pcs', stock: 24, lowStockThreshold: 6, costPerUnit: 38 },
  { id: 'ensaymada', name: 'Ensaymada', unit: 'pcs', stock: 20, lowStockThreshold: 6, costPerUnit: 28 },
];

const r = (ingredientId, qty) => ({ ingredientId, qty });

// Cups live on the size recipe, so each size uses the right cup.
const drinkSizes = (largeExtra = []) => [
  { name: '12oz', priceDelta: 0, recipe: [r('cup-12oz', 1)] },
  { name: '16oz', priceDelta: 25, recipe: [r('cup-16oz', 1), ...largeExtra] },
];

const coffeeAddOns = [
  { name: 'Extra shot', price: 40, recipe: [r('espresso-beans', 9)] },
  { name: 'Caramel drizzle', price: 20, recipe: [r('caramel-syrup', 10)] },
];

const menuItems = [
  { id: 'americano', name: 'Americano', categoryId: 'coffee', price: 110,
    recipe: [r('espresso-beans', 18)], sizes: drinkSizes([r('espresso-beans', 9)]), addOns: coffeeAddOns },
  { id: 'cafe-latte', name: 'Café Latte', categoryId: 'coffee', price: 140,
    recipe: [r('espresso-beans', 18), r('fresh-milk', 200)], sizes: drinkSizes([r('fresh-milk', 80)]), addOns: coffeeAddOns },
  { id: 'spanish-latte', name: 'Spanish Latte', categoryId: 'coffee', price: 160,
    recipe: [r('espresso-beans', 18), r('fresh-milk', 180), r('condensed-milk', 30)],
    sizes: drinkSizes([r('fresh-milk', 70), r('condensed-milk', 10)]), addOns: coffeeAddOns },
  { id: 'caramel-macchiato', name: 'Caramel Macchiato', categoryId: 'coffee', price: 165,
    recipe: [r('espresso-beans', 18), r('fresh-milk', 200), r('caramel-syrup', 20)],
    sizes: drinkSizes([r('fresh-milk', 80), r('caramel-syrup', 5)]), addOns: coffeeAddOns },
  { id: 'mocha', name: 'Café Mocha', categoryId: 'coffee', price: 160,
    recipe: [r('espresso-beans', 18), r('fresh-milk', 180), r('chocolate-sauce', 30)],
    sizes: drinkSizes([r('fresh-milk', 70), r('chocolate-sauce', 10)]), addOns: coffeeAddOns },
  { id: 'matcha-latte', name: 'Matcha Latte', categoryId: 'non-coffee', price: 165,
    recipe: [r('matcha-powder', 5), r('fresh-milk', 220)], sizes: drinkSizes([r('matcha-powder', 2), r('fresh-milk', 80)]),
    addOns: [{ name: 'Extra matcha', price: 35, recipe: [r('matcha-powder', 3)] }] },
  { id: 'hot-chocolate', name: 'Hot Chocolate', categoryId: 'non-coffee', price: 130,
    recipe: [r('chocolate-sauce', 40), r('fresh-milk', 220)], sizes: drinkSizes([r('chocolate-sauce', 10), r('fresh-milk', 80)]),
    addOns: [] },
  { id: 'croissant', name: 'Butter Croissant', categoryId: 'pastries', price: 95,
    recipe: [r('croissant', 1)], sizes: [], addOns: [] },
  { id: 'ensaymada', name: 'Ensaymada', categoryId: 'pastries', price: 75,
    recipe: [r('ensaymada', 1)], sizes: [], addOns: [] },
];

async function upsertAuthUser({ uid, email, name }) {
  try {
    await auth.updateUser(uid, { email, password: DEMO_PASSWORD, displayName: name });
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    await auth.createUser({ uid, email, password: DEMO_PASSWORD, displayName: name });
  }
}

async function main() {
  for (const s of staff) await upsertAuthUser(s);

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  for (const { uid, name, email, role } of staff) {
    batch.set(db.doc(`users/${uid}`), { name, email, role, active: true, createdAt: now });
  }
  for (const { id, ...c } of categories) batch.set(db.doc(`categories/${id}`), c);
  for (const { id, ...i } of ingredients) batch.set(db.doc(`ingredients/${id}`), { ...i, updatedAt: now });
  for (const { id, ...m } of menuItems) {
    batch.set(db.doc(`menuItems/${id}`), { ...m, available: true, createdAt: now, updatedAt: now });
  }
  batch.set(
    db.doc('settings/shop'),
    { shopName: 'BrewDesk Café', taxRate: 0, pointsPerPeso: 0.01, rewardThreshold: 100 },
    { merge: true },
  );

  await batch.commit();

  console.log(`✔ Seeded project "${PROJECT_ID}" on the emulators`);
  console.log(`  ${staff.length} staff · ${categories.length} categories · ${menuItems.length} menu items · ${ingredients.length} ingredients`);
  console.log('\n  Demo logins (password: demo1234)');
  for (const s of staff) console.log(`   ${s.role.padEnd(8)} ${s.email}`);
}

main().catch((err) => {
  if (err.code === 'ECONNREFUSED' || /ECONNREFUSED/.test(err.message)) {
    console.error('✖ Could not reach the emulators. Start them first with: npm run emulators');
  } else {
    console.error('✖ Seeding failed:', err);
  }
  process.exit(1);
});
