"use client";

/** A segmented control on mist: All / You, Favourites / Downloaded. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number; accent?: boolean }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex min-w-0 gap-1 rounded-[10px] bg-[color:var(--kb-sand)] p-1 ${className}`}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={`flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[6px] px-2 text-[15px] ${
              on ? "kb-seg-on font-semibold text-[color:var(--kb-ink)]" : "font-medium text-[color:var(--kb-ink-2)]"
            }`}
          >
            <span className="truncate">{option.label}</span>
            {option.count !== undefined ? (
              <span className={`num text-[14px] ${option.accent ? "text-[color:var(--kb-ember)]" : ""}`}>{option.count.toLocaleString("en-AU")}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
