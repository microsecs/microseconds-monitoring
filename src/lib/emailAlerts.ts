import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendIncidentAlerts(params: {
  organizationId: string;
  incident: any;
  signin: any;
  tenantName: string;
  recipients: string[];
}) {
  const recipients = Array.from(
    new Set((params.recipients || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean))
  );

  if (!recipients.length) return { sent: 0 };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0 };

  const supabase = getSupabaseAdmin();
  let sent = 0;

  const successful =
    String(params.signin?.status || "").toLowerCase() === "success";

  const from =
    process.env.SECURITY_ALERT_FROM ||
    "MicroSECONDS 365 Security <security@microseconds.com>";

  const subject =
    `[${String(params.incident?.severity || "review").toUpperCase()}] ` +
    `${successful ? "Suspicious successful" : "Suspicious failed"} Microsoft 365 sign-in`;

  const reasons = Array.isArray(params.incident?.reasons)
    ? params.incident.reasons
    : [];

  for (const recipient of recipients) {
    const { data: existing } = await supabase
      .from("email_alert_log")
      .select("id")
      .eq("incident_id", params.incident.id)
      .eq("recipient", recipient)
      .maybeSingle();

    if (existing) continue;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto">
        <h2>MicroSECONDS 365 Security Alert</h2>
        <p><strong>Tenant:</strong> ${escapeHtml(params.tenantName)}</p>
        <p><strong>User:</strong> ${escapeHtml(params.signin?.user_display_name || params.signin?.user_principal_name || "Unknown")}</p>
        <p><strong>Time:</strong> ${escapeHtml(params.signin?.event_time || "Unknown")}</p>
        <p><strong>IP:</strong> ${escapeHtml(params.signin?.ip_address || "Unknown")}</p>
        <p><strong>Location:</strong> ${escapeHtml([params.signin?.city, params.signin?.region, params.signin?.country].filter(Boolean).join(", ") || "Unknown")}</p>
        <p><strong>Application:</strong> ${escapeHtml(params.signin?.app_name || "Unknown")}</p>
        <p><strong>Result:</strong> ${escapeHtml(params.signin?.status || "Unknown")}</p>
        <p><strong>Risk score:</strong> ${escapeHtml(params.incident?.risk_score ?? "Unknown")}/100</p>
        <p><strong>Why it was flagged:</strong><br>${reasons.map((r:any)=>escapeHtml(r)).join("<br>") || "Risk threshold exceeded"}</p>
        <p><strong>Analysis:</strong><br>${escapeHtml(params.incident?.ai_summary || params.incident?.summary || "")}</p>
        <p>Recommended action: verify whether the sign-in was expected and investigate further if it was not.</p>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `security-incident/${params.incident.id}/${recipient}`.slice(0, 250),
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        html,
      }),
    });

    if (!response.ok) continue;

    const data: any = await response.json();

    const { error } = await supabase
      .from("email_alert_log")
      .insert({
        organization_id: params.organizationId,
        incident_id: params.incident.id,
        recipient,
        provider_message_id: data?.id || null,
      });

    if (!error) sent++;
  }

  return { sent };
}
