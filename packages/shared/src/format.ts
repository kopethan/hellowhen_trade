export function formatCredits(amount: number): string {
  return `${amount.toLocaleString()} credits`;
}

export function truncateText(value: string, max = 120): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3)).trim()}...`;
}
