const { getExtensionIdFromOrigin } = require("./http");
const { seal, unseal } = require("./secureSession");

const SESSION_PURPOSE = "recipe-basket-builder-swiggy-session";

function createSwiggySession(tokens, extensionId) {
  const expiresIn = Number(tokens.expires_in || 432000);

  return seal({
    type: "swiggy_session",
    extensionId,
    accessToken: tokens.access_token,
    tokenType: tokens.token_type || "Bearer",
    scope: tokens.scope || "mcp:tools",
    expiresAt: Date.now() + expiresIn * 1000
  }, SESSION_PURPOSE);
}

function readSwiggySession(request) {
  const authorization = request.headers?.authorization || "";
  const match = authorization.match(/^RecipeBasket\s+(.+)$/i);

  if (!match) {
    const error = new Error("Connect Swiggy to continue.");
    error.status = 401;
    throw error;
  }

  const session = unseal(match[1], SESSION_PURPOSE);

  if (session.type !== "swiggy_session" || !session.accessToken || !session.extensionId) {
    const error = new Error("The Swiggy connection is invalid.");
    error.status = 401;
    throw error;
  }

  if (session.expiresAt <= Date.now() + 60000) {
    const error = new Error("Your Swiggy session has expired. Connect again.");
    error.status = 401;
    throw error;
  }

  const requestExtensionId = getExtensionIdFromOrigin(request.headers?.origin);

  if (requestExtensionId && requestExtensionId !== session.extensionId) {
    const error = new Error("This Swiggy session belongs to another extension installation.");
    error.status = 403;
    throw error;
  }

  return session;
}

module.exports = {
  createSwiggySession,
  readSwiggySession
};
