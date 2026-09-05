interface BreadcrumbsProps {
  items: readonly string[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={item} aria-current={index === items.length - 1 ? "page" : undefined}>
            {item}
          </li>
        ))}
      </ol>
    </nav>
  );
}
