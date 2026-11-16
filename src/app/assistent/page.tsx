import { Activity, BarChart3, BookOpen, FileText, FlaskConical, GitCompare, Images, KeyRound, Lock, Wrench } from "lucide-react";
import { PageFrame } from "@/components/shell/page-frame";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Chat } from "@/features/assistant/chat";
import { AiOrb } from "@/features/assistant/orb";
import { loadContext, scopeDescription, type SearchParams } from "@/lib/context";
import { AI_CONFIG } from "@/lib/ai/agent";
import { TOOL_DESCRIPTIONS } from "@/lib/ai/tools";

export const metadata = { title: "Assistent IA" };

const TOOL_ICON: Record<string, typeof Wrench> = {
  get_metric: BarChart3,
  compare_circuits: GitCompare,
  find_anomalies: Activity,
  get_sample: FlaskConical,
  search_documents: BookOpen,
  get_photos: Images,
  create_report: FileText,
};

export default async function AssistantPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await loadContext(searchParams);
  const sample = typeof ctx.sp.sample === "string" && /^\d{1,9}$/.test(ctx.sp.sample) ? ctx.sp.sample : undefined;
  const f = ctx.scope?.filters ?? ctx.filters;
  return (
    <PageFrame
      ctx={ctx}
      hideAssistant
      title={ctx.t("assistant.title")}
      description="La IA interpreta, consulta eines i redacta; els càlculs s'executen en codi sobre dades autoritzades. Cada resposta separa dada observada, hipòtesi i recomanació."
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="relative min-w-0 overflow-hidden">
          <span aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-72 w-[520px] -translate-x-1/2 rounded-full bg-g-100/60 blur-3xl dark:bg-g-200/30" />
          <div className="relative">
            <Chat filters={{ ...f }} scopeLabel={scopeDescription(ctx)} aiConfigured={ctx.aiConfigured} sampleId={sample} />
          </div>
        </Card>
        <div className="stagger flex flex-col gap-4">
          <Card className="overflow-hidden">
            <div className="relative overflow-hidden bg-brand-gradient px-5 py-4 text-white">
              <span aria-hidden className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-lime/40 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <AiOrb size={36} className="ring-2 ring-white/40" />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">{ctx.aiConfigured ? "Model connectat" : "Consultes guiades"}</p>
                  <p className="truncate text-[12px] text-white/80">{ctx.aiConfigured ? `${AI_CONFIG.model} · esforç ${AI_CONFIG.effort}` : "Sense model de llenguatge al servidor"}</p>
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 px-5 py-4 text-[12.5px]">
              <dt className="text-muted">Estat</dt>
              <dd className="font-medium">{ctx.aiConfigured ? "Model connectat (servidor)" : "Sense model (consultes guiades)"}</dd>
              <dt className="text-muted">Model</dt>
              <dd>{ctx.aiConfigured ? AI_CONFIG.model : "—"}</dd>
              <dt className="text-muted">Esforç</dt>
              <dd>{AI_CONFIG.effort}</dd>
              <dt className="text-muted">Pressupost</dt>
              <dd>
                ≤ {AI_CONFIG.maxRounds} rondes d&apos;eines · ≤ {Math.round(AI_CONFIG.tokenBudget / 1000)}k tokens · ≤ {Math.round(AI_CONFIG.timeoutMs / 1000)} s
              </dd>
              <dt className="text-muted">Secrets</dt>
              <dd className="inline-flex items-center gap-1">
                <KeyRound size={12} className="text-g-600 dark:text-[var(--focus)]" aria-hidden /> Només al servidor
              </dd>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Eines disponibles" subtitle="Tipades i de només lectura; sense SQL arbitrari" />
            <ul className="flex flex-col gap-1 px-3 pb-3 pt-3 text-[12.5px]">
              {Object.entries(TOOL_DESCRIPTIONS).map(([name, d]) => {
                const Icon = TOOL_ICON[name] ?? Wrench;
                return (
                  <li key={name} className="flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-g-50">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-g-50 text-g-700 dark:text-[var(--focus)]">
                      <Icon size={15} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <code className="text-[12px] font-semibold text-ink">{name}</code>
                      <p className="leading-snug text-muted">{d}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <div className="flex gap-2.5 rounded-2xl border border-line bg-surface/70 px-4 py-3 text-[12.5px] leading-relaxed text-muted">
            <Lock size={14} className="mt-0.5 shrink-0 text-g-600 dark:text-[var(--focus)]" aria-hidden />
            <p>
              Documents, observacions i contingut web es tracten com a dades no fiables, mai com a instruccions. No s&apos;introdueix la base de dades al prompt: el model només veu els resultats agregats de les eines.
            </p>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
