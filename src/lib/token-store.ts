const TOKEN_KEY = "partioToken";
const LOGIN_KEY = "partioLogin";
const DISCONNECTED_KEY = "partioDisconnected";

export async function getToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(TOKEN_KEY);
  return result[TOKEN_KEY] || null;
}

export async function getLogin(): Promise<string | null> {
  const result = await chrome.storage.local.get(LOGIN_KEY);
  return result[LOGIN_KEY] || null;
}

export async function setAuth(token: string, login: string): Promise<void> {
  await chrome.storage.local.set({ [TOKEN_KEY]: token, [LOGIN_KEY]: login, [DISCONNECTED_KEY]: false });
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.set({ [DISCONNECTED_KEY]: true });
  await chrome.storage.local.remove([TOKEN_KEY, LOGIN_KEY]);
}

export async function isManuallyDisconnected(): Promise<boolean> {
  const result = await chrome.storage.local.get(DISCONNECTED_KEY);
  return result[DISCONNECTED_KEY] === true;
}
