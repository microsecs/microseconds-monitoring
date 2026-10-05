import "./globals.css";
import Link from "next/link";
import IncidentsNavLink from "@/components/IncidentsNavLink";
import AuthControls from "@/components/AuthControls";
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
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  return (
    <html lang="en">
      <body>
        {user && (
          <header className="siteHeader">
            <Link href="/tenants" className="headerBrand" aria-label="MicroSECONDS Monitoring">
              <img src="/microseconds-logo.png" alt="MicroSECONDS" className="headerLogo" />
              <small className="headerProductName">MONITORING</small>
            </Link>
            <nav className="topNav">
              <Link href="/tenants">Tenants</Link>
              <IncidentsNavLink/>
              <Link href="/signins">Sign-in History</Link>
              <Link href="/import">Import CSV</Link>
              <Link href="/settings">Settings</Link>
              <Link href="/support">Support</Link>
            </nav>
            <AuthControls/>
          </header>
        )}
        <div className="appShell">
          <main className="main">{children}</main>
          {user && (
            <footer className="siteFooter">
              <span>© 2026 MicroSECONDS Computer Consulting</span>
              <span className="footerDot">·</span>
              <span>MicroSECONDS Monitoring</span>
            </footer>
          )}
        </div>
      </body>
    </html>
  );
}
