import Link from "next/link";
import { getDevOrganization, getRecentHistory } from "@/lib/history";

export const dynamic = "force-dynamic";

function level(row: any) {
  const v = String(row.risk_level || "").toLowerCase();
  if (v.includes("critical")) return "Critical";
  if (v.includes("suspicious") || v.includes("high")) return "Suspicious";
  if (v.includes("review") || v.includes("medium")) return "Review";
  return "Normal";
}

export default async function DashboardPage() {
  let rows: any[] = [];
  let org: any = null;
  let error = "";

  try {
    [rows, org] = await Promise.all([
      getRecentHistory(500),
      getDevOrganization(),
    ]);
  } catch (e: any) {
    error = e?.message || "Could not load security history.";
  }

  const uniqueIps = new Set(rows.map((r) => r.ip_address).filter(Boolean)).size;
  const critical = rows.filter((r) => level(r) === "Critical").length;
  const suspicious = rows.filter((r) =>
    ["Critical", "Suspicious"].includes(level(r))
  ).length;
  const review = rows.filter((r) => level(r) === "Review").length;

  return (
    <main style={{ padding: "28px", maxWidth: 1400, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          marginBottom: 22,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Security Dashboard</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.7 }}>
            {org?.name || "MicroSECONDS 365 Security"} · Stored sign-in history
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href="/import"
            style={{
              padding: "10px 14px",
              border: "1px solid #bbb",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            Import CSV
          </Link>
          <Link
            href="/signins"
            style={{
              padding: "10px 14px",
              border: "1px solid #bbb",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            View Sign-ins
          </Link>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 14,
            border: "1px solid #c66",
            borderRadius: 8,
            marginBottom: 18,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[
          ["Stored Sign-ins", rows.length],
          ["Unique IPs", uniqueIps],
          ["Needs Attention", suspicious],
          ["Critical", critical],
          ["Review", review],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 18,
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 700 }}>{value}</div>
            <div style={{ opacity: 0.7, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "15px 18px",
            fontWeight: 700,
            borderBottom: "1px solid #ddd",
          }}
        >
          Recent Security Activity
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
          >
            <thead>
              <tr>
                {[
                  "Risk",
                  "Time",
                  "User",
                  "IP Address",
                  "Location",
                  "Application",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 25).map((r: any) => (
                <tr key={r.id}>
                  <td
                    style={{
                      padding: 12,
                      borderBottom: "1px solid #eee",
                      fontWeight: 700,
                    }}
                  >
                    {level(r)}
                    {r.risk_score != null ? ` (${r.risk_score})` : ""}
                  </td>
                  <td
                    style={{
                      padding: 12,
                      borderBottom: "1px solid #eee",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.event_time
                      ? new Date(r.event_time).toLocaleString()
                      : "—"}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                    {r.user_principal_name || "—"}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                    {r.ip_address || "—"}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                    {[r.city, r.region, r.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                    {r.app_name || "—"}
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                    {r.status || "—"}
                  </td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: 24,
                      textAlign: "center",
                      opacity: 0.65,
                    }}
                  >
                    No stored sign-ins yet. Import a Microsoft CSV to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ opacity: 0.55, fontSize: 12, marginTop: 12 }}>
        Development view: showing the most recent 500 stored sign-ins.
      </p>
    </main>
  );
}
