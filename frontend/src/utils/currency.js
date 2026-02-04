/**
 * Currency formatting - Moroccan Dirham (MAD / DH)
 */
export function formatCurrency(amount) {
  const value = parseFloat(amount) || 0
  return new Intl.NumberFormat('fr-MA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value) + ' DH'
}
