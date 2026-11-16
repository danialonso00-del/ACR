import "server-only";
import { cookies } from "next/headers";
import { LOCALES, translate, type Locale, type MessageKey } from "./messages";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get("arc_locale")?.value;
  return (LOCALES as readonly string[]).includes(c ?? "") ? (c as Locale) : "ca";
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars) };
}
