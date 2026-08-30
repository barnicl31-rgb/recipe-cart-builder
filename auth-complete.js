const titleElement = document.getElementById("title");
const messageElement = document.getElementById("message");

completeConnection();

async function completeConnection() {
  const hashParameters = new URLSearchParams(window.location.hash.slice(1));
  const session = hashParameters.get("session");

  window.history.replaceState(null, "", window.location.pathname);

  if (!session) {
    titleElement.textContent = "Connection could not be completed";
    messageElement.textContent = "Return to Recipe Basket Builder and connect Swiggy again.";
    return;
  }

  await chrome.storage.local.set({ swiggySession: session });
  titleElement.textContent = "Swiggy is connected";
  messageElement.textContent = "You can close this page and reopen Recipe Basket Builder.";

  window.setTimeout(() => window.close(), 1800);
}
