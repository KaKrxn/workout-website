import Link from "next/link";
import { I18nProvider } from "@/components/i18n-provider";
import { Brand } from "@/components/app-header";
import { DesignControls } from "@/components/design-controls";
import { getDictionary, getLocale } from "@/lib/i18n";
export default async function AuthLayout({ children }: LayoutProps<"/">) {
 const [dict,locale] = await Promise.all([getDictionary(),getLocale()]);
 return <I18nProvider dict={dict}><div className="min-h-dvh"><header className="ft-public-header"><Brand href="/"/><div className="flex items-center gap-4"><DesignControls locale={locale}/><Link href="/" className="text-lg font-bold">{locale === "th" ? "หน้าหลัก" : "Home"}</Link></div></header><main className="ft-auth-main">{children}</main></div></I18nProvider>;
}
