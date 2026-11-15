// What tools.avq is allowed to reach in the program around it: exactly these functions.
// In a real program this is where a database or an internal service would be asked.
const PRICES = { widget: 250, gadget: 1999, gizmo: 4950 };

export function unit_price(product) {
  return PRICES[product] ?? -1;
}
