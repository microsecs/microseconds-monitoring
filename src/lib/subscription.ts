export type OrganizationSubscription = {
  id: string;
  plan?: string | null;
  subscription_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
};

export function subscriptionState(org: OrganizationSubscription, now = new Date()) {
  const status = String(org.subscription_status || "inactive").toLowerCase();
  const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const validTrialEnd = trialEnd && !Number.isNaN(trialEnd.getTime()) ? trialEnd : null;
  const trialExpired = status === "trialing" && validTrialEnd ? validTrialEnd.getTime() <= now.getTime() : false;
  const effectiveStatus = trialExpired ? "expired" : status;
  const daysRemaining = effectiveStatus === "trialing" && validTrialEnd
    ? Math.max(0, Math.ceil((validTrialEnd.getTime() - now.getTime()) / 86400000))
    : 0;
  const writable = effectiveStatus === "active" || effectiveStatus === "trialing" || effectiveStatus === "past_due";
  return { status: effectiveStatus, daysRemaining, trialEnd: validTrialEnd, writable };
}

export function assertOrganizationWritable(org: OrganizationSubscription) {
  const state = subscriptionState(org);
  if (!state.writable) {
    throw new Error(state.status === "expired"
      ? "Your 30-day trial has expired. Subscribe to resume monitoring and make changes. Your existing data remains available."
      : "This subscription is not active. Subscribe to resume monitoring and make changes. Your existing data remains available.");
  }
  return state;
}
