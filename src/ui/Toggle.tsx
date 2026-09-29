export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center gap-3 text-left"
    >
      <span className="flex-1">
        <span className="block">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-new'}`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`}
        />
      </span>
    </button>
  );
}
