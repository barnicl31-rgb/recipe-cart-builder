const SWIGGY_API_BASE_URL = "https://recipe-basket-builder.vercel.app";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const supportedMessages = new Set([
    "connectSwiggy",
    "getSwiggySession",
    "clearSwiggySession"
  ]);

  if (!supportedMessages.has(message?.type)) {
    return false;
  }

  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error("Could not complete Swiggy session operation:", error);
      sendResponse({
        success: false,
        message: "Recipe Basket Builder could not access its saved Swiggy session. Reload the extension and try again."
      });
    });

  return true;
});

async function handleMessage(message) {
  if (message.type === "connectSwiggy") {
    await connectSwiggy();
    return { success: true };
  }

  if (message.type === "getSwiggySession") {
    const stored = await chrome.storage.local.get("swiggySession");
    return { success: true, session: stored.swiggySession || "" };
  }

  await chrome.storage.local.remove("swiggySession");
  return { success: true };
}

async function connectSwiggy() {
  const connectUrl = `${SWIGGY_API_BASE_URL}/api/swiggy/connect?extension_id=${encodeURIComponent(chrome.runtime.id)}`;
  const finalUrl = await chrome.identity.launchWebAuthFlow({
    url: connectUrl,
    interactive: true
  });
  const session = readSessionFromAuthRedirect(finalUrl);

  await chrome.storage.local.set({ swiggySession: session });
}

function readSessionFromAuthRedirect(finalUrl) {
  if (!finalUrl) {
    throw new Error("Swiggy did not return to the extension.");
  }

  const actualUrl = new URL(finalUrl);
  const expectedUrl = new URL(chrome.identity.getRedirectURL("swiggy"));

  if (actualUrl.origin !== expectedUrl.origin || actualUrl.pathname !== expectedUrl.pathname) {
    throw new Error("Swiggy returned to an unexpected address.");
  }

  const session = new URLSearchParams(actualUrl.hash.slice(1)).get("session");

  if (!session) {
    throw new Error("Swiggy did not return a session.");
  }

  return session;
}
