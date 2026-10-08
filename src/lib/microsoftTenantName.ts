/** Microsoft names: never overwrite a customer-selected friendly name. */
export function isGeneratedMicrosoftName(name: unknown, tenantId: string): boolean {
  const value = String(name || "").trim();
  return !value || value === tenantId || /^Microsoft Tenant(?:\s+[0-9a-f]{8})?$/i.test(value);
}

/** Sign-in UPNs provide a usable domain when Graph /organization isn't authorized. */
export function domainFromMicrosoftSignIns(rows: any[]): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const upn = String(row?.userPrincipalName || "").trim().toLowerCase();
    const domain = upn.includes("@") ? upn.split("@").pop()! : "";
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain)) continue;
    if (domain.endsWith(".onmicrosoft.com")) continue;
    counts.set(domain, (counts.get(domain) || 0) + 1);
  }
  return [...counts.entries()].sort((a,b) => b[1] - a[1])[0]?.[0] || null;
}
