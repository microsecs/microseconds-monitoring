import "./globals.css";
import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import NavigationProgress from "@/components/NavigationProgress";
import ScrollToTopOnRoute from "@/components/ScrollToTopOnRoute";
import IncidentsNavLink from "@/components/IncidentsNavLink";
import AuthControls from "@/components/AuthControls";
import ProductAdminNavLink from "@/components/ProductAdminNavLink";
import TrialStatusBanner from "@/components/TrialStatusBanner";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const metadata = {
  title: "MicroSECONDS Monitoring",
  description: "Identity security monitoring for Microsoft 365 and Google Workspace",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const storedCount = cookieStore.get("ms_pending_incident_count")?.value;
  const initialIncidentCount = storedCount !== undefined && /^\d{1,7}$/.test(storedCount) ? Number(storedCount) : 0;
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  return (
    <html lang="en">
      <body>
        {user && <Suspense fallback={null}><NavigationProgress /></Suspense>}
        <ScrollToTopOnRoute />
        {user && (
          <header className="siteHeader">
            <Link href="/tenants" className="headerBrand" aria-label="MicroSECONDS Monitoring">
              <img src="/microseconds-logo.png" alt="MicroSECONDS" className="headerLogo" />
              <small className="headerProductName">MONITORING</small>
            </Link>
            <nav className="topNav">
              <Link href="/tenants">Tenants</Link>
              <IncidentsNavLink initialCount={initialIncidentCount}/>
              <Link href="/signins">Sign-in History</Link>
              <Link href="/import">Import CSV</Link>
              <Link href="/settings">Settings</Link>
              <Link href="/support">Support</Link>
              <ProductAdminNavLink/>
            </nav>
            <AuthControls/>
          </header>
        )}
        <div className="appShell">
          {user && <TrialStatusBanner/>}
          <main className="main">{children}</main>
          {user && (
            <footer className="siteFooter">
              <span>© {new Date().getFullYear()} MicroSECONDS Computer Consulting</span>
              <span className="footerDot">·</span>
              <span>MicroSECONDS Monitoring</span>
              <span className="footerDot">·</span>
              <Link href="/terms">Terms</Link>
              <span className="footerDot">·</span>
              <Link href="/privacy">Privacy</Link>
            </footer>
          )}
        </div>
      </body>
    </html>
  );
}
