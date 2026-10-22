// Only known internal login destinations are accepted, never arbitrary redirects.
export const passwordReturnPath = (back: string | null): string => {
  if (back === "sd" || back === "/servicedesk/login") return "/servicedesk/login";
  if (back === "/editais/login") return "/editais/login";
  if (back === "/fomento/login") return "/fomento/login";
  return "/login";
};