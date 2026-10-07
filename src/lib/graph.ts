const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const PROVIDER_REQUEST_TIMEOUT_MS = 30000;

async function providerFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS) });
}

export async function getAppAccessToken(tenantId: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be configured.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await providerFetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    }
  );

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    throw new Error(
      data?.error_description ||
        data?.error ||
        "Microsoft could not issue an application access token."
    );
  }

  return data.access_token as string;
}

async function graphGet(accessToken: string, url: string) {
  const res = await providerFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    const code = data?.error?.code ? `${data.error.code}: ` : "";
    const message =
      data?.error?.message || `Microsoft Graph request failed (${res.status}).`;
    throw new Error(`${code}${message}`);
  }

  return data;
}

export async function getRecentSignIns(accessToken: string, top = 250) {
  const safeTop = Math.max(1, Math.min(1000, Number(top) || 250));

  const select = [
    "id",
    "createdDateTime",
    "userDisplayName",
    "userPrincipalName",
    "appDisplayName",
    "ipAddress",
    "clientAppUsed",
    "location",
    "deviceDetail",
    "status",
    "conditionalAccessStatus",
    "riskDetail",
    "riskLevelAggregated",
    "riskLevelDuringSignIn",
    "riskState",
  ].join(",");

  const url =
    `${GRAPH_ROOT}/auditLogs/signIns` +
    `?$top=${safeTop}` +
    `&$orderby=createdDateTime desc` +
    `&$select=${encodeURIComponent(select)}`;

  const data = await graphGet(accessToken, url);
  return Array.isArray(data?.value) ? data.value : [];
}

export async function getSignInsSince(accessToken: string, since: string, maxEvents = 10000) {
  const select = [
    "id","createdDateTime","userDisplayName","userPrincipalName","appDisplayName",
    "ipAddress","clientAppUsed","location","deviceDetail","status",
    "conditionalAccessStatus","riskDetail","riskLevelAggregated","riskLevelDuringSignIn","riskState",
  ].join(",");
  const start = new Date(since).toISOString();
  let url = `${GRAPH_ROOT}/auditLogs/signIns?$top=500&$filter=${encodeURIComponent(`createdDateTime ge ${start}`)}&$orderby=createdDateTime asc&$select=${encodeURIComponent(select)}`;
  const all: any[] = [];
  while (url && all.length < maxEvents) {
    const data = await graphGet(accessToken, url);
    all.push(...(Array.isArray(data?.value) ? data.value : []));
    url = typeof data?.["@odata.nextLink"] === "string" ? data["@odata.nextLink"] : "";
  }
  return all.slice(0, maxEvents);
}

export async function getOrganizationProfile(accessToken: string) {
  const url =
    `${GRAPH_ROOT}/organization` +
    `?$select=${encodeURIComponent("id,displayName,verifiedDomains")}`;

  const data = await graphGet(accessToken, url);
  const org = Array.isArray(data?.value) ? data.value[0] : null;

  if (!org) return null;

  const defaultDomain =
    Array.isArray(org.verifiedDomains)
      ? org.verifiedDomains.find((d: any) => d?.isDefault)?.name ||
        org.verifiedDomains.find((d: any) => d?.isInitial)?.name ||
        org.verifiedDomains[0]?.name
      : null;

  return {
    id: org.id || null,
    displayName: org.displayName || null,
    defaultDomain: defaultDomain || null,
  };
}
