"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Field, inputClass, selectClass } from "@/components/ui/primitives";

export function InterventionForm({ hasCircuit }: { hasCircuit: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [date, setDate] = useState(sp.get("intervention") ?? "");
  const [months, setMonths] = useState(sp.get("window") ?? "12");
  const apply = () => {
    const next = new URLSearchParams(sp.toString());
    if (date) next.set("intervention", date);
    else next.delete("intervention");
    next.set("window", months);
    router.replace(`${pathname}?${next.toString()}#intervencio`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Data documentada de la intervenció" className="w-48">
        <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} disabled={!hasCircuit} />
      </Field>
      <Field label="Finestra" className="w-32">
        <select className={selectClass} value={months} onChange={(e) => setMonths(e.target.value)} disabled={!hasCircuit}>
          {["6", "12", "18", "24"].map((m) => (
            <option key={m} value={m}>
              {m} mesos
            </option>
          ))}
        </select>
      </Field>
      <Button variant="secondary" onClick={apply} disabled={!hasCircuit || !date}>
        Calcular abans/després
      </Button>
      {!hasCircuit ? <p className="text-[12.5px] text-muted">Selecciona un circuit a la barra de filtres.</p> : null}
    </div>
  );
}
