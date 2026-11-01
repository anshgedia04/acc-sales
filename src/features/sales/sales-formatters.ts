import type { SalesEntry } from '@/services/sales-api';

const amountFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatAmount(value: number | '') {
  return value === '' ? '—' : `₹${amountFormatter.format(value)}`;
}

export function formatQuantity(value: SalesEntry['quantity']) {
  return value === '' ? '—' : amountFormatter.format(value);
}

export function getBalanceColor(value: SalesEntry['balance']) {
  if (value === '') return '#6A7772';
  if (value > 0) return '#B42318';
  if (value < 0) return '#1D5FA7';
  return '#146C43';
}

export function formatEntryDate(value: string) {
  if (!value) return 'Date not set';
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsedDate);
}
