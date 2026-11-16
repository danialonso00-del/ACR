import { cn } from "@/lib/format";

/** Animated brand-green orb that stands for the assistant; spins faster and pulses while it works. */
export function AiOrb({ size = 28, busy = false, halo = false, className }: { size?: number; busy?: boolean; halo?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("ai-orb inline-block", className)} data-busy={busy} style={{ width: size, height: size }}>
      {halo ? <span className="ai-halo" /> : null}
      <span className="ai-orb-core" />
      {busy ? <span className="ai-orb-ring" /> : null}
    </span>
  );
}
