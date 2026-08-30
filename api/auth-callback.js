const { auth } = require("@modelcontextprotocol/sdk/client/auth.js");
const { getRequestUrl } = require("../lib/http");
const { buildCookie, parseCookies, safeEqual, unseal } = require("../lib/secureSession");
const { SwiggyOAuthProvider } = require("../lib/swiggyOAuthProvider");
const { createSwiggySession } = require("../lib/swiggySession");

const INSTAMART_ENDPOINT = process.env.SWIGGY_MCP_ENDPOINT || "https://mcp.swiggy.com/im";
const REDIRECT_URI = process.env.SWIGGY_REDIRECT_URI || "https://recipe-basket-builder.vercel.app/auth/callback";
const PENDING_PURPOSE = "recipe-basket-builder-swiggy-oauth-pending";

module.exports = async function authCallback(request, response) {
  const callbackUrl = getRequestUrl(request);
  const authorizationCode = callbackUrl.searchParams.get("code");
  const authorizationState = callbackUrl.searchParams.get("state");
  const authorizationError = callbackUrl.searchParams.get("error");

  setSecurityHeaders(response);

  if (!authorizationCode && !authorizationError) {
    sendPage(
      response,
      200,
      "Recipe Basket Builder callback is ready",
      "This secure endpoint is ready to receive Swiggy OAuth responses."
    );
    return;
  }

  if (authorizationError) {
    clearPendingCookie(response);
    sendPage(response, 400, "Swiggy connection was not completed", "Return to Recipe Basket Builder and try connecting again.");
    return;
  }

  try {
    const pendingCookie = parseCookies(request).rbb_swiggy_oauth;
    const pending = unseal(pendingCookie, PENDING_PURPOSE);

    if (pending.type !== "swiggy_oauth_pending" || Date.now() - pending.createdAt > 10 * 60 * 1000) {
      throw new Error("The authorization attempt has expired.");
    }

    if (!authorizationState || !safeEqual(authorizationState, pending.state)) {
      throw new Error("The authorization state did not match.");
    }

    const provider = new SwiggyOAuthProvider({
      redirectUrl: REDIRECT_URI,
      state: pending.state,
      clientInformation: pending.clientInformation,
      codeVerifier: pending.codeVerifier
    });

    await auth(provider, {
      serverUrl: INSTAMART_ENDPOINT,
      authorizationCode,
      scope: "mcp:tools"
    });

    const tokens = provider.tokens();

    if (!tokens?.access_token) {
      throw new Error("Swiggy did not issue an access token.");
    }

    const sealedSession = createSwiggySession(tokens, pending.extensionId);
    const extensionUrl = `https://${pending.extensionId}.chromiumapp.org/swiggy#session=${encodeURIComponent(sealedSession)}`;

    clearPendingCookie(response);
    redirectToExtension(response, extensionUrl);
  } catch (error) {
    console.error("Could not complete Swiggy OAuth:", error.message);
    clearPendingCookie(response);
    sendPage(response, 400, "Could not finish connecting Swiggy", "The sign-in attempt expired or could not be verified. Return to the extension and connect again.");
  }
};

function setSecurityHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function clearPendingCookie(response) {
  response.setHeader("Set-Cookie", buildCookie("rbb_swiggy_oauth", "", {
    maxAge: 0,
    sameSite: "Lax"
  }));
}

function redirectToExtension(response, extensionUrl) {
  response.statusCode = 302;
  response.setHeader("Location", extensionUrl);
  response.end();
}

function sendPage(response, statusCode, title, message) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body></html>`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
