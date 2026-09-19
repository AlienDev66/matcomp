const STORAGE_KEY = "matcomp_mesa_token";

export function getMesaToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setMesaToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) sessionStorage.removeItem(STORAGE_KEY);
  else sessionStorage.setItem(STORAGE_KEY, token);
}

export function mesaTokenFromSearch(search: string): string | null {
  try {
    const q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    return q.get("token");
  } catch {
    return null;
  }
}
