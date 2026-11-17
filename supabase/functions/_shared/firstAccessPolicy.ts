/** Match only a contact already recorded by the institution. Never trust a new contact as identity. */
export function matchesInstitutionalContact(stored: unknown, supplied: unknown): boolean {
  return typeof stored === "string" && typeof supplied === "string" &&
    stored.trim().length > 0 && stored.trim().toLowerCase() === supplied.trim().toLowerCase();
}
export function canManageFomentoOrganization(role: string | null, callerOrg: string | null, targetOrg: unknown) {
  return typeof targetOrg === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetOrg) &&
    (role === "superadmin" || (role === "admin" && !!callerOrg && callerOrg === targetOrg));
}
export async function findAuthUserByEmail(api: any, email: string) {
  const normalized = email.trim().toLowerCase();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await api.listUsers({ page, perPage: 200 });
    if (error) throw error;
    if (!data || !Array.isArray(data.users)) throw new Error("User lookup unavailable");
    const user = data.users.find((u: { email?: string }) => u.email?.toLowerCase() === normalized);
    if (user) return user;
    if (data.users.length < 200) return null;
  }
  // Never treat an incomplete lookup as proof that the account does not exist.
  throw new Error("User lookup pagination limit reached");
}
/**
 * A first-access account may be re-sent its confirmation only while it was never confirmed nor used,
 * and only to the same address already proven against the institutional record.
 */
export function canResendUnconfirmedSignup(
  user: { email?: string | null; email_confirmed_at?: string | null; last_sign_in_at?: string | null } | null | undefined,
  suppliedEmail: string,
): boolean {
  return !!user && !user.email_confirmed_at && !user.last_sign_in_at &&
    typeof user.email === "string" && user.email.trim().toLowerCase() === suppliedEmail.trim().toLowerCase();
}
