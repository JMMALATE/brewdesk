import { round2 } from './format.js';

/**
 * Display price for one unit of a menu item with a size and add-ons.
 * The Cloud Function recomputes this on the server — never trust the client total.
 */
export function unitPriceFor(item, sizeName, addOnNames = []) {
  let price = Number(item.price) || 0;

  const size = item.sizes?.find((s) => s.name === sizeName);
  if (size) price += Number(size.priceDelta) || 0;

  for (const name of addOnNames) {
    const addOn = item.addOns?.find((a) => a.name === name);
    if (addOn) price += Number(addOn.price) || 0;
  }

  return round2(price);
}
