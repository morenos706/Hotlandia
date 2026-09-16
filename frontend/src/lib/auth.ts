export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

const TOKEN_KEY = 'contractus_access_token';
const USER_KEY = 'contractus_user';

export function saveSession(accessToken: string, user: SessionUser) {
  window.localStorage.setItem(TOKEN_KEY, accessToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function hasSession(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem(TOKEN_KEY));
}
