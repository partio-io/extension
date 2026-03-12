import type { ExtensionRequest } from "../types/messages";
import { getCached, setCache } from "../lib/cache";
import {
  getCheckpointMetadata,
  getSessionMessages,
  getCheckpointPlan,
  findCheckpoint,
  getCommitContext,
  getPrContext,
  listAllCheckpoints,
} from "../lib/github";
import { fetchAuthFromApp } from "../lib/auth";
import { getToken, getLogin, setAuth, clearAuth, isManuallyDisconnected } from "../lib/token-store";

const APP_URL = "https://app.partio.io";
const APP_LOGIN_URL = "https://app.partio.io/login";

async function refreshAuth(): Promise<boolean> {
  const auth = await fetchAuthFromApp();
  if (auth) {
    await setAuth(auth.accessToken, auth.login);
    console.log("[Partio SW] Auth refreshed for", auth.login);
    return true;
  }
  console.log("[Partio SW] Could not refresh auth (no session)");
  return false;
}

// Refresh auth on install / startup
chrome.runtime.onInstalled.addListener(() => refreshAuth());
chrome.runtime.onStartup.addListener(() => refreshAuth());

// Auto sync when session cookie changes (skip if user explicitly disconnected)
chrome.cookies.onChanged.addListener(async (info) => {
  const { cookie, removed, cause } = info;
  if (
    (cookie.domain === "app.partio.io" || cookie.domain === ".app.partio.io") &&
    (cookie.name === "__Secure-authjs.session-token" ||
      cookie.name === "authjs.session-token")
  ) {
    if (removed && cause !== "overwrite") {
      // Cookie was genuinely deleted (logout, expired, etc.) — clear auth
      await clearAuth();
      console.log("[Partio SW] Session cookie removed (cause:", cause, "), auth cleared");
    } else if (!removed && !(await isManuallyDisconnected())) {
      // Cookie was set/updated and user hasn't manually disconnected
      refreshAuth();
    }
  }
});

// --- Login tab monitoring ---

function monitorLoginTab(tabId: number) {
  function onUpdated(updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
    if (updatedTabId !== tabId || !changeInfo.url) return;
    const url = new URL(changeInfo.url);
    if (url.hostname === "app.partio.io" && url.pathname !== "/login") {
      // User completed login — landed on dashboard or another page
      console.log("[Partio SW] Login tab navigated to", url.pathname, "— refreshing auth");
      refreshAuth().then((ok) => {
        if (ok) {
          chrome.action.setBadgeText({ text: "✓" });
          chrome.action.setBadgeBackgroundColor({ color: "#22c55e" });
          setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
        }
      });
      cleanup();
    }
  }

  function onRemoved(removedTabId: number) {
    if (removedTabId === tabId) cleanup();
  }

  function cleanup() {
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.tabs.onRemoved.removeListener(onRemoved);
  }

  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.tabs.onRemoved.addListener(onRemoved);
}

function cacheKey(type: string, owner: string, repo: string, id: string): string {
  return `${type}:${owner}/${repo}:${id}`;
}

chrome.runtime.onMessage.addListener(
  (request: ExtensionRequest, _sender, sendResponse) => {
    console.log("[Partio SW] Received message:", request.type);
    handleMessage(request)
      .then((response) => {
        console.log("[Partio SW] Response for", request.type, ":", response);
        sendResponse(response);
      })
      .catch((err) => {
        console.error("[Partio SW] Unhandled error for", request.type, ":", err);
        sendResponse({ success: false, error: err?.message || "Unknown error" });
      });
    return true;
  }
);

