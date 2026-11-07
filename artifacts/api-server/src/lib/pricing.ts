const KWD_PRICE_STEP = 0.5;

export function roundKwdPrice(price: number): number {
  if (!Number.isFinite(price) || price < 0) {
    throw new RangeError("Price must be a finite, non-negative KWD amount.");
  }

  return Math.round(price / KWD_PRICE_STEP) * KWD_PRICE_STEP;
}
