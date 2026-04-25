import { format, parseISO, formatDistanceToNow } from 'date-fns';

export function formatDate(dateStr: string): string {
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return dateStr; }
}
export function formatDateTime(dateStr: string): string {
  try { return format(parseISO(dateStr), 'MMM d, yyyy HH:mm'); } catch { return dateStr; }
}
export function formatRelative(dateStr: string): string {
  try { return formatDistanceToNow(parseISO(dateStr), { addSuffix: true }); } catch { return dateStr; }
}
export function formatCurrency(amount: number, currency: string = 'KES'): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}
export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}
export function getInitials(firstName?: string, lastName?: string): string {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
}