async function handleMessage(request: ExtensionRequest) {
  if (request.type === "GET_AUTH_STATUS") {
    let token = await getToken();
    let login = await getLogin();
    if (token && login?.trim()) {
      return { success: true, data: { connected: true, login: login.trim() } };
    }
    // Not connected — try auto-refresh unless user manually disconnected
    if (!(await isManuallyDisconnected())) {
      const ok = await refreshAuth();
      if (ok) {
        login = await getLogin();
        return { success: true, data: { connected: true, login: login?.trim() } };
      }
    }
    return { success: true, data: { connected: false } };
  }

  if (request.type === "OPEN_LOGIN") {
    const tab = await chrome.tabs.create({ url: APP_LOGIN_URL });
    if (tab.id != null) {
      monitorLoginTab(tab.id);
    }
    return { success: true, data: null };
  }

  if (request.type === "CONNECT") {
    const ok = await refreshAuth();
    if (ok) {
      const login = await getLogin();
      return { success: true, data: { connected: true, login } };
    }
    return { success: false, error: "NO_SESSION" };
  }

  if (request.type === "DISCONNECT") {
    await clearAuth();
    return { success: true, data: { connected: false } };
  }

  if (request.type === "GET_TOKEN") {
    const token = await getToken();
    if (!token) return { success: false, error: "No token configured" };
    return { success: true, data: token };
  }

  if (request.type === "GET_APP_URL") {
    return { success: true, data: APP_URL };
  }

  const token = await getToken();
  if (!token) {
    return { success: false, error: "No GitHub token configured. Click the Partio icon to connect." };
  }

  try {
    switch (request.type) {
      case "GET_CHECKPOINT": {
        const key = cacheKey("checkpoint", request.owner, request.repo, request.checkpointId);
        const cached = await getCached(key);
        if (cached) return { success: true, data: cached };

        const data = await getCheckpointMetadata(
          request.owner, request.repo, request.checkpointId, token
        );
        if (data) await setCache(key, data);
        return data
          ? { success: true, data }
          : { success: false, error: "Checkpoint not found" };
      }

      case "GET_SESSION": {
        const key = cacheKey("session", request.owner, request.repo, request.checkpointId);
        const cached = await getCached(key);
        if (cached) return { success: true, data: cached };

        const data = await getSessionMessages(
          request.owner, request.repo, request.checkpointId, token
        );
        await setCache(key, data);
        return { success: true, data };
      }

      case "GET_PLAN": {
        const key = cacheKey("plan", request.owner, request.repo, request.checkpointId);
        const cached = await getCached(key);
        if (cached) return { success: true, data: cached };

        const data = await getCheckpointPlan(
          request.owner, request.repo, request.checkpointId, token
        );
        await setCache(key, data);
        return { success: true, data };
      }

      case "FIND_CHECKPOINT": {
        const key = cacheKey("find", request.owner, request.repo, [...request.shas, ...request.branches].join(","));
        const cached = await getCached(key);
        if (cached) return { success: true, data: cached };

        const data = await findCheckpoint(
          request.owner, request.repo, request.shas, request.branches, token
        );
        if (data) await setCache(key, data);
        return data
          ? { success: true, data }
          : { success: false, error: "No checkpoint found for this commit" };
      }

      case "GET_COMMIT_CONTEXT": {
        const key = cacheKey("context", request.owner, request.repo, request.sha);
        const cached = await getCached(key);
        if (cached) return { success: true, data: cached };

        const data = await getCommitContext(
          request.owner, request.repo, request.sha, token
        );
        await setCache(key, data);
        return { success: true, data };
      }

      case "GET_PR_CONTEXT": {
        const key = cacheKey("pr-context", request.owner, request.repo, String(request.prNumber));
        const cached = await getCached(key);
        if (cached) return { success: true, data: cached };

        const data = await getPrContext(
          request.owner, request.repo, request.prNumber, token
        );
        await setCache(key, data);
        return { success: true, data };
      }

      case "LIST_CHECKPOINTS": {
        const key = cacheKey("list", request.owner, request.repo, "all");
        const cached = await getCached(key);
        if (cached) return { success: true, data: cached };

        const data = await listAllCheckpoints(
          request.owner, request.repo, token
        );
        await setCache(key, data);
        return { success: true, data };
      }

      default:
        return { success: false, error: "Unknown request type" };
    }
  } catch (err: any) {
    console.error("[Partio SW] Error handling", request.type, ":", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}
