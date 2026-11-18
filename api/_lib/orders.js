import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin.js';
import { ApiError } from './http.js';

const PAYMENT_METHODS = ['cash', 'gcash'];
const MAX_LINES = 50;
const MAX_QTY = 99;

const round2 = (n) => Math.round(n * 100) / 100;
const round3 = (n) => Math.round(n * 1000) / 1000;

function parseCart(items) {
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'The order is empty.');
  if (items.length > MAX_LINES) throw new ApiError(400, `An order can have at most ${MAX_LINES} lines.`);

  return items.map((item) => {
    const qty = Number(item?.qty);
    if (typeof item?.menuItemId !== 'string' || !item.menuItemId) throw new ApiError(400, 'Invalid menu item.');
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      throw new ApiError(400, `Quantity must be between 1 and ${MAX_QTY}.`);
    }
    return {
      menuItemId: item.menuItemId,
      sizeName: typeof item.sizeName === 'string' ? item.sizeName : null,
      addOnNames: Array.isArray(item.addOnNames) ? item.addOnNames.filter((n) => typeof n === 'string') : [],
      qty,
    };
  });
}

/** Adds `recipe × factor` to the ingredient usage map. */
function addUsage(usage, recipe, factor) {
  for (const entry of recipe ?? []) {
    const qty = Number(entry?.qty);
    if (!entry?.ingredientId || !(qty > 0)) continue;
    usage.set(entry.ingredientId, (usage.get(entry.ingredientId) ?? 0) + qty * factor);
  }
}

/**
 * Completes a sale in one Firestore transaction:
 *  1. Re-prices every line from the menu in the database (client prices are ignored).
 *  2. Works out ingredient usage from the item, size and add-on recipes.
 *  3. Creates the order with the next order number.
 *  4. Deducts stock and writes a stockMovement for each ingredient.
 * Stock may go negative (a café shouldn't block a sale over a miscount); low items are returned.
 */
export async function completeOrder({ user: cashier, data }) {
  const cart = parseCart(data.items);

  const paymentMethod = data.paymentMethod;
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new ApiError(400, 'Choose a payment method.');
  const cashReceived = paymentMethod === 'cash' ? Number(data.cashReceived) : null;

  return db.runTransaction(async (tx) => {
    // ---- Reads (Firestore requires all reads before any writes) ----
    const menuIds = [...new Set(cart.map((line) => line.menuItemId))];
    const menuSnaps = await tx.getAll(...menuIds.map((id) => db.doc(`menuItems/${id}`)));
    const menu = new Map(menuSnaps.map((snap) => [snap.id, snap.exists ? snap.data() : null]));

    const usage = new Map();
    const lines = cart.map((line) => {
      const item = menu.get(line.menuItemId);
      if (!item || item.available === false) {
        throw new ApiError(409, 'An item in this order is no longer available. Remove it and try again.');
      }

      let unitPrice = Number(item.price) || 0;
      addUsage(usage, item.recipe, line.qty);

      let sizeName = null;
      if (item.sizes?.length) {
        const size = item.sizes.find((s) => s.name === line.sizeName) ?? item.sizes[0];
        sizeName = size.name;
        unitPrice += Number(size.priceDelta) || 0;
        addUsage(usage, size.recipe, line.qty);
      }

      const addOnNames = [];
      for (const name of line.addOnNames) {
        const addOn = item.addOns?.find((a) => a.name === name);
        if (!addOn) throw new ApiError(409, `"${name}" is no longer offered for ${item.name}.`);
        addOnNames.push(addOn.name);
        unitPrice += Number(addOn.price) || 0;
        addUsage(usage, addOn.recipe, line.qty);
      }

      unitPrice = round2(unitPrice);
      return {
        menuItemId: line.menuItemId,
        name: item.name,
        sizeName,
        addOnNames,
        qty: line.qty,
        unitPrice,
        lineTotal: round2(unitPrice * line.qty),
      };
    });

    const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
    const discount = 0; // Discounts and loyalty rewards arrive in Phase 5.
    const total = round2(subtotal - discount);

    if (paymentMethod === 'cash' && !(cashReceived >= total)) {
      throw new ApiError(400, 'Cash received is less than the total.');
    }
    const change = paymentMethod === 'cash' ? round2(cashReceived - total) : 0;

    const ingredientIds = [...usage.keys()];
    const ingredientSnaps = ingredientIds.length
      ? await tx.getAll(...ingredientIds.map((id) => db.doc(`ingredients/${id}`)))
      : [];

    const counterRef = db.doc('counters/orders');
    const counterSnap = await tx.get(counterRef);
    const orderNumber = counterSnap.data()?.next ?? 1;

    // ---- Writes ----
    const orderRef = db.collection('orders').doc();
    tx.set(counterRef, { next: orderNumber + 1 }, { merge: true });
    tx.set(orderRef, {
      orderNumber,
      items: lines,
      subtotal,
      discount,
      total,
      paymentMethod,
      cashReceived,
      change,
      customerId: null,
      cashierId: cashier.id,
      cashierName: cashier.name ?? '',
      status: 'completed',
      createdAt: FieldValue.serverTimestamp(),
    });

    const lowStock = [];
    for (const snap of ingredientSnaps) {
      if (!snap.exists) continue; // Recipe points at a deleted ingredient — skip it.
      const ingredient = snap.data();
      const used = round3(usage.get(snap.id));
      const newStock = round3((Number(ingredient.stock) || 0) - used);

      tx.update(snap.ref, { stock: newStock, updatedAt: FieldValue.serverTimestamp() });
      tx.set(db.collection('stockMovements').doc(), {
        ingredientId: snap.id,
        ingredientName: ingredient.name,
        change: -used,
        unit: ingredient.unit,
        reason: 'sale',
        orderId: orderRef.id,
        byUserId: cashier.id,
        at: FieldValue.serverTimestamp(),
      });

      if (newStock <= (Number(ingredient.lowStockThreshold) || 0)) {
        lowStock.push({ id: snap.id, name: ingredient.name, stock: newStock, unit: ingredient.unit });
      }
    }

    return {
      orderId: orderRef.id,
      orderNumber,
      lines,
      subtotal,
      discount,
      total,
      paymentMethod,
      cashReceived,
      change,
      lowStock,
    };
  });
}
