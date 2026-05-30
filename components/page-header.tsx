export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-950 md:text-3xl">
        {title}
      </h1>
      <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
