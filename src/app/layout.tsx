import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@fontsource-variable/inter";
import "./globals.css";
import { Sidebar, type NavLabels } from "@/components/shell/sidebar";
import { getT } from "@/i18n/server";

export const metadata: Metadata = {
  title: { default: "ARC · Intel·ligència de Residus", template: "%s · ARC Intel·ligència de Residus" },
  description: "Demostració tecnològica de MTI: exploració, patrons i consulta amb evidències de les caracteritzacions públiques de FORM de l'ARC.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f2f6f0",
  width: "device-width",
  initialScale: 1,
};

// Applies the stored theme before first paint (light by default).
const themeScript = `try{var t=localStorage.getItem("arc_theme");if(t==="dark")document.documentElement.dataset.theme="dark";}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getT();
  const labels: NavLabels = {
    appName: t("app.name"),
    demo: t("app.demo"),
    demoNote: t("app.demoNote"),
    menu: t("nav.menu"),
    language: t("common.language"),
    theme: t("common.theme"),
    light: t("common.light"),
    dark: t("common.dark"),
    groups: { explore: t("nav.group.explore"), ai: t("nav.group.ai"), data: t("nav.group.data") },
    promo: { title: t("nav.promo.title"), text: t("nav.promo.text"), cta: t("nav.promo.cta") },
    items: [
      { href: "/", label: t("nav.overview"), icon: "overview", group: "explore" },
      { href: "/territori", label: t("nav.territory"), icon: "territory", group: "explore" },
      { href: "/caracteritzacions", label: t("nav.samples"), icon: "samples", group: "explore" },
      { href: "/patrons", label: t("nav.patterns"), icon: "patterns", group: "explore" },
      { href: "/arxiu-visual", label: t("nav.archive"), icon: "archive", group: "explore" },
      { href: "/assistent", label: t("nav.assistant"), icon: "assistant", group: "ai" },
      { href: "/informes", label: t("nav.reports"), icon: "reports", group: "ai" },
      { href: "/fonts", label: t("nav.sources"), icon: "sources", group: "data" },
    ],
  };
  return (
    <html lang={locale} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject attributes on <body> */}
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow">
          Saltar al contingut
        </a>
        <Suspense fallback={<div className="hidden w-[244px] lg:block" />}>
          <Sidebar labels={labels} locale={locale} />
        </Suspense>
        <div className="lg:pl-[256px]">{children}</div>
      </body>
    </html>
  );
}
