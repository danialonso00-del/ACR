"use client";
import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/format";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

/** Accessible searchable single-select (ARIA 1.2 combobox pattern). */
export function Combobox({ options, value, onChange, placeholder, label, emptyLabel, className }: { options: ComboOption[]; value: string | undefined; onChange: (v: string | undefined) => void; placeholder: string; label: string; emptyLabel: string; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
    const list = q ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().includes(q)) : options;
    return list.slice(0, 80);
  }, [options, query]);

  const choose = (v: string | undefined) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${id}-opt-${active}` : undefined}
          className="h-9 w-full rounded-xl border border-line bg-surface pl-3 pr-14 text-sm text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-150 hover:border-g-300 focus-visible:border-g-400 focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--g-400)_18%,transparent)] focus-visible:outline-none"
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : (selected?.label ?? "")}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open && filtered[active]) {
              e.preventDefault();
              choose(filtered[active]!.value);
              inputRef.current?.blur();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 text-subtle">
          {value ? (
            <button
              type="button"
              className="pointer-events-auto rounded p-0.5 hover:text-ink"
              aria-label={`${emptyLabel}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(undefined)}
            >
              <X size={14} />
            </button>
          ) : null}
          <ChevronDown size={14} aria-hidden />
        </div>
      </div>
      {open ? (
        <ul id={`${id}-list`} role="listbox" aria-label={label} className="dialog-content absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-72 overflow-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)] sm:min-w-[320px]" data-state="open">
          <li
            role="option"
            aria-selected={!value}
            className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] text-muted hover:bg-g-50"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(undefined)}
          >
            {emptyLabel}
          </li>
          {filtered.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={cn("cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] transition-colors", i === active ? "bg-g-50 text-ink" : "text-ink", o.value === value && "font-semibold")}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o.value)}
            >
              <span className="block truncate">{o.label}</span>
              {o.hint ? <span className="block truncate text-[11.5px] text-subtle">{o.hint}</span> : null}
            </li>
          ))}
          {filtered.length === 0 ? <li className="px-2.5 py-2 text-[13px] text-subtle">—</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
