import * as React from "react";
import { cn } from "@/lib/format";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function CardHeader({ title, subtitle, actions, className, as: Tag = "h2" }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string; as?: "h2" | "h3" }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5", className)}>
      <div className="min-w-0">
        <Tag className="text-[15.5px] font-semibold leading-snug tracking-[-0.01em] text-ink">{title}</Tag>
        {subtitle ? <p className="mt-0.5 text-[13px] leading-snug text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-surface-2 text-muted border-line",
  brand: "bg-brand-tint text-brand-dark border-g-200/70 dark:border-transparent dark:text-[var(--focus)]",
  warn: "bg-warn-tint text-warn border-transparent",
  danger: "bg-danger-tint text-danger border-transparent",
  info: "bg-info-tint text-info border-transparent",
  synthetic: "bg-[repeating-linear-gradient(135deg,var(--warning-tint),var(--warning-tint)_6px,transparent_6px,transparent_10px)] text-warn border-warn/40",
} as const;

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTones }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-4 whitespace-nowrap", badgeTones[tone], className)} {...props} />;
}

const buttonVariants = {
  primary: "sheen bg-brand-gradient text-white border-transparent shadow-[var(--brand-glow)] hover:brightness-110",
  secondary: "bg-surface text-ink border-line hover:border-g-300 hover:bg-g-50 shadow-[0_1px_2px_rgb(16_40_24/0.05)]",
  ghost: "bg-transparent text-muted border-transparent hover:bg-g-50 hover:text-ink",
  danger: "bg-danger text-white border-transparent hover:opacity-90",
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants; size?: "sm" | "md" | "icon" };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "secondary", size = "md", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "press inline-flex items-center justify-center gap-1.5 rounded-xl border font-medium disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-8 px-2.5 text-[13px]",
        size === "md" && "h-9 px-3.5 text-sm",
        size === "icon" && "h-8 w-8 rounded-lg text-sm",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
});

export function linkButtonClass(variant: keyof typeof buttonVariants = "secondary", size: "sm" | "md" = "md") {
  return cn(
    "press inline-flex items-center justify-center gap-1.5 rounded-xl border font-medium",
    size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
    buttonVariants[variant],
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

export function EmptyState({ title, children, icon }: { title: string; children?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon ? <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-g-50 text-g-600 dark:text-[var(--focus)]">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {children ? <div className="max-w-md text-[13px] leading-relaxed text-muted">{children}</div> : null}
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">{label}</span>
      {children}
    </label>
  );
}

export const selectClass =
  "h-9 w-full min-w-0 rounded-xl border border-line bg-surface px-3 pr-8 text-sm text-ink transition-[border-color,box-shadow] duration-150 hover:border-g-300 focus-visible:border-g-400 focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--g-400)_18%,transparent)] focus-visible:outline-none disabled:opacity-60 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2360665f%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_10px_center] bg-no-repeat";

export const inputClass = "h-9 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-subtle transition-[border-color,box-shadow] duration-150 hover:border-g-300 focus-visible:border-g-400 focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--g-400)_18%,transparent)] focus-visible:outline-none";

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="tabular mt-0.5 text-[15px] font-semibold text-ink">{value}</dd>
      {hint ? <dd className="text-[12px] text-subtle">{hint}</dd> : null}
    </div>
  );
}

export function Note({ tone = "info", children, className }: { tone?: "info" | "warn" | "danger" | "neutral"; children: React.ReactNode; className?: string }) {
  const tones = {
    info: "border-info/25 bg-info-tint text-ink",
    warn: "border-warn/30 bg-warn-tint text-ink",
    danger: "border-danger/30 bg-danger-tint text-ink",
    neutral: "border-line bg-surface-2 text-ink",
  } as const;
  return <div className={cn("rounded-2xl border px-4 py-3 text-[13px] leading-relaxed", tones[tone], className)}>{children}</div>;
}
