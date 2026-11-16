"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { Sheet } from "@/components/ui/overlays";
import { parseFilters } from "@/lib/analytics/filters";
import { Chat } from "./chat";
import { AiOrb } from "./orb";

/** Side panel chat, expandable to the full-page assistant with the same scope. */
export function AssistantLauncher({ query, aiConfigured, scopeLabel }: { query: string; aiConfigured: boolean; scopeLabel: string }) {
  const [open, setOpen] = useState(false);
  const sp = useSearchParams();
  const filters = parseFilters(sp);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="press sheen group inline-flex h-9 items-center gap-2 rounded-xl bg-brand-gradient pl-1.5 pr-3.5 text-[13px] font-semibold text-white shadow-[var(--brand-glow)] hover:brightness-110"
      >
        <AiOrb size={24} className="ring-2 ring-white/35" />
        Assistent IA
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Assistent IA amb evidències" description={aiConfigured ? "Model connectat" : "Mode demostració sense model connectat"} wide>
        <div className="flex h-full flex-col">
          <div className="flex justify-end border-b border-line px-4 py-1.5">
            <Link href={`/assistent${query}`} onClick={() => setOpen(false)} className="press inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-muted hover:bg-g-50 hover:text-ink">
              <Maximize2 size={13} aria-hidden /> Pantalla completa
            </Link>
          </div>
          <div className="min-h-0 flex-1">
            <Chat filters={{ ...filters }} scopeLabel={scopeLabel} aiConfigured={aiConfigured} compact />
          </div>
        </div>
      </Sheet>
    </>
  );
}
