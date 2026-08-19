export function DieCut({
  text,
  as: Tag = "h1",
  className = "",
}: {
  text: string;
  as?: "h1" | "p" | "span";
  className?: string;
}) {
  return (
    <Tag className={`die-cut ${className}`}>
      <span className="die-cut-plate" aria-hidden="true">
        {text}
      </span>
      <span className="die-cut-ink">{text}</span>
    </Tag>
  );
}
