"use client";
import * as React from "react";
import { Dialog, Popover, Tabs as RTabs } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

export function InfoPopover({ label, children, trigger, className }: { label: string; children: React.ReactNode; trigger: React.ReactNode; className?: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild aria-label={label}>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          collisionPadding={12}
          className={cn("dialog-content z-50 w-[min(92vw,380px)] rounded-2xl border border-line bg-surface p-4 text-[13px] leading-relaxed text-ink shadow-[var(--shadow-pop)]", className)}
        >
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-subtle">{label}</p>
          <div className="prose-arc">{children}</div>
          <Popover.Arrow className="fill-[var(--surface)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function Sheet({ open, onOpenChange, title, description, children, side = "right", wide = false }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; side?: "right" | "left"; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fixed inset-0 z-40 bg-[rgb(8_30_16/0.28)] backdrop-blur-[3px]" />
        <Dialog.Content
          data-side={side}
          className={cn(
            "sheet-content fixed inset-y-0 z-50 flex w-full flex-col overflow-hidden border-line bg-surface shadow-[var(--shadow-pop)] outline-none sm:inset-y-2 sm:rounded-3xl sm:border",
            side === "right" ? "right-0 border-l sm:right-2" : "left-0 border-r sm:left-2",
            wide ? "max-w-[740px]" : "max-w-[420px]",
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="min-w-0">
              <Dialog.Title className="text-[15.5px] font-semibold tracking-[-0.01em]">{title}</Dialog.Title>
              {description ? <Dialog.Description className="text-[12.5px] text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className="press rounded-xl p-1.5 text-muted hover:bg-g-50 hover:text-ink" aria-label="Tancar">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Modal({ open, onOpenChange, title, children, className }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode; className?: string }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay fixed inset-0 z-40 bg-[rgb(8_30_16/0.5)] backdrop-blur-[3px]" />
        <Dialog.Content className={cn("dialog-content fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[min(96vw,1100px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-3xl border border-line bg-surface shadow-[var(--shadow-pop)] outline-none", className)}>
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
            <Dialog.Title className="truncate text-[15px] font-semibold">{title}</Dialog.Title>
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
            <Dialog.Close className="press rounded-xl p-1.5 text-muted hover:bg-g-50 hover:text-ink" aria-label="Tancar">
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Tabs({ tabs, defaultValue, className }: { tabs: { value: string; label: React.ReactNode; content: React.ReactNode }[]; defaultValue?: string; className?: string }) {
  return (
    <RTabs.Root defaultValue={defaultValue ?? tabs[0]?.value} className={className}>
      <RTabs.List className="flex gap-1 overflow-x-auto border-b border-line px-2" aria-label="Seccions">
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            className="relative -mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted transition-colors duration-200 hover:text-ink data-[state=active]:border-g-500 data-[state=active]:text-ink"
          >
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {tabs.map((t) => (
        <RTabs.Content key={t.value} value={t.value} className="animate-in outline-none">
          {t.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}
