import { Suspense } from "react";
import { PageFrame } from "@/components/shell/page-frame";
import { Card } from "@/components/ui/primitives";
import { ExplorerTable } from "@/features/explorer/explorer-table";
import { loadContext, type SearchParams } from "@/lib/context";
import { filtersToQuery } from "@/lib/analytics/filters";
import { fmtNum } from "@/lib/format";

export const metadata = { title: "Caracteritzacions" };

export default async function ExplorerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await loadContext(searchParams);
  const { scope, t, locale } = ctx;
  return (
    <PageFrame
      ctx={ctx}
      title={t("samples.title")}
      description={
        scope ? (
          <>
            {fmtNum(scope.inScope.length, 0, locale)} butlletins a l&apos;àmbit ({fmtNum(scope.valid.length, 0, locale)} analitzables). Les mostres excloses es mostren ratllades; obre una fitxa per veure pesades, fórmula, fotos i traçabilitat.
          </>
        ) : null
      }
    >
      <Card className="overflow-hidden">
        <Suspense fallback={<div className="skeleton m-4 h-96" />}>
          <ExplorerTable baseQuery={filtersToQuery(ctx.filters, { from: scope?.filters.from, to: scope?.filters.to })} />
        </Suspense>
      </Card>
    </PageFrame>
  );
}
