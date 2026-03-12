const loadingEl = document.getElementById("loading") as HTMLDivElement;
const connectedEl = document.getElementById("connected") as HTMLDivElement;
const notConnectedEl = document.getElementById("not-connected") as HTMLDivElement;
const usernameEl = document.getElementById("username") as HTMLElement;
const connectBtn = document.getElementById("connect-btn") as HTMLButtonElement;
const disconnectBtn = document.getElementById("disconnect-btn") as HTMLButtonElement;

function showView(view: "loading" | "connected" | "not-connected") {
  loadingEl.hidden = view !== "loading";
  connectedEl.hidden = view !== "connected";
  notConnectedEl.hidden = view !== "not-connected";
}

async function checkStatus() {
  showView("loading");
  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" });
    if (res?.success && res.data.connected && res.data.login) {
      usernameEl.textContent = res.data.login;
      showView("connected");
    } else {
      showView("not-connected");
    }
  } catch {
    showView("not-connected");
  }
}

connectBtn.addEventListener("click", async () => {
  connectBtn.disabled = true;
  connectBtn.textContent = "Connecting...";
  try {
    const res = await chrome.runtime.sendMessage({ type: "CONNECT" });
    if (res?.success && res.data.connected && res.data.login) {
      usernameEl.textContent = res.data.login;
      showView("connected");
    } else {
      // No session cookie — open the app login page
      chrome.runtime.sendMessage({ type: "OPEN_LOGIN" });
      window.close();
    }
  } catch {
    chrome.runtime.sendMessage({ type: "OPEN_LOGIN" });
    window.close();
  } finally {
    connectBtn.disabled = false;
    connectBtn.textContent = "Connect";
  }
});

disconnectBtn.addEventListener("click", async () => {
  disconnectBtn.disabled = true;
  await chrome.runtime.sendMessage({ type: "DISCONNECT" });
  showView("not-connected");
  disconnectBtn.disabled = false;
});

checkStatus();
