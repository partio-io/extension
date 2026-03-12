const APP_URL = "https://app.partio.io";

const COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

async function getSessionCookie(): Promise<string | null> {
  for (const name of COOKIE_NAMES) {
    try {
      const cookie = await chrome.cookies.get({ url: APP_URL, name });
      if (cookie?.value) return cookie.value;
    } catch {
      // cookie not found, try next
    }
  }
  return null;
}

export interface AuthInfo {
  accessToken: string;
  login: string;
}

export async function fetchAuthFromApp(): Promise<AuthInfo | null> {
  const cookie = await getSessionCookie();
  if (!cookie) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${APP_URL}/api/auth/session`, {
      credentials: "include",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const session = await res.json();
    const accessToken = session?.accessToken ?? session?.user?.accessToken;
    const login = session?.user?.login ?? session?.user?.name;
    if (!accessToken || !login) return null;

    return { accessToken, login };
  } catch {
    return null;
  }
}
