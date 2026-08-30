function getRequestUrl(request) {
  const host = request.headers?.["x-forwarded-host"] || request.headers?.host || "localhost";
  const protocol = request.headers?.["x-forwarded-proto"] || "https";
  return new URL(request.url || "/", `${protocol}://${host}`);
}

function getExtensionIdFromOrigin(origin) {
  const match = String(origin || "").match(/^chrome-extension:\/\/([a-p]{32})$/);
  return match ? match[1] : null;
}

function isValidExtensionId(extensionId) {
  return /^[a-p]{32}$/.test(String(extensionId || ""));
}

function setExtensionCors(request, response, expectedExtensionId) {
  const origin = request.headers?.origin || "";
  const originExtensionId = getExtensionIdFromOrigin(origin);

  if (originExtensionId && (!expectedExtensionId || originExtensionId === expectedExtensionId)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Access-Control-Max-Age", "600");
  }

  response.setHeader("Cache-Control", "no-store");
}

function sendJson(response, statusCode, data) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(data));
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch (error) {
      return {};
    }
  }

  return new Promise((resolve) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        resolve({});
      }
    });
    request.on("error", () => resolve({}));
  });
}

module.exports = {
  getExtensionIdFromOrigin,
  getRequestUrl,
  isValidExtensionId,
  readJsonBody,
  sendJson,
  setExtensionCors
};
