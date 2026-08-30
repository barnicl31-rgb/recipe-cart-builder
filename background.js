const SWIGGY_API_BASE_URL = "https://recipe-basket-builder.vercel.app";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "connectSwiggy") {
    return false;
  }

  connectSwiggy()
    .then(() => sendResponse({ success: true }))
    .catch((error) => {
      console.error("Could not connect Swiggy:", error);
      sendResponse({
        success: false,
        message: "Swiggy connection was not completed. Please try again."
      });
    });

  return true;
});

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
