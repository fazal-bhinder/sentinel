export function Panel({
  eyebrow,
  title,
  right,
  children,
  className = "",
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-panel/80 ${className}`}
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3.5">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="display mt-1 text-[17px] leading-none text-text">{title}</h2>
        </div>
        {right}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
