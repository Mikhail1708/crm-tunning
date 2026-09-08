/** Product.stock is free stock: reservations decrement it atomically and release restores it. */
export const productAvailability = (stock: number) => {
  const availableStock = Number.isFinite(stock) ? Math.max(0, stock) : 0;
  return { stock: availableStock, availableStock, inStock: availableStock > 0,
    availabilityStatus: availableStock > 0 ? 'in_stock' as const : 'on_order' as const };
};
