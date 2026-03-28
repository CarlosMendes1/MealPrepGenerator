export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1)   return 'agora mesmo';
  if (diffMin < 60)  return `há ${diffMin} min`;
  if (diffHr < 24)   return `há ${diffHr}h`;
  if (diffDay === 1) return 'ontem';
  if (diffDay < 7)   return `há ${diffDay} dias`;
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}
