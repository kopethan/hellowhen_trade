import Link from 'next/link';

export function InventoryEmptyState({
  title,
  body,
  href,
  actionLabel,
}: {
  title: string;
  body: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <Link href={href} className="inventory-empty-state">
      <span className="inventory-empty-state__plus">+</span>
      <strong>{title}</strong>
      <span>{body}</span>
      <em>{actionLabel}</em>
    </Link>
  );
}
