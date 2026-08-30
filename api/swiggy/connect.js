const { auth } = require("@modelcontextprotocol/sdk/client/auth.js");
const { getRequestUrl, isValidExtensionId } = require("../../lib/http");
const { buildCookie, seal } = require("../../lib/secureSession");
const { SwiggyOAuthProvider } = require("../../lib/swiggyOAuthProvider");

const INSTAMART_ENDPOINT = process.env.SWIGGY_MCP_ENDPOINT || "https://mcp.swiggy.com/im";
const REDIRECT_URI = process.env.SWIGGY_REDIRECT_URI || "https://recipe-basket-builder.vercel.app/auth/callback";
const PENDING_PURPOSE = "recipe-basket-builder-swiggy-oauth-pending";

module.exports = async function connectSwiggy(request, response) {
  if (request.method !== "GET") {
    response.statusCode = 405;
    response.setHeader("Allow", "GET");
    response.end("Method not allowed");
    return;
  }

  try {
    const requestUrl = getRequestUrl(request);
    const extensionId = requestUrl.searchParams.get("extension_id");

    if (!isValidExtensionId(extensionId)) {
      sendErrorPage(response, "Recipe Basket Builder could not start", "The Chrome extension identity is missing or invalid.");
      return;
    }

    const provider = new SwiggyOAuthProvider({ redirectUrl: REDIRECT_URI });
    await auth(provider, {
      serverUrl: INSTAMART_ENDPOINT,
      scope: "mcp:tools"
    });

    if (!provider.authorizationUrl) {
      throw new Error("Swiggy did not return an authorization URL.");
    }

    const pendingSession = seal(provider.exportPending(extensionId), PENDING_PURPOSE);
    response.statusCode = 302;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Set-Cookie", buildCookie("rbb_swiggy_oauth", pendingSession, {
      maxAge: 600,
      sameSite: "Lax"
    }));
    response.setHeader("Location", provider.authorizationUrl);
    response.end();
  } catch (error) {
    console.error("Could not start Swiggy OAuth:", error.message);
    sendErrorPage(response, "Could not connect to Swiggy", "Please return to Recipe Basket Builder and try again.");
  }
};

function sendErrorPage(response, title, message) {
  response.statusCode = 400;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`);
}
